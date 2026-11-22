import {
  extractJsonFromModelText,
  type AIProvider,
  type ModelCapabilities,
  type StructuredAIRequest,
} from "@adaptui/ai-core";

export interface OllamaProviderConfig {
  endpoint: string;
  model: string;
  supportsJsonMode?: boolean;
  fetchImpl?: typeof fetch;
}

export class OllamaProvider implements AIProvider {
  public readonly id: string;
  public readonly kind = "local" as const;
  public readonly capabilities: ModelCapabilities;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OllamaProviderConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.model = config.model;
    this.id = `ollama:${config.model}`;
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.capabilities = {
      supportsStructuredOutput: true,
      supportsJsonMode: config.supportsJsonMode ?? true,
      maxContextChars: 16000,
    };
  }

  public async healthCheck(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await this.fetchImpl(`${this.endpoint}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(t);
      return res.ok;
    } catch {
      return false;
    }
  }

  public async listModels(): Promise<string[]> {
    const res = await this.fetchImpl(`${this.endpoint}/api/tags`);
    if (!res.ok) return [];
    const body = (await res.json()) as { models?: Array<{ name?: string }> };
    return (body.models || []).map((m) => m.name || "").filter(Boolean);
  }

  public async generateStructured<T>(request: StructuredAIRequest<T>): Promise<T> {
    const res = await this.fetchImpl(`${this.endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({
        model: this.model,
        stream: false,
        format: "json",
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama request failed with HTTP ${res.status}`);
    }
    const payload = (await res.json()) as { message?: { content?: string } };
    const text = payload.message?.content;
    if (!text) throw new Error("Ollama returned empty message content.");
    const parsed = extractJsonFromModelText(text);
    return request.schema.parse(parsed);
  }
}

export interface CloudProviderConfig {
  provider: "openai-compatible" | "anthropic" | "gemini";
  endpoint: string;
  model: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class CloudAIProvider implements AIProvider {
  public readonly id: string;
  public readonly kind = "cloud" as const;
  public readonly capabilities: ModelCapabilities = {
    supportsStructuredOutput: true,
    supportsJsonMode: true,
    maxContextChars: 48000,
  };
  private readonly config: CloudProviderConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CloudProviderConfig) {
    this.config = config;
    this.id = `${config.provider}:${config.model}`;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  public async healthCheck(): Promise<boolean> {
    return Boolean(this.config.apiKey && this.config.endpoint && this.config.model);
  }

  public async generateStructured<T>(request: StructuredAIRequest<T>): Promise<T> {
    if (!this.config.apiKey) {
      throw new Error("Cloud API key is not configured.");
    }

    const endpoint = this.config.endpoint.replace(/\/+$/, "");

    if (this.config.provider === "openai-compatible") {
      const url = endpoint.endsWith("/chat/completions")
        ? endpoint
        : `${endpoint}/chat/completions`;
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: request.signal,
        body: JSON.stringify({
          model: this.config.model,
          response_format: { type: "json_object" },
          temperature: 0.1,
          messages: [
            { role: "system", content: request.systemPrompt },
            { role: "user", content: request.userPrompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`Cloud provider HTTP ${res.status}`);
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty cloud model response.");
      return request.schema.parse(extractJsonFromModelText(content));
    }

    if (this.config.provider === "anthropic") {
      const url = endpoint.endsWith("/messages") ? endpoint : `${endpoint}/v1/messages`;
      const res = await this.fetchImpl(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        signal: request.signal,
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: 1500,
          system: request.systemPrompt,
          messages: [{ role: "user", content: request.userPrompt }],
        }),
      });
      if (!res.ok) throw new Error(`Anthropic provider HTTP ${res.status}`);
      const json = (await res.json()) as { content?: Array<{ text?: string }> };
      const content = json.content?.[0]?.text;
      if (!content) throw new Error("Empty Anthropic response.");
      return request.schema.parse(extractJsonFromModelText(content));
    }

    // Gemini API
    const url = `${endpoint}/v1beta/models/${encodeURIComponent(this.config.model)}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: request.userPrompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    });
    if (!res.ok) throw new Error(`Gemini provider HTTP ${res.status}`);
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("Empty Gemini response.");
    return request.schema.parse(extractJsonFromModelText(content));
  }
}

export type MockHandler = (request: StructuredAIRequest<unknown>) => unknown;

/**
 * Deterministic mock AI provider for tests and offline fallback.
 */
export class DeterministicMockAIProvider implements AIProvider {
  public readonly id = "mock:deterministic";
  public readonly kind = "mock" as const;
  public readonly capabilities: ModelCapabilities = {
    supportsStructuredOutput: true,
    supportsJsonMode: true,
    maxContextChars: 32000,
  };
  private readonly customHandler?: MockHandler;

  constructor(customHandler?: MockHandler) {
    this.customHandler = customHandler;
  }

  public async healthCheck(): Promise<boolean> {
    return true;
  }

  public async generateStructured<T>(request: StructuredAIRequest<T>): Promise<T> {
    if (this.customHandler) {
      const out = this.customHandler(request);
      return request.schema.parse(out);
    }

    if (request.task === "ui-organization" || request.task === "page-analysis") {
      return request.schema.parse({
        layout: "task",
        summary: "Organized deterministically for accessible navigation and task completion.",
      });
    }

    // Default safe fallback for command interpretation
    return request.schema.parse({
      intent: "unknown",
      steps: [],
      explanation: "Deterministic fallback planner selected.",
    });
  }
}

import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { HybridAIRouter, type AIProvider } from "@adaptui/ai-core";
import {
  CloudAIProvider,
  DeterministicMockAIProvider,
  OllamaProvider,
} from "@adaptui/ai-providers";
import { DEFAULT_AI_SETTINGS, DEFAULT_PRIVACY_SETTINGS } from "@adaptui/personalization";

const SimpleSchema = z.object({
  summary: z.string(),
});

describe("Hybrid AI Router & Provider Adapters", () => {
  it("STRICTLY blocks remote cloud requests in local-only mode even when local fails and allowCloudFallback is true", async () => {
    const cloudSpy = vi.fn(async () => ({ summary: "from cloud" }));
    const failingLocal: AIProvider = {
      id: "ollama:offline",
      kind: "local",
      capabilities: { supportsStructuredOutput: true, supportsJsonMode: true, maxContextChars: 8000 },
      healthCheck: async () => false,
      generateStructured: async () => {
        throw new Error("Connection refused");
      },
    };
    const cloudProvider: AIProvider = {
      id: "openai:gpt-4o-mini",
      kind: "cloud",
      capabilities: { supportsStructuredOutput: true, supportsJsonMode: true, maxContextChars: 32000 },
      healthCheck: async () => true,
      generateStructured: cloudSpy as any,
    };

    const router = new HybridAIRouter({
      settings: {
        ...DEFAULT_AI_SETTINGS,
        routingMode: "local-only",
        cloud: { ...DEFAULT_AI_SETTINGS.cloud, enabled: true, hasApiKey: true },
        hybridPolicy: { ...DEFAULT_AI_SETTINGS.hybridPolicy, allowCloudFallback: true, maxRetries: 0 },
      },
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowRemotePageContent: true },
      localProvider: failingLocal,
      cloudProvider,
    });

    await expect(
      router.generateStructured({
        task: "page-analysis",
        containsPageContent: true,
        systemPrompt: "Analyze",
        userPrompt: "Page text",
        schema: SimpleSchema,
      })
    ).rejects.toThrow();

    expect(cloudSpy).not.toHaveBeenCalled();
  });

  it("blocks cloud transmission of page content when privacy.allowRemotePageContent is false", async () => {
    const cloudSpy = vi.fn(async () => ({ summary: "cloud" }));
    const router = new HybridAIRouter({
      settings: {
        ...DEFAULT_AI_SETTINGS,
        routingMode: "cloud-only",
        cloud: { ...DEFAULT_AI_SETTINGS.cloud, enabled: true, hasApiKey: true },
      },
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowRemotePageContent: false },
      cloudProvider: {
        id: "cloud:test",
        kind: "cloud",
        capabilities: { supportsStructuredOutput: true, supportsJsonMode: true, maxContextChars: 32000 },
        healthCheck: async () => true,
        generateStructured: cloudSpy as any,
      },
    });

    await expect(
      router.generateStructured({
        task: "page-analysis",
        containsPageContent: true,
        systemPrompt: "sys",
        userPrompt: "secret page",
        schema: SimpleSchema,
      })
    ).rejects.toThrow(/privacy settings/i);

    expect(cloudSpy).not.toHaveBeenCalled();
  });

  it("falls back to cloud in hybrid mode when explicitly permitted and local provider fails", async () => {
    const router = new HybridAIRouter({
      settings: {
        ...DEFAULT_AI_SETTINGS,
        routingMode: "hybrid",
        cloud: { ...DEFAULT_AI_SETTINGS.cloud, enabled: true, hasApiKey: true },
        hybridPolicy: {
          ...DEFAULT_AI_SETTINGS.hybridPolicy,
          preferLocalForAnalysis: true,
          allowCloudFallback: true,
          maxRetries: 0,
        },
      },
      privacy: { ...DEFAULT_PRIVACY_SETTINGS, allowRemotePageContent: true },
      localProvider: {
        id: "ollama:down",
        kind: "local",
        capabilities: { supportsStructuredOutput: true, supportsJsonMode: true, maxContextChars: 8000 },
        healthCheck: async () => false,
        generateStructured: async () => {
          throw new Error("Local timeout");
        },
      },
      cloudProvider: {
        id: "openai:gpt-4o-mini",
        kind: "cloud",
        capabilities: { supportsStructuredOutput: true, supportsJsonMode: true, maxContextChars: 32000 },
        healthCheck: async () => true,
        generateStructured: async () => ({ summary: "Cloud fallback succeeded" }) as any,
      },
    });

    const out = await router.generateStructured({
      task: "page-analysis",
      containsPageContent: true,
      systemPrompt: "sys",
      userPrompt: "content",
      schema: SimpleSchema,
    });

    expect(out.providerId).toBe("openai:gpt-4o-mini");
    expect(out.data.summary).toBe("Cloud fallback succeeded");
  });

  it("skips models lacking structured-output capability and redacts secrets from logs", async () => {
    const router = new HybridAIRouter({
      settings: {
        ...DEFAULT_AI_SETTINGS,
        routingMode: "local-only",
        hybridPolicy: { ...DEFAULT_AI_SETTINGS.hybridPolicy, maxRetries: 0 },
      },
      privacy: DEFAULT_PRIVACY_SETTINGS,
      localProvider: {
        id: "ollama:weak",
        kind: "local",
        capabilities: { supportsStructuredOutput: false, supportsJsonMode: false, maxContextChars: 4000 },
        healthCheck: async () => true,
        generateStructured: async () => ({ summary: "should not run" }) as any,
      },
      mockProvider: new DeterministicMockAIProvider(() => ({ summary: "Safe mock response" })),
    });

    const out = await router.generateStructured({
      task: "page-analysis",
      systemPrompt: "sys",
      userPrompt: "test sk-1234567890abcdef12345",
      schema: SimpleSchema,
    });
    expect(out.providerId).toBe("mock:deterministic");
    expect(out.data.summary).toBe("Safe mock response");
  });

  it("communicates properly with Ollama and Cloud provider HTTP formats", async () => {
    const mockFetch = vi.fn(async (url: string | URL | Request) => {
      const s = String(url);
      if (s.includes("/api/tags")) {
        return new Response(JSON.stringify({ models: [{ name: "llama3.2" }] }), { status: 200 });
      }
      if (s.includes("/api/chat")) {
        return new Response(
          JSON.stringify({ message: { content: JSON.stringify({ summary: "Ollama JSON" }) } }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ summary: "OpenAI JSON" }) } }],
        }),
        { status: 200 }
      );
    });

    const ollama = new OllamaProvider({
      endpoint: "http://127.0.0.1:11434",
      model: "llama3.2",
      fetchImpl: mockFetch as any,
    });
    expect(await ollama.healthCheck()).toBe(true);
    expect(await ollama.listModels()).toEqual(["llama3.2"]);
    const oRes = await ollama.generateStructured({
      task: "page-analysis",
      systemPrompt: "s",
      userPrompt: "u",
      schema: SimpleSchema,
    });
    expect(oRes.summary).toBe("Ollama JSON");

    const openai = new CloudAIProvider({
      provider: "openai-compatible",
      endpoint: "https://api.openai.com/v1",
      model: "gpt-4o-mini",
      apiKey: "test-key",
      fetchImpl: mockFetch as any,
    });
    const cRes = await openai.generateStructured({
      task: "page-analysis",
      systemPrompt: "s",
      userPrompt: "u",
      schema: SimpleSchema,
    });
    expect(cRes.summary).toBe("OpenAI JSON");
  });
});

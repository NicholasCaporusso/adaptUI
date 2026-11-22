import { z } from "zod";
import type { AIProviderSettings, PrivacySettings } from "@adaptui/shared-types";
import { redactSensitiveText } from "@adaptui/security";

export interface ModelCapabilities {
  supportsStructuredOutput: boolean;
  supportsJsonMode: boolean;
  maxContextChars: number;
}

export interface StructuredAIRequest<T> {
  task: "page-analysis" | "command-interpretation" | "ui-organization";
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
  containsPageContent?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  readonly id: string;
  readonly kind: "local" | "cloud" | "mock";
  readonly capabilities: ModelCapabilities;
  generateStructured<T>(request: StructuredAIRequest<T>): Promise<T>;
  healthCheck(): Promise<boolean>;
  listModels?(): Promise<string[]>;
}

export interface AIInvocationLog {
  timestamp: string;
  providerId: string;
  task: string;
  success: boolean;
  durationMs: number;
  redactedSummary: string;
}

export function extractJsonFromModelText(raw: string): unknown {
  const trimmed = raw.trim();
  // Try direct JSON first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown fences if model wrapped JSON
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    }
    throw new Error("Model response did not contain valid JSON.");
  }
}

export class HybridAIRouter {
  private localProvider?: AIProvider;
  private cloudProvider?: AIProvider;
  private mockProvider?: AIProvider;
  private settings: AIProviderSettings;
  private privacy: PrivacySettings;
  private readonly logs: AIInvocationLog[] = [];

  constructor(params: {
    settings: AIProviderSettings;
    privacy: PrivacySettings;
    localProvider?: AIProvider;
    cloudProvider?: AIProvider;
    mockProvider?: AIProvider;
  }) {
    this.settings = params.settings;
    this.privacy = params.privacy;
    this.localProvider = params.localProvider;
    this.cloudProvider = params.cloudProvider;
    this.mockProvider = params.mockProvider;
  }

  public updateConfig(params: {
    settings?: AIProviderSettings;
    privacy?: PrivacySettings;
    localProvider?: AIProvider;
    cloudProvider?: AIProvider;
    mockProvider?: AIProvider;
  }): void {
    if (params.settings) this.settings = params.settings;
    if (params.privacy) this.privacy = params.privacy;
    if (params.localProvider !== undefined) this.localProvider = params.localProvider;
    if (params.cloudProvider !== undefined) this.cloudProvider = params.cloudProvider;
    if (params.mockProvider !== undefined) this.mockProvider = params.mockProvider;
  }

  public getLogs(): AIInvocationLog[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs.length = 0;
  }

  private recordLog(entry: AIInvocationLog): void {
    this.logs.unshift({
      ...entry,
      redactedSummary: redactSensitiveText(entry.redactedSummary, { redactEmailsAndPhones: true }).slice(0, 280),
    });
    if (this.logs.length > 100) {
      this.logs.length = 100;
    }
  }

  private selectCandidateProviders(request: StructuredAIRequest<unknown>): AIProvider[] {
    const candidates: AIProvider[] = [];
    const mode = this.settings.routingMode;

    const canUseCloud =
      mode !== "local-only" &&
      this.settings.cloud.enabled &&
      Boolean(this.cloudProvider) &&
      (!request.containsPageContent || this.privacy.allowRemotePageContent);

    const canUseLocal =
      mode !== "cloud-only" &&
      this.settings.local.enabled &&
      Boolean(this.localProvider);

    if (mode === "local-only") {
      // Strict privacy invariant: NEVER enqueue cloudProvider in local-only mode
      if (canUseLocal && this.localProvider) candidates.push(this.localProvider);
      if (this.mockProvider) candidates.push(this.mockProvider);
      return candidates;
    }

    if (mode === "cloud-only") {
      if (canUseCloud && this.cloudProvider) candidates.push(this.cloudProvider);
      if (this.mockProvider) candidates.push(this.mockProvider);
      return candidates;
    }

    // Hybrid mode
    const preferLocal =
      request.task === "command-interpretation"
        ? this.settings.hybridPolicy.preferLocalForCommands
        : this.settings.hybridPolicy.preferLocalForAnalysis;

    if (preferLocal) {
      if (canUseLocal && this.localProvider) candidates.push(this.localProvider);
      if (this.settings.hybridPolicy.allowCloudFallback && canUseCloud && this.cloudProvider) {
        candidates.push(this.cloudProvider);
      }
    } else {
      if (canUseCloud && this.cloudProvider) candidates.push(this.cloudProvider);
      if (canUseLocal && this.localProvider) candidates.push(this.localProvider);
    }

    if (this.mockProvider) candidates.push(this.mockProvider);
    return candidates;
  }

  public async generateStructured<T>(
    request: StructuredAIRequest<T>
  ): Promise<{ data: T; providerId: string; kind: AIProvider["kind"] }> {
    const candidates = this.selectCandidateProviders(request);
    if (candidates.length === 0) {
      throw new Error(
        this.settings.routingMode === "cloud-only" && !this.privacy.allowRemotePageContent
          ? "Remote AI processing is disabled by your privacy settings."
          : "No eligible AI provider is available for the current routing mode."
      );
    }

    const maxChars = this.settings.hybridPolicy.maxContextChars || 24000;
    const boundedPrompt =
      request.userPrompt.length > maxChars
        ? request.userPrompt.slice(0, maxChars) + "\n[Truncated to context limit]"
        : request.userPrompt;

    const maxRetries = Math.max(0, Math.min(3, this.settings.hybridPolicy.maxRetries ?? 1));
    const errors: string[] = [];

    for (const provider of candidates) {
      // Capability check before invoking provider
      if (!provider.capabilities.supportsStructuredOutput && !provider.capabilities.supportsJsonMode) {
        errors.push(`${provider.id}: model does not support structured JSON output`);
        continue;
      }

      const timeoutMs =
        request.timeoutMs ??
        (provider.kind === "local"
          ? this.settings.local.timeoutMs
          : provider.kind === "cloud"
          ? this.settings.cloud.timeoutMs
          : 5000);

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (request.signal?.aborted) {
          throw new Error("AI request was cancelled.");
        }

        const started = Date.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const onExternalAbort = () => controller.abort();
        request.signal?.addEventListener("abort", onExternalAbort, { once: true });

        try {
          const rawResult = await provider.generateStructured({
            ...request,
            userPrompt: boundedPrompt,
            timeoutMs,
            signal: controller.signal,
          });
          const validated = request.schema.parse(rawResult);
          this.recordLog({
            timestamp: new Date().toISOString(),
            providerId: provider.id,
            task: request.task,
            success: true,
            durationMs: Date.now() - started,
            redactedSummary: `Structured ${request.task} succeeded (${provider.kind})`,
          });
          return { data: validated, providerId: provider.id, kind: provider.kind };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`${provider.id} (attempt ${attempt + 1}): ${msg}`);
          this.recordLog({
            timestamp: new Date().toISOString(),
            providerId: provider.id,
            task: request.task,
            success: false,
            durationMs: Date.now() - started,
            redactedSummary: `Failed ${request.task}: ${msg}`,
          });
          if (provider.kind === "mock") break;
        } finally {
          clearTimeout(timer);
          request.signal?.removeEventListener("abort", onExternalAbort);
        }
      }
    }

    throw new Error(`All eligible AI providers failed: ${errors.join("; ")}`);
  }

  public async healthCheck(): Promise<{
    local: boolean;
    cloud: boolean;
    localModels: string[];
  }> {
    const localHealthy = this.localProvider ? await this.localProvider.healthCheck().catch(() => false) : false;
    const localModels =
      localHealthy && this.localProvider?.listModels
        ? await this.localProvider.listModels().catch(() => [])
        : [];
    const cloudHealthy =
      this.settings.routingMode !== "local-only" && this.cloudProvider
        ? await this.cloudProvider.healthCheck().catch(() => false)
        : false;
    return { local: localHealthy, cloud: cloudHealthy, localModels };
  }
}

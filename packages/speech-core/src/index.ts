import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type {
  VoiceModelOption,
  VoiceSettings,
  VoiceStatus,
  VoiceTranscriptionResult,
  WhisperModelId,
} from "@adaptui/shared-types";
import { detectAndSanitizePromptInjection } from "@adaptui/security";

const execFileAsync = promisify(execFile);

export const WHISPER_MODELS: VoiceModelOption[] = [
  {
    id: "onnx-community/whisper-tiny",
    shortName: "tiny",
    label: "Whisper Tiny (Multilingual)",
    approxSizeMb: 75,
    multilingual: true,
    recommendedFor: "Fastest startup on low-power CPUs",
  },
  {
    id: "onnx-community/whisper-base.en",
    shortName: "base.en",
    label: "Whisper Base (English-only)",
    approxSizeMb: 110,
    multilingual: false,
    recommendedFor: "Snappy, accurate English commands on CPU",
  },
  {
    id: "onnx-community/whisper-base",
    shortName: "base",
    label: "Whisper Base (Multilingual)",
    approxSizeMb: 120,
    multilingual: true,
    recommendedFor: "Lightweight multilingual voice recognition",
  },
  {
    id: "onnx-community/whisper-small.en",
    shortName: "small.en",
    label: "Whisper Small (English-only)",
    approxSizeMb: 260,
    multilingual: false,
    recommendedFor: "High accuracy English commands & dictation",
  },
  {
    id: "onnx-community/whisper-small",
    shortName: "small",
    label: "Whisper Small (Multilingual — Default)",
    approxSizeMb: 280,
    multilingual: true,
    recommendedFor: "Best balance of accuracy, speed, and multilingual support",
  },
  {
    id: "onnx-community/whisper-medium",
    shortName: "medium",
    label: "Whisper Medium (Multilingual)",
    approxSizeMb: 780,
    multilingual: true,
    recommendedFor: "Higher accuracy for accented or dysarthric speech",
  },
  {
    id: "onnx-community/whisper-large-v3-turbo",
    shortName: "large-v3-turbo",
    label: "Whisper Large v3 Turbo (Multilingual)",
    approxSizeMb: 1100,
    multilingual: true,
    recommendedFor: "Maximum accuracy (best with fast CPU or CUDA faster-whisper)",
  },
];

export const VOICE_LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "auto", label: "Auto-Detect (Multilingual)" },
  { code: "en", label: "English" },
  { code: "fr", label: "French (Français)" },
  { code: "es", label: "Spanish (Español)" },
  { code: "de", label: "German (Deutsch)" },
  { code: "it", label: "Italian (Italiano)" },
  { code: "pt", label: "Portuguese (Português)" },
  { code: "nl", label: "Dutch (Nederlands)" },
  { code: "pl", label: "Polish (Polski)" },
  { code: "ar", label: "Arabic (العربية)" },
  { code: "zh", label: "Chinese (中文)" },
  { code: "ja", label: "Japanese (日本語)" },
  { code: "ko", label: "Korean (한국어)" },
  { code: "hi", label: "Hindi (हिन्दी)" },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  backend: "onnx-local",
  modelId: "onnx-community/whisper-small",
  language: "auto",
  activationMode: "toggle",
  executionMode: "auto-execute",
  wakeWord: "adaptui",
  silenceStopMs: 1800,
  silenceThreshold: 0.015,
  dictationEnabled: true,
  httpEndpoint: "http://127.0.0.1:8080/inference",
  pythonPath: "python",
  pythonDevice: "auto",
};

export const VoiceSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  backend: z.enum(["onnx-local", "whisper-http", "faster-whisper-python"]).default("onnx-local"),
  modelId: z
    .enum([
      "onnx-community/whisper-tiny",
      "onnx-community/whisper-base.en",
      "onnx-community/whisper-base",
      "onnx-community/whisper-small.en",
      "onnx-community/whisper-small",
      "onnx-community/whisper-medium",
      "onnx-community/whisper-large-v3-turbo",
    ])
    .default("onnx-community/whisper-small"),
  language: z.string().min(2).max(16).default("auto"),
  activationMode: z.enum(["toggle", "push-to-talk", "wake-word", "manual"]).default("toggle"),
  executionMode: z.enum(["auto-execute", "review-before-run"]).default("auto-execute"),
  wakeWord: z.string().min(2).max(40).default("adaptui"),
  silenceStopMs: z.number().int().min(600).max(6000).default(1800),
  silenceThreshold: z.number().min(0.002).max(0.2).default(0.015),
  dictationEnabled: z.boolean().default(true),
  httpEndpoint: z.string().url().default("http://127.0.0.1:8080/inference"),
  pythonPath: z.string().min(1).default("python"),
  pythonDevice: z.enum(["auto", "cuda", "cpu"]).default("auto"),
});

export function getModelOption(modelId: WhisperModelId): VoiceModelOption {
  return WHISPER_MODELS.find((m) => m.id === modelId) ?? WHISPER_MODELS[4]!;
}

/**
 * Enforces local-only privacy boundary for HTTP Whisper endpoints:
 * audio is only permitted to be sent to local loopback interfaces.
 */
export function isLoopbackEndpoint(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return host === "127.0.0.1" || host === "localhost" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
}

/**
 * Encodes 16 kHz mono Float32 PCM samples into a standard 16-bit PCM WAV buffer.
 */
export function encodeFloat32ToWavBuffer(samples: Float32Array, sampleRate = 16000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // AudioFormat = PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i] ?? 0));
    const int16 = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
    buffer.writeInt16LE(int16, 44 + i * 2);
  }

  return buffer;
}

/**
 * Matches a configurable wake phrase (e.g. "AdaptUI", "Hey AdaptUI", "OK AdaptUI")
 * and extracts the trailing command text cleanly.
 */
export function extractWakeWordCommand(
  transcript: string,
  wakeWord: string
): { matched: boolean; command: string } {
  const cleanTranscript = transcript.trim();
  const cleanWake = wakeWord.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!cleanTranscript || !cleanWake) {
    return { matched: false, command: "" };
  }

  // Allow common speech-to-text spacing variants (e.g., "adapt ui" vs "adaptui")
  const spacedWake = cleanWake.replace(/adaptui/i, "adapt\\s*u\\s*i");
  const pattern = new RegExp(
    `(?:^|[\\s,.!?])(?:(?:hey|ok|okay|hi)\\s+)?(?:${cleanWake}|${spacedWake})(?:[,:.!?\\s]+(.*))?$`,
    "i"
  );
  const match = cleanTranscript.match(pattern);
  if (!match) {
    return { matched: false, command: "" };
  }
  return {
    matched: true,
    command: (match[1] ?? "").trim(),
  };
}

export interface SpeechProgressEvent {
  status: string;
  progress?: number;
  file?: string;
}

export interface TranscribeOptions {
  modelId: WhisperModelId;
  language: string;
  sampleRate?: number;
  onProgress?: (evt: SpeechProgressEvent) => void;
}

export interface SpeechRecognizer {
  readonly id: string;
  readonly kind: VoiceSettings["backend"] | "mock";
  readonly localOnly: boolean;
  isModelLoaded(modelId: WhisperModelId): boolean;
  healthCheck(): Promise<{ healthy: boolean; detail: string }>;
  preload?(modelId: WhisperModelId, onProgress?: (evt: SpeechProgressEvent) => void): Promise<void>;
  transcribe(audio: Float32Array, options: TranscribeOptions): Promise<{ text: string; language: string }>;
}

/**
 * Built-in 100% local ONNX Whisper recognizer using @huggingface/transformers.
 */
export class OnnxWhisperRecognizer implements SpeechRecognizer {
  public readonly id = "whisper:onnx-local";
  public readonly kind = "onnx-local" as const;
  public readonly localOnly = true;

  private readonly cacheDir: string;
  private loadedModelId: WhisperModelId | null = null;
  private transcriber: any = null;
  private loadingPromise: Promise<any> | null = null;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  public isModelLoaded(modelId: WhisperModelId): boolean {
    return this.loadedModelId === modelId && Boolean(this.transcriber);
  }

  public async healthCheck(): Promise<{ healthy: boolean; detail: string }> {
    try {
      await import("@huggingface/transformers");
      return {
        healthy: true,
        detail: this.loadedModelId
          ? `ONNX Runtime ready (loaded ${this.loadedModelId})`
          : "ONNX Runtime ready (model downloads locally on first use)",
      };
    } catch (err) {
      return {
        healthy: false,
        detail: `ONNX Whisper unavailable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  public async preload(
    modelId: WhisperModelId,
    onProgress?: (evt: SpeechProgressEvent) => void
  ): Promise<void> {
    await this.ensurePipeline(modelId, onProgress);
  }

  private async ensurePipeline(
    modelId: WhisperModelId,
    onProgress?: (evt: SpeechProgressEvent) => void
  ): Promise<any> {
    if (this.transcriber && this.loadedModelId === modelId) {
      return this.transcriber;
    }
    if (this.loadingPromise && this.loadedModelId === modelId) {
      return this.loadingPromise;
    }

    this.loadedModelId = modelId;
    this.loadingPromise = (async () => {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      const transformers = await import("@huggingface/transformers");
      transformers.env.cacheDir = this.cacheDir;
      transformers.env.allowLocalModels = true;

      const pipe = await transformers.pipeline("automatic-speech-recognition", modelId, {
        dtype: {
          encoder_model: "fp32",
          decoder_model_merged: "q8",
        },
        device: "cpu",
        progress_callback: (info: any) => {
          onProgress?.({
            status: String(info?.status || "loading"),
            progress: typeof info?.progress === "number" ? Math.round(info.progress) : undefined,
            file: info?.file ? String(info.file) : undefined,
          });
        },
      });
      this.transcriber = pipe;
      return pipe;
    })();

    try {
      return await this.loadingPromise;
    } catch (err) {
      this.loadedModelId = null;
      this.transcriber = null;
      throw err;
    } finally {
      this.loadingPromise = null;
    }
  }

  public async transcribe(
    audio: Float32Array,
    options: TranscribeOptions
  ): Promise<{ text: string; language: string }> {
    const pipe = await this.ensurePipeline(options.modelId, options.onProgress);
    const modelMeta = getModelOption(options.modelId);

    const callOptions: Record<string, unknown> = {
      chunk_length_s: 30,
      stride_length_s: 5,
    };

    if (modelMeta.multilingual) {
      callOptions.task = "transcribe";
      if (options.language && options.language !== "auto") {
        callOptions.language = options.language;
      }
    }

    const output = await pipe(audio, callOptions);
    const text = Array.isArray(output)
      ? output.map((o: any) => String(o?.text ?? "")).join(" ").trim()
      : String(output?.text ?? "").trim();

    return {
      text,
      language: modelMeta.multilingual ? options.language || "auto" : "en",
    };
  }
}

/**
 * Local Whisper HTTP adapter (whisper.cpp server or local OpenAI-compatible /v1/audio/transcriptions).
 * Strictly restricted to loopback addresses so audio never leaves the user's machine.
 */
export class LocalWhisperHttpRecognizer implements SpeechRecognizer {
  public readonly id = "whisper:http-local";
  public readonly kind = "whisper-http" as const;
  public readonly localOnly = true;

  private readonly endpoint: string;
  private readonly fetchImpl: typeof fetch;

  constructor(endpoint: string, fetchImpl?: typeof fetch) {
    this.endpoint = endpoint;
    this.fetchImpl = fetchImpl ?? fetch;
  }

  public isModelLoaded(): boolean {
    return true;
  }

  public async healthCheck(): Promise<{ healthy: boolean; detail: string }> {
    if (!isLoopbackEndpoint(this.endpoint)) {
      return {
        healthy: false,
        detail: "Blocked non-local endpoint: Whisper HTTP server must run on localhost/127.0.0.1.",
      };
    }
    try {
      const parsed = new URL(this.endpoint);
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await this.fetchImpl(`${parsed.origin}/health`, { signal: controller.signal }).catch(
        () => this.fetchImpl(parsed.origin, { signal: controller.signal })
      );
      clearTimeout(t);
      return {
        healthy: res.ok || res.status < 500,
        detail: `Local Whisper HTTP reachable at ${parsed.origin}`,
      };
    } catch {
      return {
        healthy: false,
        detail: `Local Whisper HTTP server not reachable at ${this.endpoint}`,
      };
    }
  }

  public async transcribe(
    audio: Float32Array,
    options: TranscribeOptions
  ): Promise<{ text: string; language: string }> {
    if (!isLoopbackEndpoint(this.endpoint)) {
      throw new Error(
        "Privacy guard blocked non-local Whisper HTTP endpoint. Use localhost or 127.0.0.1."
      );
    }

    const wav = encodeFloat32ToWavBuffer(audio, options.sampleRate ?? 16000);
    const modelMeta = getModelOption(options.modelId);
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(wav)], { type: "audio/wav" }), "speech.wav");
    form.append("model", modelMeta.shortName);
    form.append("response_format", "json");
    if (options.language && options.language !== "auto") {
      form.append("language", options.language);
    }

    const res = await this.fetchImpl(this.endpoint, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Local Whisper HTTP server returned HTTP ${res.status}`);
    }
    const json = (await res.json()) as { text?: string; language?: string };
    return {
      text: String(json.text ?? "").trim(),
      language: json.language || options.language || "auto",
    };
  }
}

/**
 * Local Python faster-whisper sidecar adapter (supports CUDA GPU or CPU).
 */
export class FasterWhisperPythonRecognizer implements SpeechRecognizer {
  public readonly id = "whisper:faster-whisper-python";
  public readonly kind = "faster-whisper-python" as const;
  public readonly localOnly = true;

  private readonly pythonPath: string;
  private readonly device: "auto" | "cuda" | "cpu";

  constructor(pythonPath = "python", device: "auto" | "cuda" | "cpu" = "auto") {
    this.pythonPath = pythonPath;
    this.device = device;
  }

  public isModelLoaded(): boolean {
    return false;
  }

  public async healthCheck(): Promise<{ healthy: boolean; detail: string }> {
    try {
      const { stdout } = await execFileAsync(
        this.pythonPath,
        ["-c", "import faster_whisper; print(faster_whisper.__version__)"],
        { timeout: 5000 }
      );
      return {
        healthy: true,
        detail: `faster-whisper ${stdout.trim()} available via ${this.pythonPath} (device: ${this.device})`,
      };
    } catch {
      return {
        healthy: false,
        detail: `faster-whisper not installed for "${this.pythonPath}". Install with: pip install faster-whisper`,
      };
    }
  }

  public async transcribe(
    audio: Float32Array,
    options: TranscribeOptions
  ): Promise<{ text: string; language: string }> {
    const modelMeta = getModelOption(options.modelId);
    const tmpFile = path.join(
      os.tmpdir(),
      `adaptui-voice-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.wav`
    );
    const wav = encodeFloat32ToWavBuffer(audio, options.sampleRate ?? 16000);
    fs.writeFileSync(tmpFile, wav);

    const script = [
      "import json, sys",
      "from faster_whisper import WhisperModel",
      "model_name, audio_path, device, lang = sys.argv[1:5]",
      "compute = 'float16' if device == 'cuda' else 'int8'",
      "model = WhisperModel(model_name, device=device, compute_type=compute)",
      "kw = {} if lang == 'auto' else {'language': lang}",
      "segments, info = model.transcribe(audio_path, beam_size=5, **kw)",
      "text = ' '.join(s.text.strip() for s in segments).strip()",
      "print(json.dumps({'text': text, 'language': getattr(info, 'language', lang)}))",
    ].join("\n");

    try {
      const { stdout } = await execFileAsync(
        this.pythonPath,
        [
          "-c",
          script,
          modelMeta.shortName,
          tmpFile,
          this.device,
          modelMeta.multilingual ? options.language || "auto" : "en",
        ],
        { timeout: 60000 }
      );
      const parsed = JSON.parse(stdout.trim()) as { text?: string; language?: string };
      return {
        text: String(parsed.text ?? "").trim(),
        language: parsed.language || options.language || "auto",
      };
    } finally {
      try {
        fs.unlinkSync(tmpFile);
      } catch {
        // Ignore cleanup race
      }
    }
  }
}

/**
 * Deterministic mock speech recognizer for unit, security, and E2E tests.
 */
export class MockSpeechRecognizer implements SpeechRecognizer {
  public readonly id = "whisper:mock";
  public readonly kind = "mock" as const;
  public readonly localOnly = true;
  private transcript: string;
  private readonly queue: string[] = [];

  constructor(transcriptOrQueue: string | string[] = "Find the contact information") {
    if (Array.isArray(transcriptOrQueue)) {
      this.queue.push(...transcriptOrQueue);
      this.transcript = transcriptOrQueue[0] ?? "";
    } else {
      this.transcript = transcriptOrQueue;
    }
  }

  public setNextTranscript(text: string): void {
    this.transcript = text;
  }

  public isModelLoaded(): boolean {
    return true;
  }

  public async healthCheck(): Promise<{ healthy: boolean; detail: string }> {
    return { healthy: true, detail: "Deterministic mock Whisper recognizer active" };
  }

  public async transcribe(
    _audio: Float32Array,
    options: TranscribeOptions
  ): Promise<{ text: string; language: string }> {
    const next = this.queue.length > 0 ? this.queue.shift()! : this.transcript;
    return {
      text: next,
      language: options.language === "auto" ? "en" : options.language,
    };
  }
}

export class SpeechRouter {
  private settings: VoiceSettings;
  private readonly onnxRecognizer: OnnxWhisperRecognizer;
  private httpRecognizer: LocalWhisperHttpRecognizer;
  private pythonRecognizer: FasterWhisperPythonRecognizer;
  private mockRecognizer?: SpeechRecognizer;

  constructor(params: {
    settings: VoiceSettings;
    cacheDir: string;
    mockRecognizer?: SpeechRecognizer;
    fetchImpl?: typeof fetch;
  }) {
    this.settings = params.settings;
    this.onnxRecognizer = new OnnxWhisperRecognizer(params.cacheDir);
    this.httpRecognizer = new LocalWhisperHttpRecognizer(
      params.settings.httpEndpoint,
      params.fetchImpl
    );
    this.pythonRecognizer = new FasterWhisperPythonRecognizer(
      params.settings.pythonPath,
      params.settings.pythonDevice
    );
    this.mockRecognizer = params.mockRecognizer;
  }

  public updateSettings(settings: VoiceSettings): void {
    this.settings = settings;
    this.httpRecognizer = new LocalWhisperHttpRecognizer(settings.httpEndpoint);
    this.pythonRecognizer = new FasterWhisperPythonRecognizer(
      settings.pythonPath,
      settings.pythonDevice
    );
  }

  private getActiveRecognizer(): SpeechRecognizer {
    if (this.mockRecognizer) return this.mockRecognizer;
    if (this.settings.backend === "whisper-http") return this.httpRecognizer;
    if (this.settings.backend === "faster-whisper-python") return this.pythonRecognizer;
    return this.onnxRecognizer;
  }

  public async getStatus(): Promise<VoiceStatus> {
    const active = this.getActiveRecognizer();
    const health = await active.healthCheck();
    return {
      backend: this.settings.backend,
      modelId: this.settings.modelId,
      healthy: health.healthy,
      modelLoaded: active.isModelLoaded(this.settings.modelId),
      localOnly: active.localOnly,
      detail: health.detail,
      availableModels: WHISPER_MODELS,
    };
  }

  public async preload(
    onProgress?: (evt: SpeechProgressEvent) => void
  ): Promise<{ loaded: boolean; modelId: string; message: string }> {
    const active = this.getActiveRecognizer();
    if (active.preload) {
      await active.preload(this.settings.modelId, onProgress);
      return {
        loaded: true,
        modelId: this.settings.modelId,
        message: `Loaded local model ${this.settings.modelId} into memory.`,
      };
    }
    const health = await active.healthCheck();
    return {
      loaded: health.healthy,
      modelId: this.settings.modelId,
      message: health.detail,
    };
  }

  public async transcribe(params: {
    audio: Float32Array;
    sampleRate?: number;
    purpose: "command" | "dictation" | "wake-check";
    onProgress?: (evt: SpeechProgressEvent) => void;
  }): Promise<VoiceTranscriptionResult> {
    const started = Date.now();
    if (!this.settings.enabled) {
      return {
        transcript: "",
        backendUsed: "disabled",
        modelId: this.settings.modelId,
        language: this.settings.language,
        durationMs: Date.now() - started,
        error: "Voice commands are currently disabled in Settings -> Voice & Speech.",
      };
    }

    const active = this.getActiveRecognizer();
    try {
      const res = await active.transcribe(params.audio, {
        modelId: this.settings.modelId,
        language: this.settings.language,
        sampleRate: params.sampleRate ?? 16000,
        onProgress: params.onProgress,
      });

      const cleanTranscript = detectAndSanitizePromptInjection(res.text).sanitizedText;
      let normalizedCommand = cleanTranscript;
      let wakeWordMatched: boolean | undefined;

      if (
        params.purpose === "wake-check" ||
        (params.purpose === "command" && this.settings.activationMode === "wake-word")
      ) {
        const wake = extractWakeWordCommand(cleanTranscript, this.settings.wakeWord);
        wakeWordMatched = wake.matched;
        normalizedCommand = wake.command;
      }

      return {
        transcript: cleanTranscript,
        normalizedCommand,
        wakeWordMatched,
        backendUsed: active.id,
        modelId: this.settings.modelId,
        language: res.language,
        durationMs: Date.now() - started,
      };
    } catch (err) {
      return {
        transcript: "",
        backendUsed: active.id,
        modelId: this.settings.modelId,
        language: this.settings.language,
        durationMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

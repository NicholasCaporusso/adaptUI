import fs from "node:fs";
import path from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { z } from "zod";
import type {
  AccessibilityProfile,
  AIProviderSettings,
  EvaluationMetricEvent,
  PrivacySettings,
  VoiceSettings,
} from "@adaptui/shared-types";

export const AccessibilityProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  isDefault: z.boolean().optional(),
  presentation: z.object({
    textScale: z.number().min(0.85).max(2.2),
    lineHeight: z.number().min(1.2).max(2.4),
    letterSpacing: z.number().min(0).max(0.15),
    contrast: z.enum(["standard", "high", "dark-high"]),
    density: z.enum(["compact", "comfortable", "minimal"]),
    reducedMotion: z.boolean(),
    showImages: z.boolean().default(true),
    showVideos: z.boolean().default(true),
  }),
  interaction: z.object({
    minimumTargetSize: z.number().int().min(36).max(96),
    controlSpacing: z.number().int().min(4).max(40),
    keyboardOnly: z.boolean(),
    scanningMode: z.boolean(),
    scanIntervalMs: z.number().int().min(600).max(8000),
    eyeGazeMode: z.boolean(),
    confirmationLevel: z.enum(["standard", "enhanced"]),
  }),
  workflow: z.object({
    simplifyNavigation: z.boolean(),
    preferStepByStepForms: z.boolean(),
    showAdvancedOptions: z.boolean(),
    hideSecondaryContent: z.boolean(),
  }),
});

export const DEFAULT_PROFILES: AccessibilityProfile[] = [
  {
    id: "standard-accessible",
    name: "Standard Accessible",
    isDefault: true,
    presentation: {
      textScale: 1.1,
      lineHeight: 1.6,
      letterSpacing: 0.01,
      contrast: "standard",
      density: "comfortable",
      reducedMotion: false,
      showImages: true,
      showVideos: true,
    },
    interaction: {
      minimumTargetSize: 44,
      controlSpacing: 12,
      keyboardOnly: false,
      scanningMode: false,
      scanIntervalMs: 1800,
      eyeGazeMode: false,
      confirmationLevel: "standard",
    },
    workflow: {
      simplifyNavigation: true,
      preferStepByStepForms: true,
      showAdvancedOptions: false,
      hideSecondaryContent: true,
    },
  },
  {
    id: "eye-gaze-large",
    name: "Eye-Gaze & Large Targets",
    isDefault: true,
    presentation: {
      textScale: 1.35,
      lineHeight: 1.75,
      letterSpacing: 0.03,
      contrast: "high",
      density: "minimal",
      reducedMotion: true,
      showImages: true,
      showVideos: true,
    },
    interaction: {
      minimumTargetSize: 64,
      controlSpacing: 24,
      keyboardOnly: false,
      scanningMode: false,
      scanIntervalMs: 2200,
      eyeGazeMode: true,
      confirmationLevel: "enhanced",
    },
    workflow: {
      simplifyNavigation: true,
      preferStepByStepForms: true,
      showAdvancedOptions: false,
      hideSecondaryContent: true,
    },
  },
  {
    id: "switch-scanning",
    name: "Switch & Keyboard Scanning",
    isDefault: true,
    presentation: {
      textScale: 1.25,
      lineHeight: 1.7,
      letterSpacing: 0.02,
      contrast: "high",
      density: "minimal",
      reducedMotion: true,
      showImages: true,
      showVideos: true,
    },
    interaction: {
      minimumTargetSize: 56,
      controlSpacing: 18,
      keyboardOnly: true,
      scanningMode: true,
      scanIntervalMs: 1800,
      eyeGazeMode: false,
      confirmationLevel: "standard",
    },
    workflow: {
      simplifyNavigation: true,
      preferStepByStepForms: true,
      showAdvancedOptions: false,
      hideSecondaryContent: true,
    },
  },
  {
    id: "dark-high-contrast",
    name: "Dark High Contrast",
    isDefault: true,
    presentation: {
      textScale: 1.25,
      lineHeight: 1.65,
      letterSpacing: 0.02,
      contrast: "dark-high",
      density: "comfortable",
      reducedMotion: true,
      showImages: true,
      showVideos: true,
    },
    interaction: {
      minimumTargetSize: 48,
      controlSpacing: 14,
      keyboardOnly: true,
      scanningMode: false,
      scanIntervalMs: 1800,
      eyeGazeMode: false,
      confirmationLevel: "standard",
    },
    workflow: {
      simplifyNavigation: true,
      preferStepByStepForms: false,
      showAdvancedOptions: false,
      hideSecondaryContent: true,
    },
  },
];

export const DEFAULT_AI_SETTINGS: AIProviderSettings = {
  routingMode: "local-only",
  local: {
    enabled: true,
    endpoint: "http://127.0.0.1:11434",
    model: "llama3.2",
    timeoutMs: 15000,
  },
  cloud: {
    enabled: false,
    provider: "openai-compatible",
    endpoint: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    timeoutMs: 20000,
    hasApiKey: false,
  },
  hybridPolicy: {
    preferLocalForAnalysis: true,
    preferLocalForCommands: true,
    allowCloudFallback: false,
    maxRetries: 1,
    maxContextChars: 24000,
  },
};

export const DEFAULT_PRIVACY_SETTINGS: PrivacySettings = {
  allowRemotePageContent: false,
  allowRemoteFormValues: false,
  redactEmailsAndPhones: true,
  enableInteractionLogging: true,
  enableEvaluationTelemetry: false,
  dataRetentionDays: 30,
};

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

export interface AdaptationRecommendation {
  id: string;
  risk: "low" | "workflow";
  requiresUserApproval: boolean;
  reversible: boolean;
  summary: string;
  proposedPatch: Partial<AccessibilityProfile>;
}

/**
 * Modular personalization recommendation interface.
 * Never performs uncontrolled automatic behavioral adaptation: recommendations are reversible and surfaced for consent.
 */
export interface PersonalizationAdvisor {
  suggestAdaptations(
    profile: AccessibilityProfile,
    recentEvents: EvaluationMetricEvent[]
  ): AdaptationRecommendation[];
}

export class ConservativePersonalizationAdvisor implements PersonalizationAdvisor {
  public suggestAdaptations(
    profile: AccessibilityProfile,
    recentEvents: EvaluationMetricEvent[]
  ): AdaptationRecommendation[] {
    const recommendations: AdaptationRecommendation[] = [];
    const failedCount = recentEvents.filter(
      (e) => e.category === "action-failed" || e.category === "repeated-attempt"
    ).length;

    if (failedCount >= 3 && profile.interaction.minimumTargetSize < 56) {
      recommendations.push({
        id: "rec-increase-targets",
        risk: "low",
        requiresUserApproval: true,
        reversible: true,
        summary:
          "You experienced several repeated or failed selections. Would you like to increase button sizes to 56px?",
        proposedPatch: {
          interaction: {
            ...profile.interaction,
            minimumTargetSize: 56,
            controlSpacing: Math.max(profile.interaction.controlSpacing, 18),
          },
        },
      });
    }

    const fallbacks = recentEvents.filter((e) => e.category === "user-fallback-original").length;
    if (fallbacks >= 2 && profile.workflow.hideSecondaryContent) {
      recommendations.push({
        id: "rec-show-secondary",
        risk: "workflow",
        requiresUserApproval: true,
        reversible: true,
        summary:
          "You recently switched to the original website multiple times. Would you like to show secondary page sections by default?",
        proposedPatch: {
          workflow: {
            ...profile.workflow,
            hideSecondaryContent: false,
          },
        },
      });
    }

    return recommendations;
  }
}

export interface SecretStore {
  getSecret(key: string): Promise<string | null>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
}

export class MemorySecretStore implements SecretStore {
  private readonly secrets = new Map<string, string>();
  public async getSecret(key: string): Promise<string | null> {
    return this.secrets.get(key) ?? null;
  }
  public async setSecret(key: string, value: string): Promise<void> {
    this.secrets.set(key, value);
  }
  public async deleteSecret(key: string): Promise<void> {
    this.secrets.delete(key);
  }
}

export class PersonalizationStore {
  private readonly db: Database;
  private readonly dbPath?: string;

  private constructor(db: Database, dbPath?: string) {
    this.db = db;
    this.dbPath = dbPath;
  }

  public static async open(dbPath?: string): Promise<PersonalizationStore> {
    const SQL = await initSqlJs();
    let db: Database;
    if (dbPath && fs.existsSync(dbPath)) {
      const buf = fs.readFileSync(dbPath);
      db = new SQL.Database(buf);
    } else {
      db = new SQL.Database();
    }

    const store = new PersonalizationStore(db, dbPath);
    store.initializeSchema();
    store.ensureDefaults();
    return store;
  }

  private initializeSchema(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        data_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS kv_settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS evaluation_events (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        category TEXT NOT NULL,
        url TEXT,
        duration_ms INTEGER,
        detail TEXT NOT NULL,
        metadata_json TEXT
      );
    `);
    this.persist();
  }

  private ensureDefaults(): void {
    const existing = this.listProfiles();
    if (existing.length === 0) {
      for (const p of DEFAULT_PROFILES) {
        this.saveProfile(p);
      }
    }
    if (!this.getKv<string>("activeProfileId")) {
      this.setKv("activeProfileId", DEFAULT_PROFILES[0]!.id);
    }
    if (!this.getKv<AIProviderSettings>("aiSettings")) {
      this.setKv("aiSettings", DEFAULT_AI_SETTINGS);
    }
    if (!this.getKv<PrivacySettings>("privacySettings")) {
      this.setKv("privacySettings", DEFAULT_PRIVACY_SETTINGS);
    }
    if (!this.getKv<VoiceSettings>("voiceSettings")) {
      this.setKv("voiceSettings", DEFAULT_VOICE_SETTINGS);
    }
  }

  private persist(): void {
    if (!this.dbPath) return;
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const data = this.db.export();
    const tmp = `${this.dbPath}.tmp`;
    fs.writeFileSync(tmp, Buffer.from(data));
    fs.renameSync(tmp, this.dbPath);
  }

  private getKv<T>(key: string): T | null {
    const stmt = this.db.prepare("SELECT value_json FROM kv_settings WHERE key = ?");
    stmt.bind([key]);
    let result: T | null = null;
    if (stmt.step()) {
      const row = stmt.getAsObject() as { value_json?: string };
      if (row.value_json) {
        result = JSON.parse(row.value_json) as T;
      }
    }
    stmt.free();
    return result;
  }

  private setKv(key: string, value: unknown): void {
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO kv_settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`,
      [key, JSON.stringify(value), now]
    );
    this.persist();
  }

  public listProfiles(): AccessibilityProfile[] {
    const stmt = this.db.prepare("SELECT data_json FROM profiles ORDER BY name ASC");
    const profiles: AccessibilityProfile[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { data_json?: string };
      if (row.data_json) {
        const parsed = AccessibilityProfileSchema.safeParse(JSON.parse(row.data_json));
        if (parsed.success) {
          profiles.push(parsed.data);
        }
      }
    }
    stmt.free();
    return profiles;
  }

  public saveProfile(profile: AccessibilityProfile): AccessibilityProfile[] {
    const validated = AccessibilityProfileSchema.parse(profile);
    const now = new Date().toISOString();
    this.db.run(
      `INSERT INTO profiles (id, name, data_json, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, data_json = excluded.data_json, updated_at = excluded.updated_at`,
      [validated.id, validated.name, JSON.stringify(validated), now]
    );
    this.persist();
    return this.listProfiles();
  }

  public deleteProfile(profileId: string): AccessibilityProfile[] {
    const all = this.listProfiles();
    if (all.length <= 1) {
      return all; // Always keep at least one active accessibility profile
    }
    this.db.run("DELETE FROM profiles WHERE id = ?", [profileId]);
    const remaining = this.listProfiles();
    if (this.getActiveProfileId() === profileId && remaining[0]) {
      this.setActiveProfileId(remaining[0].id);
    }
    this.persist();
    return remaining;
  }

  public getActiveProfileId(): string {
    const id = this.getKv<string>("activeProfileId");
    const profiles = this.listProfiles();
    if (id && profiles.some((p) => p.id === id)) return id;
    return profiles[0]?.id ?? DEFAULT_PROFILES[0]!.id;
  }

  public getActiveProfile(): AccessibilityProfile {
    const id = this.getActiveProfileId();
    const profiles = this.listProfiles();
    return profiles.find((p) => p.id === id) ?? DEFAULT_PROFILES[0]!;
  }

  public setActiveProfileId(profileId: string): AccessibilityProfile {
    const profiles = this.listProfiles();
    const match = profiles.find((p) => p.id === profileId);
    if (!match) {
      throw new Error(`Accessibility profile "${profileId}" not found.`);
    }
    this.setKv("activeProfileId", profileId);
    return match;
  }

  public restoreDefaultProfiles(): AccessibilityProfile[] {
    this.db.run("DELETE FROM profiles");
    for (const p of DEFAULT_PROFILES) {
      this.saveProfile(p);
    }
    this.setKv("activeProfileId", DEFAULT_PROFILES[0]!.id);
    this.persist();
    return this.listProfiles();
  }

  public getAISettings(): AIProviderSettings {
    return this.getKv<AIProviderSettings>("aiSettings") ?? DEFAULT_AI_SETTINGS;
  }

  public saveAISettings(settings: AIProviderSettings): AIProviderSettings {
    this.setKv("aiSettings", settings);
    return settings;
  }

  public getPrivacySettings(): PrivacySettings {
    return this.getKv<PrivacySettings>("privacySettings") ?? DEFAULT_PRIVACY_SETTINGS;
  }

  public savePrivacySettings(settings: PrivacySettings): PrivacySettings {
    this.setKv("privacySettings", settings);
    return settings;
  }

  public getVoiceSettings(): VoiceSettings {
    const saved = this.getKv<Partial<VoiceSettings>>("voiceSettings");
    return { ...DEFAULT_VOICE_SETTINGS, ...(saved ?? {}) };
  }

  public saveVoiceSettings(settings: VoiceSettings): VoiceSettings {
    this.setKv("voiceSettings", settings);
    return settings;
  }

  public recordEvent(
    event: Omit<EvaluationMetricEvent, "id" | "timestamp">
  ): EvaluationMetricEvent | null {
    const privacy = this.getPrivacySettings();
    if (!privacy.enableEvaluationTelemetry && event.category !== "user-feedback") {
      return null;
    }
    const full: EvaluationMetricEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    this.db.run(
      `INSERT INTO evaluation_events (id, timestamp, category, url, duration_ms, detail, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        full.id,
        full.timestamp,
        full.category,
        full.url ?? null,
        full.durationMs ?? null,
        full.detail,
        full.metadata ? JSON.stringify(full.metadata) : null,
      ]
    );
    this.persist();
    return full;
  }

  public getRecentEvents(limit = 50): EvaluationMetricEvent[] {
    const stmt = this.db.prepare(
      "SELECT id, timestamp, category, url, duration_ms, detail, metadata_json FROM evaluation_events ORDER BY timestamp DESC LIMIT ?"
    );
    stmt.bind([limit]);
    const events: EvaluationMetricEvent[] = [];
    while (stmt.step()) {
      const r = stmt.getAsObject() as Record<string, unknown>;
      events.push({
        id: String(r.id),
        timestamp: String(r.timestamp),
        category: String(r.category) as EvaluationMetricEvent["category"],
        url: r.url ? String(r.url) : undefined,
        durationMs: typeof r.duration_ms === "number" ? r.duration_ms : undefined,
        detail: String(r.detail),
        metadata: r.metadata_json ? JSON.parse(String(r.metadata_json)) : undefined,
      });
    }
    stmt.free();
    return events;
  }

  public getEventCounts(): Record<string, number> {
    const stmt = this.db.prepare(
      "SELECT category, COUNT(*) as cnt FROM evaluation_events GROUP BY category"
    );
    const counts: Record<string, number> = {};
    while (stmt.step()) {
      const r = stmt.getAsObject() as { category?: string; cnt?: number };
      if (r.category) counts[r.category] = Number(r.cnt ?? 0);
    }
    stmt.free();
    return counts;
  }

  public clearPersonalizationHistory(): void {
    this.db.run("DELETE FROM evaluation_events");
    this.persist();
  }

  public close(): void {
    this.persist();
    this.db.close();
  }
}

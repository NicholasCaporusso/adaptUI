export const SEMANTIC_SCHEMA_VERSION = "1.0.0" as const;
export const UI_SCHEMA_VERSION = "1.0.0" as const;

export type SemanticRegionKind =
  | "main"
  | "navigation"
  | "search"
  | "form"
  | "complementary"
  | "dialog"
  | "status"
  | "alert"
  | "contentinfo"
  | "banner"
  | "section";

export interface ElementReference {
  pageId: string;
  revision: number;
  backendNodeId?: number;
  locator?: string;
  role?: string;
  accessibleName?: string;
  tagName?: string;
  domId?: string;
  nameAttr?: string;
}

export interface ValidationConstraint {
  required?: boolean;
  inputType?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  errorMessage?: string;
  describedByIds?: string[];
}

export interface ProvenanceInfo {
  source: "ax-tree" | "dom" | "merged";
  extractedAt: string;
  confidence: number;
  sanitizedInjectionFlag?: boolean;
}

export interface SemanticRegion {
  id: string;
  kind: SemanticRegionKind;
  label: string;
  primary: boolean;
  elementIds: string[];
  parentRegionId?: string;
}

export interface SemanticElement {
  id: string;
  role: string;
  name: string;
  textContent?: string;
  description?: string;
  value?: string;
  checked?: boolean;
  selected?: boolean;
  href?: string;
  mediaSrc?: string;
  posterSrc?: string;
  mediaAlt?: string;
  inputType?: string;
  options?: Array<{ value: string; label: string; selected?: boolean }>;
  headingLevel?: number;
  tableData?: {
    caption?: string;
    headers: string[];
    rows: string[][];
  };
  listItems?: string[];
  regionId?: string;
  formId?: string;
  labelForElementId?: string;
  errorMessage?: string;
  constraints?: ValidationConstraint;
  visible: boolean;
  enabled: boolean;
  sensitive?: boolean;
  sourceRef?: ElementReference;
  provenance: ProvenanceInfo;
}

export type SemanticActionKind =
  | "click"
  | "fill"
  | "select"
  | "check"
  | "navigate"
  | "submit"
  | "scroll"
  | "back"
  | "forward";

export type ActionRiskLevel = "safe" | "moderate" | "consequential";

export interface SemanticAction {
  id: string;
  label: string;
  kind: SemanticActionKind;
  targetElementId?: string;
  formId?: string;
  href?: string;
  requiresConfirmation: boolean;
  riskLevel: ActionRiskLevel;
  riskReasons: string[];
  preconditions: string[];
  expectedOutcome?: string;
}

export interface SemanticWorkflowStep {
  stepNumber: number;
  title: string;
  description?: string;
  elementIds: string[];
  actionIds: string[];
  required: boolean;
}

export interface SemanticWorkflow {
  id: string;
  title: string;
  kind: "search" | "form" | "information" | "navigation" | "generic";
  formId?: string;
  steps: SemanticWorkflowStep[];
  submitActionId?: string;
}

export interface SemanticPage {
  schemaVersion: string;
  pageId: string;
  url: string;
  title: string;
  purpose?: string;
  revision: number;
  capturedAt: string;
  regions: SemanticRegion[];
  elements: SemanticElement[];
  actions: SemanticAction[];
  workflows: SemanticWorkflow[];
  extractionWarnings: string[];
  unsupportedFeatures: string[];
  confidence: number;
  incomplete: boolean;
  securityFlags: {
    promptInjectionDetected: boolean;
    injectionDetections: string[];
    blockedLinksCount: number;
    sensitiveFieldsRedacted: number;
  };
}

export interface RawAxNode {
  nodeId: string;
  backendDOMNodeId?: number;
  ignored?: boolean;
  role?: string;
  name?: string;
  description?: string;
  value?: string;
  properties?: Record<string, unknown>;
  childIds?: string[];
}

export interface RawDomElement {
  uid: string;
  backendNodeId?: number;
  tagName: string;
  role?: string;
  accessibleName: string;
  textContent: string;
  description?: string;
  idAttr?: string;
  nameAttr?: string;
  inputType?: string;
  value?: string;
  placeholder?: string;
  href?: string;
  mediaSrc?: string;
  posterSrc?: string;
  mediaAlt?: string;
  checked?: boolean;
  required?: boolean;
  disabled?: boolean;
  visible: boolean;
  headingLevel?: number;
  formId?: string;
  regionHint?: SemanticRegionKind;
  regionLabel?: string;
  errorMessage?: string;
  options?: Array<{ value: string; label: string; selected?: boolean }>;
  tableData?: {
    caption?: string;
    headers: string[];
    rows: string[][];
  };
  listItems?: string[];
  autocomplete?: string;
  locator: string;
  ariaLive?: string;
}

export interface BrowserSnapshot {
  pageId: string;
  url: string;
  title: string;
  capturedAt: string;
  axNodes: RawAxNode[];
  domElements: RawDomElement[];
  unsupportedFeatures: string[];
  canGoBack: boolean;
  canGoForward: boolean;
  loadError?: string;
}

export interface BrowserAction {
  id: string;
  kind: SemanticActionKind;
  targetRef?: ElementReference;
  value?: string;
  checked?: boolean;
  url?: string;
  scrollDirection?: "up" | "down" | "top" | "bottom";
  timeoutMs?: number;
}

export interface ActionResult {
  actionId: string;
  success: boolean;
  verified: boolean;
  message: string;
  beforeUrl: string;
  afterUrl: string;
  domChanged: boolean;
  errorCode?:
    | "STALE_ELEMENT"
    | "ELEMENT_NOT_FOUND"
    | "NAVIGATION_BLOCKED"
    | "TIMEOUT"
    | "EXECUTION_ERROR"
    | "CANCELLED"
    | "UNSUPPORTED";
  durationMs: number;
}

export interface BrowserCapabilities {
  adapterName: string;
  supportsCdp: boolean;
  supportsAccessibilityTree: boolean;
  supportsEmbeddedOriginalView: boolean;
  supportsCookiesAndSessions: boolean;
  supportsCancellation: boolean;
}

export interface AccessibilityProfile {
  id: string;
  name: string;
  isDefault?: boolean;
  presentation: {
    textScale: number; // 0.85 to 2.2
    lineHeight: number; // 1.3 to 2.2
    letterSpacing: number; // 0 to 0.12 em
    contrast: "standard" | "high" | "dark-high";
    density: "compact" | "comfortable" | "minimal";
    reducedMotion: boolean;
    showImages: boolean;
    showVideos: boolean;
  };
  interaction: {
    minimumTargetSize: number; // px, e.g. 44, 56, 64
    controlSpacing: number; // px, e.g. 8, 16, 24
    keyboardOnly: boolean;
    scanningMode: boolean;
    scanIntervalMs: number;
    eyeGazeMode: boolean;
    confirmationLevel: "standard" | "enhanced";
  };
  workflow: {
    simplifyNavigation: boolean;
    preferStepByStepForms: boolean;
    showAdvancedOptions: boolean;
    hideSecondaryContent: boolean;
  };
}

export type AIRoutingMode = "local-only" | "cloud-only" | "hybrid";

export interface AIProviderSettings {
  routingMode: AIRoutingMode;
  local: {
    enabled: boolean;
    endpoint: string;
    model: string;
    timeoutMs: number;
  };
  cloud: {
    enabled: boolean;
    provider: "openai-compatible" | "anthropic" | "gemini";
    endpoint: string;
    model: string;
    timeoutMs: number;
    hasApiKey: boolean;
  };
  hybridPolicy: {
    preferLocalForAnalysis: boolean;
    preferLocalForCommands: boolean;
    allowCloudFallback: boolean;
    maxRetries: number;
    maxContextChars: number;
  };
}

export interface PrivacySettings {
  allowRemotePageContent: boolean;
  allowRemoteFormValues: boolean;
  redactEmailsAndPhones: boolean;
  enableInteractionLogging: boolean;
  enableEvaluationTelemetry: boolean;
  dataRetentionDays: number;
}

export type WhisperBackendKind = "onnx-local" | "whisper-http" | "faster-whisper-python";

export type WhisperModelId =
  | "onnx-community/whisper-tiny"
  | "onnx-community/whisper-base.en"
  | "onnx-community/whisper-base"
  | "onnx-community/whisper-small.en"
  | "onnx-community/whisper-small"
  | "onnx-community/whisper-medium"
  | "onnx-community/whisper-large-v3-turbo";

export type VoiceActivationMode = "toggle" | "push-to-talk" | "wake-word" | "manual";

export type VoiceExecutionMode = "auto-execute" | "review-before-run";

export interface VoiceModelOption {
  id: WhisperModelId;
  shortName: string;
  label: string;
  approxSizeMb: number;
  multilingual: boolean;
  recommendedFor: string;
}

export const WHISPER_MODEL_CATALOG: VoiceModelOption[] = [
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

export const VOICE_LANGUAGE_OPTIONS: Array<{ code: string; label: string }> = [
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

export interface VoiceSettings {
  enabled: boolean;
  backend: WhisperBackendKind;
  modelId: WhisperModelId;
  language: string; // "auto" or ISO-639-1 code like "en", "fr", "es", "de", etc.
  activationMode: VoiceActivationMode;
  executionMode: VoiceExecutionMode;
  wakeWord: string;
  silenceStopMs: number;
  silenceThreshold: number;
  dictationEnabled: boolean;
  httpEndpoint: string;
  pythonPath: string;
  pythonDevice: "auto" | "cuda" | "cpu";
}

export interface VoiceTranscriptionResult {
  transcript: string;
  normalizedCommand?: string;
  wakeWordMatched?: boolean;
  backendUsed: string;
  modelId: string;
  language: string;
  durationMs: number;
  error?: string;
}

export interface VoiceStatus {
  backend: WhisperBackendKind;
  modelId: WhisperModelId;
  healthy: boolean;
  modelLoaded: boolean;
  localOnly: boolean;
  detail: string;
  availableModels: VoiceModelOption[];
}

export interface PendingConfirmation {
  confirmationId: string;
  actionId: string;
  label: string;
  consequences: string[];
  riskReasons: string[];
  targetSummary: string;
  createdAt: string;
}

export interface CommandStepExecution {
  stepIndex: number;
  description: string;
  actionId?: string;
  kind: SemanticActionKind | "switch-view" | "clarify";
  status: "completed" | "failed" | "awaiting-confirmation" | "skipped";
  verified: boolean;
  message: string;
}

export interface CommandExecutionResult {
  commandId: string;
  commandText: string;
  status:
    | "completed"
    | "awaiting-confirmation"
    | "needs-clarification"
    | "rejected"
    | "failed";
  summary: string;
  steps: CommandStepExecution[];
  pendingConfirmation?: PendingConfirmation;
  clarificationOptions?: Array<{ id: string; label: string; actionId: string }>;
  requestedViewMode?: "reconstructed" | "original";
  durationMs: number;
  providerUsed: string;
}

export interface EvaluationMetricEvent {
  id: string;
  timestamp: string;
  category:
    | "task-completed"
    | "interaction"
    | "action-failed"
    | "repeated-attempt"
    | "reconstruction-failed"
    | "browser-execution-failed"
    | "user-fallback-original"
    | "user-feedback";
  url?: string;
  durationMs?: number;
  detail: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface DiagnosticsSnapshot {
  telemetryEnabled: boolean;
  totalEvents: number;
  countsByCategory: Record<string, number>;
  recentEvents: EvaluationMetricEvent[];
  aiLogs: Array<{
    timestamp: string;
    providerId: string;
    task: string;
    success: boolean;
    durationMs: number;
    redactedSummary: string;
  }>;
  browserCapabilities: BrowserCapabilities;
}

export type ViewMode = "reconstructed" | "original";

export interface AppStatePayload {
  url: string;
  title: string;
  loading: boolean;
  loadError?: string;
  viewMode: ViewMode;
  canGoBack: boolean;
  canGoForward: boolean;
  semanticPage: SemanticPage | null;
  uiSpec: unknown | null;
  uiSpecErrors: string[];
  activeProfileId: string;
  profiles: AccessibilityProfile[];
  aiSettings: AIProviderSettings;
  privacySettings: PrivacySettings;
  voiceSettings: VoiceSettings;
  lastCommandResult: CommandExecutionResult | null;
  pendingConfirmation: PendingConfirmation | null;
}

export interface AdaptUIIpcApi {
  getInitialState(): Promise<AppStatePayload>;
  navigate(url: string): Promise<AppStatePayload>;
  goBack(): Promise<AppStatePayload>;
  goForward(): Promise<AppStatePayload>;
  reload(): Promise<AppStatePayload>;
  setViewMode(mode: ViewMode): Promise<AppStatePayload>;
  updateViewportBounds(bounds: { x: number; y: number; width: number; height: number }): Promise<void>;
  executeUiAction(payload: {
    actionId: string;
    value?: string;
    checked?: boolean;
    confirmed?: boolean;
  }): Promise<{ state: AppStatePayload; result: ActionResult; pendingConfirmation?: PendingConfirmation }>;
  executeCommand(commandText: string): Promise<{ state: AppStatePayload; result: CommandExecutionResult }>;
  confirmPendingAction(confirmationId: string, approved: boolean): Promise<{ state: AppStatePayload; result: CommandExecutionResult }>;
  saveProfile(profile: AccessibilityProfile): Promise<AccessibilityProfile[]>;
  deleteProfile(profileId: string): Promise<AccessibilityProfile[]>;
  setActiveProfile(profileId: string): Promise<AppStatePayload>;
  restoreDefaultProfiles(): Promise<AppStatePayload>;
  updateAISettings(settings: AIProviderSettings, cloudApiKey?: string): Promise<AIProviderSettings>;
  checkAIHealth(): Promise<{ local: boolean; cloud: boolean; localModels: string[] }>;
  updatePrivacySettings(settings: PrivacySettings): Promise<PrivacySettings>;
  updateVoiceSettings(settings: VoiceSettings): Promise<VoiceSettings>;
  getVoiceStatus(): Promise<VoiceStatus>;
  preloadVoiceModel(): Promise<{ loaded: boolean; modelId: string; message: string }>;
  transcribeAudio(payload: {
    pcm16k: number[];
    sampleRate: number;
    purpose: "command" | "dictation" | "wake-check";
  }): Promise<VoiceTranscriptionResult>;
  clearBrowsingData(): Promise<{ cleared: boolean }>;
  clearPersonalizationData(): Promise<{ cleared: boolean }>;
  recordUserFeedback(rating: "helpful" | "needs-improvement", note: string): Promise<void>;
  getDiagnostics(): Promise<DiagnosticsSnapshot>;
  getFixtureUrls(): Promise<Array<{ label: string; url: string; category: string }>>;
  onStateUpdated(listener: (state: AppStatePayload) => void): () => void;
  onVoiceProgress(
    listener: (progress: { status: string; progress?: number; file?: string }) => void
  ): () => void;
}

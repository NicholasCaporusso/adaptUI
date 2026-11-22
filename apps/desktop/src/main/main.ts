import { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, session } from "electron";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type {
  AccessibilityProfile,
  ActionResult,
  AIProviderSettings,
  AppStatePayload,
  CommandExecutionResult,
  DiagnosticsSnapshot,
  PendingConfirmation,
  PrivacySettings,
  SemanticPage,
  ViewMode,
  VoiceSettings,
} from "@adaptui/shared-types";
import { validateNavigationUrl } from "@adaptui/security";
import { extractSemanticPage, validateSemanticPage } from "@adaptui/semantic-model";
import {
  generateDeterministicUISpec,
  validateAccessibleUISpec,
  type AccessibleUISpec,
} from "@adaptui/ui-schema";
import { ElectronCdpBrowserAdapter } from "@adaptui/browser-core";
import { HybridAIRouter } from "@adaptui/ai-core";
import {
  CloudAIProvider,
  DeterministicMockAIProvider,
  OllamaProvider,
} from "@adaptui/ai-providers";
import { NaturalLanguageCommandAgent } from "@adaptui/command-agent";
import { MockSpeechRecognizer, SpeechRouter } from "@adaptui/speech-core";
import { PersonalizationStore, type SecretStore } from "@adaptui/personalization";

class ElectronSafeSecretStore implements SecretStore {
  private readonly filePath: string;

  constructor(dataDir: string) {
    this.filePath = path.join(dataDir, "credentials.enc.json");
  }

  private readMap(): Record<string, string> {
    if (!fs.existsSync(this.filePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8")) as Record<string, string>;
    } catch {
      return {};
    }
  }

  private writeMap(map: Record<string, string>): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(map, null, 2), { mode: 0o600 });
  }

  public async getSecret(key: string): Promise<string | null> {
    const map = this.readMap();
    const stored = map[key];
    if (!stored) return null;
    if (safeStorage.isEncryptionAvailable()) {
      try {
        return safeStorage.decryptString(Buffer.from(stored, "base64"));
      } catch {
        return null;
      }
    }
    return Buffer.from(stored, "base64").toString("utf8");
  }

  public async setSecret(key: string, value: string): Promise<void> {
    const map = this.readMap();
    if (safeStorage.isEncryptionAvailable()) {
      map[key] = safeStorage.encryptString(value).toString("base64");
    } else {
      map[key] = Buffer.from(value, "utf8").toString("base64");
    }
    this.writeMap(map);
  }

  public async deleteSecret(key: string): Promise<void> {
    const map = this.readMap();
    delete map[key];
    this.writeMap(map);
  }
}

function findFixturesDir(): string {
  const candidates = [
    path.resolve(__dirname, "../../../fixtures"),
    path.resolve(process.cwd(), "fixtures"),
    path.resolve(process.resourcesPath || "", "fixtures"),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "information-site"))) {
      return dir;
    }
  }
  return candidates[0]!;
}

async function startEmbeddedFixtureServer(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const fixturesRoot = findFixturesDir();
  const routes: Record<string, string> = {
    "/info": path.join(fixturesRoot, "information-site"),
    "/search": path.join(fixturesRoot, "search-site"),
    "/form": path.join(fixturesRoot, "form-site"),
    "/adversarial": path.join(fixturesRoot, "adversarial-site"),
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const pathname = url.pathname;
    for (const [prefix, dir] of Object.entries(routes)) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        const rel = pathname.slice(prefix.length).replace(/^\/+/, "") || "index.html";
        const file = path.resolve(dir, rel);
        if (file.startsWith(path.resolve(dir)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
          const ext = path.extname(file).toLowerCase();
          const mimeMap: Record<string, string> = {
            ".html": "text/html; charset=utf-8",
            ".svg": "image/svg+xml",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".webp": "image/webp",
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".css": "text/css; charset=utf-8",
            ".js": "application/javascript; charset=utf-8",
          };
          res.writeHead(200, {
            "Content-Type": mimeMap[ext] || "application/octet-stream",
            "Cache-Control": "no-store",
          });
          fs.createReadStream(file).pipe(res);
          return;
        }
      }
    }
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 4179;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

const AIOrganizationSchema = z.object({
  layout: z.enum(["task", "reading", "search", "form"]).optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
});

let mainWindow: BrowserWindow | null = null;
let webView: WebContentsView | null = null;
let browserAdapter: ElectronCdpBrowserAdapter | null = null;
let store: PersonalizationStore | null = null;
let secretStore: ElectronSafeSecretStore | null = null;
let aiRouter: HybridAIRouter | null = null;
let speechRouter: SpeechRouter | null = null;
let commandAgent = new NaturalLanguageCommandAgent({ maxSteps: 6, stepTimeoutMs: 12000 });
let fixtureServer: { baseUrl: string; close: () => Promise<void> } | null = null;

let currentViewMode: ViewMode = "reconstructed";
let currentViewportBounds = { x: 0, y: 180, width: 1200, height: 600 };
let currentSemanticPage: SemanticPage | null = null;
let currentUISpec: AccessibleUISpec | null = null;
let currentUISpecErrors: string[] = [];
let currentLoading = false;
let currentLoadError: string | undefined;
let lastCommandResult: CommandExecutionResult | null = null;
let pendingUiConfirmation: {
  confirmation: PendingConfirmation;
  actionId: string;
  value?: string;
  checked?: boolean;
} | null = null;

async function rebuildAIRouter(): Promise<void> {
  if (!store || !secretStore) return;
  const settings = store.getAISettings();
  const privacy = store.getPrivacySettings();
  const cloudKey = (await secretStore.getSecret("cloud_api_key")) ?? "";

  const localProvider = settings.local.enabled
    ? new OllamaProvider({
        endpoint: settings.local.endpoint,
        model: settings.local.model,
      })
    : undefined;

  const cloudProvider =
    settings.cloud.enabled && cloudKey
      ? new CloudAIProvider({
          provider: settings.cloud.provider,
          endpoint: settings.cloud.endpoint,
          model: settings.cloud.model,
          apiKey: cloudKey,
        })
      : undefined;

  const mockProvider = new DeterministicMockAIProvider();

  if (!aiRouter) {
    aiRouter = new HybridAIRouter({
      settings,
      privacy,
      localProvider,
      cloudProvider,
      mockProvider,
    });
  } else {
    aiRouter.updateConfig({
      settings,
      privacy,
      localProvider,
      cloudProvider,
      mockProvider,
    });
  }
}

function syncWebViewBounds(): void {
  if (!webView) return;
  if (currentViewMode === "original" && currentViewportBounds.width > 0 && currentViewportBounds.height > 0) {
    webView.setVisible(true);
    webView.setBounds(currentViewportBounds);
  } else {
    webView.setVisible(false);
    webView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
}

function buildStatePayload(): AppStatePayload {
  const activeProfile = store!.getActiveProfile();
  return {
    url: currentSemanticPage?.url || webView?.webContents.getURL() || "",
    title: currentSemanticPage?.title || webView?.webContents.getTitle() || "AdaptUI",
    loading: currentLoading,
    loadError: currentLoadError,
    viewMode: currentViewMode,
    canGoBack: Boolean(webView?.webContents.navigationHistory.canGoBack()),
    canGoForward: Boolean(webView?.webContents.navigationHistory.canGoForward()),
    semanticPage: currentSemanticPage,
    uiSpec: currentUISpec,
    uiSpecErrors: currentUISpecErrors,
    activeProfileId: activeProfile.id,
    profiles: store!.listProfiles(),
    aiSettings: store!.getAISettings(),
    privacySettings: store!.getPrivacySettings(),
    voiceSettings: store!.getVoiceSettings(),
    lastCommandResult,
    pendingConfirmation:
      pendingUiConfirmation?.confirmation ??
      lastCommandResult?.pendingConfirmation ??
      null,
  };
}

function broadcastState(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("adaptui:stateUpdated", buildStatePayload());
  }
}

async function analyzeAndReconstruct(skipAi = false): Promise<void> {
  if (!browserAdapter || !store) return;
  const profile = store.getActiveProfile();
  const snap = await browserAdapter.snapshot();
  const page = extractSemanticPage(snap, currentSemanticPage, {
    confirmationLevel: profile.interaction.confirmationLevel,
  });
  const modelValidation = validateSemanticPage(page);
  if (!modelValidation.valid) {
    page.extractionWarnings.push(...modelValidation.errors);
  }

  currentSemanticPage = page;

  let aiOrg: z.infer<typeof AIOrganizationSchema> | null = null;
  if (!skipAi && aiRouter && store.getAISettings().routingMode !== "local-only") {
    // Only call remote/AI organization when explicitly configured & healthy; deterministic fallback is always guaranteed
    try {
      const resp = await aiRouter.generateStructured({
        task: "ui-organization",
        containsPageContent: true,
        schema: AIOrganizationSchema,
        systemPrompt:
          "Suggest a concise accessible title, layout ('task'|'reading'|'search'|'form'), and one-sentence summary from the page metadata.",
        userPrompt: JSON.stringify({
          title: page.title,
          purpose: page.purpose,
          regionCount: page.regions.length,
          workflows: page.workflows.map((w) => w.kind),
        }),
      });
      aiOrg = resp.data;
    } catch {
      aiOrg = null;
    }
  }

  const candidateSpec = generateDeterministicUISpec(page, profile, aiOrg);
  const specValidation = validateAccessibleUISpec(candidateSpec, page);

  if (specValidation.valid && specValidation.spec) {
    currentUISpec = specValidation.spec;
    currentUISpecErrors = [];
  } else {
    currentUISpec = null;
    currentUISpecErrors = specValidation.errors;
    store.recordEvent({
      category: "reconstruction-failed",
      url: page.url,
      detail: specValidation.errors.join("; "),
    });
  }
}

async function createDesktopApp(): Promise<void> {
  const dataDir = process.env.ADAPTUI_DATA_DIR || app.getPath("userData");
  store = await PersonalizationStore.open(path.join(dataDir, "adaptui.sqlite"));
  secretStore = new ElectronSafeSecretStore(dataDir);
  await rebuildAIRouter();
  const mockVoiceTranscript = process.env.ADAPTUI_MOCK_VOICE_TRANSCRIPT;
  speechRouter = new SpeechRouter({
    settings: store.getVoiceSettings(),
    cacheDir: path.join(dataDir, "whisper-models"),
    mockRecognizer: mockVoiceTranscript
      ? new MockSpeechRecognizer(mockVoiceTranscript.split("||"))
      : undefined,
  });
  fixtureServer = await startEmbeddedFixtureServer();

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    title: "AdaptUI — Accessible AI Browser",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Grant microphone capture ONLY to AdaptUI's own local desktop shell (never to untrusted web pages)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "media" && webContents.getURL().startsWith("file://")) {
      callback(true);
      return;
    }
    callback(false);
  });

  // Dedicated isolated Chromium session for untrusted websites (zero preload / zero Node access)
  const webPartition = session.fromPartition("persist:adaptui-web");
  webView = new WebContentsView({
    webPreferences: {
      session: webPartition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Navigation security boundary on untrusted webView
  webView.webContents.on("will-navigate", (event, navUrl) => {
    const check = validateNavigationUrl(navUrl);
    if (!check.allowed) {
      event.preventDefault();
    }
  });
  webView.webContents.setWindowOpenHandler(({ url }) => {
    const check = validateNavigationUrl(url);
    if (check.allowed && check.normalizedUrl) {
      void webView?.webContents.loadURL(check.normalizedUrl);
    }
    return { action: "deny" };
  });

  mainWindow.contentView.addChildView(webView);
  syncWebViewBounds();

  browserAdapter = new ElectronCdpBrowserAdapter(webView.webContents as any);

  // Keep reconstructed view synchronized if user navigates inside Original Website view
  let refreshTimer: NodeJS.Timeout | null = null;
  const scheduleRefresh = () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      try {
        await analyzeAndReconstruct(true);
        broadcastState();
      } catch {
        // Ignore transient navigation race
      }
    }, 180);
  };

  webView.webContents.on("did-finish-load", () => {
    currentLoading = false;
    currentLoadError = undefined;
    scheduleRefresh();
  });
  webView.webContents.on("did-navigate-in-page", scheduleRefresh);
  webView.webContents.on("did-fail-load", (_e, code, desc, validatedURL) => {
    if (code === -3) return; // ERR_ABORTED
    currentLoading = false;
    currentLoadError = `Failed to load ${validatedURL}: ${desc} (${code})`;
    broadcastState();
  });

  const rendererIndex = path.resolve(__dirname, "../dist-renderer/index.html");
  await mainWindow.loadFile(rendererIndex);

  const initialUrl =
    process.env.ADAPTUI_START_URL || `${fixtureServer.baseUrl}/info/index.html`;
  currentLoading = true;
  await browserAdapter.navigate(initialUrl);
  currentLoading = false;
  await analyzeAndReconstruct(true);
  broadcastState();
}

function registerIpcHandlers(): void {
  ipcMain.handle("adaptui:getInitialState", async () => {
    if (!currentSemanticPage && browserAdapter) {
      await analyzeAndReconstruct(true);
    }
    return buildStatePayload();
  });

  ipcMain.handle("adaptui:getFixtureUrls", async () => {
    const base = fixtureServer?.baseUrl || "http://127.0.0.1:4179";
    return [
      { label: "Information Site", url: `${base}/info/index.html`, category: "Workflow A" },
      { label: "Search Hub", url: `${base}/search/index.html`, category: "Workflow B" },
      { label: "Clinic Form", url: `${base}/form/index.html`, category: "Workflow C" },
      { label: "Security Test", url: `${base}/adversarial/index.html`, category: "Adversarial" },
    ];
  });

  ipcMain.handle("adaptui:navigate", async (_evt, rawUrl: string) => {
    if (!browserAdapter || !store) throw new Error("Browser not initialized");
    const check = validateNavigationUrl(rawUrl);
    if (!check.allowed || !check.normalizedUrl) {
      currentLoadError = check.reason || "Blocked navigation URL";
      return buildStatePayload();
    }
    currentLoading = true;
    currentLoadError = undefined;
    pendingUiConfirmation = null;
    broadcastState();
    try {
      await browserAdapter.navigate(check.normalizedUrl);
      await analyzeAndReconstruct(true);
      store.recordEvent({ category: "interaction", url: check.normalizedUrl, detail: "Navigated to URL" });
    } catch (err) {
      currentLoadError = err instanceof Error ? err.message : String(err);
      store.recordEvent({ category: "browser-execution-failed", url: check.normalizedUrl, detail: currentLoadError });
    } finally {
      currentLoading = false;
    }
    return buildStatePayload();
  });

  ipcMain.handle("adaptui:goBack", async () => {
    if (!browserAdapter) return buildStatePayload();
    await browserAdapter.goBack();
    await analyzeAndReconstruct(true);
    return buildStatePayload();
  });

  ipcMain.handle("adaptui:goForward", async () => {
    if (!browserAdapter) return buildStatePayload();
    await browserAdapter.goForward();
    await analyzeAndReconstruct(true);
    return buildStatePayload();
  });

  ipcMain.handle("adaptui:reload", async () => {
    if (!browserAdapter) return buildStatePayload();
    await browserAdapter.reload();
    await analyzeAndReconstruct(true);
    return buildStatePayload();
  });

  ipcMain.handle("adaptui:setViewMode", async (_evt, mode: ViewMode) => {
    currentViewMode = mode;
    if (mode === "original") {
      store?.recordEvent({
        category: "user-fallback-original",
        url: currentSemanticPage?.url,
        detail: "User switched to Original Website view",
      });
    } else {
      await analyzeAndReconstruct(true);
    }
    syncWebViewBounds();
    return buildStatePayload();
  });

  ipcMain.handle(
    "adaptui:updateViewportBounds",
    async (_evt, bounds: { x: number; y: number; width: number; height: number }) => {
      currentViewportBounds = {
        x: Math.max(0, Math.round(bounds.x)),
        y: Math.max(0, Math.round(bounds.y)),
        width: Math.max(0, Math.round(bounds.width)),
        height: Math.max(0, Math.round(bounds.height)),
      };
      syncWebViewBounds();
    }
  );

  ipcMain.handle(
    "adaptui:executeUiAction",
    async (
      _evt,
      payload: { actionId: string; value?: string; checked?: boolean; confirmed?: boolean }
    ) => {
      if (!browserAdapter || !store || !currentSemanticPage) {
        throw new Error("Application not ready");
      }
      const action = currentSemanticPage.actions.find((a) => a.id === payload.actionId);
      if (!action) {
        const res: ActionResult = {
          actionId: payload.actionId,
          success: false,
          verified: false,
          message: `Action "${payload.actionId}" is no longer available on this page.`,
          beforeUrl: currentSemanticPage.url,
          afterUrl: currentSemanticPage.url,
          domChanged: false,
          errorCode: "STALE_ELEMENT",
          durationMs: 0,
        };
        return { state: buildStatePayload(), result: res };
      }

      if (action.requiresConfirmation && !payload.confirmed) {
        const confirmation: PendingConfirmation = {
          confirmationId: `uiconf-${Date.now()}`,
          actionId: action.id,
          label: action.label,
          consequences: [
            action.expectedOutcome || `Execute "${action.label}"`,
            ...action.riskReasons,
          ],
          riskReasons: action.riskReasons,
          targetSummary: `${action.kind.toUpperCase()}: ${action.label} on ${currentSemanticPage.url}`,
          createdAt: new Date().toISOString(),
        };
        pendingUiConfirmation = {
          confirmation,
          actionId: payload.actionId,
          value: payload.value,
          checked: payload.checked,
        };
        const res: ActionResult = {
          actionId: action.id,
          success: false,
          verified: false,
          message: "Waiting for user confirmation.",
          beforeUrl: currentSemanticPage.url,
          afterUrl: currentSemanticPage.url,
          domChanged: false,
          durationMs: 0,
        };
        return { state: buildStatePayload(), result: res, pendingConfirmation: confirmation };
      }

      const targetEl = action.targetElementId
        ? currentSemanticPage.elements.find((e) => e.id === action.targetElementId)
        : undefined;

      const result = await browserAdapter.execute({
        id: action.id,
        kind: action.kind,
        targetRef: targetEl?.sourceRef,
        value: payload.value,
        checked: payload.checked,
        url: action.kind === "navigate" ? action.href : undefined,
      });

      store.recordEvent({
        category: result.success ? "interaction" : "action-failed",
        url: currentSemanticPage.url,
        durationMs: result.durationMs,
        detail: `${action.kind} "${action.label}": ${result.message}`,
      });

      await analyzeAndReconstruct(true);
      return { state: buildStatePayload(), result };
    }
  );

  ipcMain.handle("adaptui:executeCommand", async (_evt, commandText: string) => {
    if (!browserAdapter || !store || !currentSemanticPage) {
      throw new Error("Application not ready");
    }
    const profile = store.getActiveProfile();
    const privacy = store.getPrivacySettings();

    const { result, updatedPage } = await commandAgent.executeCommand({
      commandText,
      browser: browserAdapter,
      currentPage: currentSemanticPage,
      profile,
      privacy,
      aiRouter: aiRouter ?? undefined,
    });

    currentSemanticPage = updatedPage;
    lastCommandResult = result;
    pendingUiConfirmation = null;

    if (result.requestedViewMode) {
      currentViewMode = result.requestedViewMode;
      syncWebViewBounds();
    }

    const spec = generateDeterministicUISpec(updatedPage, profile);
    const validated = validateAccessibleUISpec(spec, updatedPage);
    currentUISpec = validated.valid && validated.spec ? validated.spec : null;
    currentUISpecErrors = validated.errors;

    store.recordEvent({
      category: result.status === "completed" ? "task-completed" : "action-failed",
      url: updatedPage.url,
      durationMs: result.durationMs,
      detail: `Command "${commandText}" -> ${result.status}`,
    });

    return { state: buildStatePayload(), result };
  });

  ipcMain.handle(
    "adaptui:confirmPendingAction",
    async (_evt, confirmationId: string, approved: boolean) => {
      if (!browserAdapter || !store || !currentSemanticPage) {
        throw new Error("Application not ready");
      }

      // Check UI-triggered pending confirmation first
      if (pendingUiConfirmation && pendingUiConfirmation.confirmation.confirmationId === confirmationId) {
        const pending = pendingUiConfirmation;
        pendingUiConfirmation = null;

        if (!approved) {
          const cancelled: CommandExecutionResult = {
            commandId: confirmationId,
            commandText: pending.confirmation.label,
            status: "rejected",
            summary: `Cancelled "${pending.confirmation.label}".`,
            steps: [],
            durationMs: 0,
            providerUsed: "deterministic",
          };
          lastCommandResult = cancelled;
          return { state: buildStatePayload(), result: cancelled };
        }

        const action = currentSemanticPage.actions.find((a) => a.id === pending.actionId);
        const targetEl = action?.targetElementId
          ? currentSemanticPage.elements.find((e) => e.id === action.targetElementId)
          : undefined;
        const execRes = action
          ? await browserAdapter.execute({
              id: action.id,
              kind: action.kind,
              targetRef: targetEl?.sourceRef,
              value: pending.value,
              checked: pending.checked,
              url: action.kind === "navigate" ? action.href : undefined,
            })
          : null;

        await analyzeAndReconstruct(true);
        const done: CommandExecutionResult = {
          commandId: confirmationId,
          commandText: pending.confirmation.label,
          status: execRes?.success ? "completed" : "failed",
          summary: execRes?.message || "Action could not be completed.",
          steps: [],
          durationMs: execRes?.durationMs ?? 0,
          providerUsed: "deterministic",
        };
        lastCommandResult = done;
        return { state: buildStatePayload(), result: done };
      }

      // Otherwise resolve NL command agent pending confirmation
      const profile = store.getActiveProfile();
      const { result, updatedPage } = await commandAgent.resolvePendingConfirmation({
        confirmationId,
        approved,
        browser: browserAdapter,
        currentPage: currentSemanticPage,
        profile,
      });

      currentSemanticPage = updatedPage;
      lastCommandResult = result;
      const spec = generateDeterministicUISpec(updatedPage, profile);
      const validated = validateAccessibleUISpec(spec, updatedPage);
      currentUISpec = validated.valid && validated.spec ? validated.spec : null;
      currentUISpecErrors = validated.errors;

      return { state: buildStatePayload(), result };
    }
  );

  ipcMain.handle("adaptui:saveProfile", async (_evt, profile: AccessibilityProfile) => {
    const profiles = store!.saveProfile(profile);
    if (store!.getActiveProfileId() === profile.id && currentSemanticPage) {
      await analyzeAndReconstruct(true);
    }
    broadcastState();
    return profiles;
  });

  ipcMain.handle("adaptui:deleteProfile", async (_evt, profileId: string) => {
    const profiles = store!.deleteProfile(profileId);
    if (currentSemanticPage) await analyzeAndReconstruct(true);
    broadcastState();
    return profiles;
  });

  ipcMain.handle("adaptui:setActiveProfile", async (_evt, profileId: string) => {
    store!.setActiveProfileId(profileId);
    if (currentSemanticPage) {
      await analyzeAndReconstruct(true);
    }
    return buildStatePayload();
  });

  ipcMain.handle("adaptui:restoreDefaultProfiles", async () => {
    store!.restoreDefaultProfiles();
    if (currentSemanticPage) {
      await analyzeAndReconstruct(true);
    }
    return buildStatePayload();
  });

  ipcMain.handle(
    "adaptui:updateAISettings",
    async (_evt, settings: AIProviderSettings, cloudApiKey?: string) => {
      if (cloudApiKey && cloudApiKey.trim()) {
        await secretStore!.setSecret("cloud_api_key", cloudApiKey.trim());
        settings = {
          ...settings,
          cloud: { ...settings.cloud, hasApiKey: true },
        };
      }
      store!.saveAISettings(settings);
      await rebuildAIRouter();
      return settings;
    }
  );

  ipcMain.handle("adaptui:checkAIHealth", async () => {
    if (!aiRouter) return { local: false, cloud: false, localModels: [] };
    return aiRouter.healthCheck();
  });

  ipcMain.handle("adaptui:updatePrivacySettings", async (_evt, settings: PrivacySettings) => {
    store!.savePrivacySettings(settings);
    await rebuildAIRouter();
    return settings;
  });

  ipcMain.handle("adaptui:updateVoiceSettings", async (_evt, settings: VoiceSettings) => {
    const saved = store!.saveVoiceSettings(settings);
    speechRouter?.updateSettings(saved);
    broadcastState();
    return saved;
  });

  ipcMain.handle("adaptui:getVoiceStatus", async () => {
    if (!speechRouter) {
      throw new Error("Speech engine not initialized");
    }
    return speechRouter.getStatus();
  });

  ipcMain.handle("adaptui:preloadVoiceModel", async () => {
    if (!speechRouter) {
      throw new Error("Speech engine not initialized");
    }
    return speechRouter.preload((progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("adaptui:voiceProgress", progress);
      }
    });
  });

  ipcMain.handle(
    "adaptui:transcribeAudio",
    async (
      _evt,
      payload: {
        pcm16k: number[];
        sampleRate: number;
        purpose: "command" | "dictation" | "wake-check";
      }
    ) => {
      if (!speechRouter) {
        throw new Error("Speech engine not initialized");
      }
      const audio = Float32Array.from(payload.pcm16k);
      const res = await speechRouter.transcribe({
        audio,
        sampleRate: payload.sampleRate || 16000,
        purpose: payload.purpose,
        onProgress: (progress) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("adaptui:voiceProgress", progress);
          }
        },
      });
      store?.recordEvent({
        category: res.error ? "action-failed" : "interaction",
        url: currentSemanticPage?.url,
        durationMs: res.durationMs,
        detail: res.error
          ? `Local voice transcription error: ${res.error}`
          : `Local voice transcription (${res.backendUsed}, ${res.modelId})`,
      });
      return res;
    }
  );

  ipcMain.handle("adaptui:clearBrowsingData", async () => {
    await browserAdapter?.clearBrowsingData();
    return { cleared: true };
  });

  ipcMain.handle("adaptui:clearPersonalizationData", async () => {
    store!.clearPersonalizationHistory();
    aiRouter?.clearLogs();
    return { cleared: true };
  });

  ipcMain.handle(
    "adaptui:recordUserFeedback",
    async (_evt, rating: "helpful" | "needs-improvement", note: string) => {
      store!.recordEvent({
        category: "user-feedback",
        url: currentSemanticPage?.url,
        detail: `${rating}: ${note || "No comment"}`,
      });
    }
  );

  ipcMain.handle("adaptui:getDiagnostics", async (): Promise<DiagnosticsSnapshot> => {
    const events = store!.getRecentEvents(50);
    return {
      telemetryEnabled: store!.getPrivacySettings().enableEvaluationTelemetry,
      totalEvents: events.length,
      countsByCategory: store!.getEventCounts(),
      recentEvents: events,
      aiLogs: aiRouter?.getLogs() ?? [],
      browserCapabilities: browserAdapter!.capabilities,
    };
  });
}

app.whenReady().then(async () => {
  registerIpcHandlers();
  await createDesktopApp();
});

app.on("window-all-closed", async () => {
  await browserAdapter?.close();
  store?.close();
  await fixtureServer?.close();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

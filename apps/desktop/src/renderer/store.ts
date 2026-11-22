import { create } from "zustand";
import type {
  AccessibilityProfile,
  AIProviderSettings,
  AppStatePayload,
  DiagnosticsSnapshot,
  PrivacySettings,
  ViewMode,
  VoiceSettings,
  VoiceStatus,
} from "@adaptui/shared-types";

declare global {
  interface Window {
    adaptui: import("@adaptui/shared-types").AdaptUIIpcApi;
  }
}

export type ActivePanel =
  | "none"
  | "profiles"
  | "ai-privacy"
  | "voice"
  | "diagnostics"
  | "security";

interface ShellStore {
  appState: AppStatePayload | null;
  fixtures: Array<{ label: string; url: string; category: string }>;
  activePanel: ActivePanel;
  aiSidebarOpen: boolean;
  showStatusBar: boolean;
  diagnostics: DiagnosticsSnapshot | null;
  voiceStatus: VoiceStatus | null;
  voiceProgress: { status: string; progress?: number; file?: string } | null;
  voicePreloading: boolean;
  draftCommandText: string;
  lastTranscript: string;
  statusBanner: string;
  activityMessage: string | null;
  busy: boolean;
  setActivePanel: (panel: ActivePanel) => void;
  setAiSidebarOpen: (open: boolean) => void;
  toggleAiSidebar: () => void;
  setShowStatusBar: (show: boolean) => void;
  toggleStatusBar: () => void;
  setDraftCommandText: (text: string) => void;
  setLastTranscript: (text: string) => void;
  setStatusBanner: (text: string) => void;
  initialize: () => Promise<void>;
  navigate: (url: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  reload: () => Promise<void>;
  setViewMode: (mode: ViewMode) => Promise<void>;
  executeUiAction: (payload: { actionId: string; value?: string; checked?: boolean }) => Promise<void>;
  executeCommand: (text: string) => Promise<void>;
  confirmPending: (confirmationId: string, approved: boolean) => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  saveProfile: (profile: AccessibilityProfile) => Promise<void>;
  deleteProfile: (profileId: string) => Promise<void>;
  restoreDefaultProfiles: () => Promise<void>;
  updateAISettings: (settings: AIProviderSettings, cloudApiKey?: string) => Promise<void>;
  updatePrivacySettings: (settings: PrivacySettings) => Promise<void>;
  updateVoiceSettings: (settings: VoiceSettings) => Promise<void>;
  refreshVoiceStatus: () => Promise<void>;
  preloadVoiceModel: () => Promise<{ loaded: boolean; modelId: string; message: string }>;
  refreshDiagnostics: () => Promise<void>;
}

function readInitialShowStatusBar(): boolean {
  try {
    return window.localStorage.getItem("adaptui:showStatusBar") !== "false";
  } catch {
    return true;
  }
}

export const useShellStore = create<ShellStore>((set, get) => ({
  appState: null,
  fixtures: [],
  activePanel: "none",
  aiSidebarOpen: true,
  showStatusBar: readInitialShowStatusBar(),
  diagnostics: null,
  voiceStatus: null,
  voiceProgress: null,
  voicePreloading: false,
  draftCommandText: "",
  lastTranscript: "",
  statusBanner: "Loading AdaptUI...",
  activityMessage: null,
  busy: false,

  setActivePanel: (panel) => {
    set({ activePanel: panel });
    if (panel === "diagnostics") {
      void get().refreshDiagnostics();
    }
    if (panel === "voice") {
      void get().refreshVoiceStatus();
    }
  },

  setAiSidebarOpen: (open) => set({ aiSidebarOpen: open }),
  toggleAiSidebar: () => set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen })),
  setShowStatusBar: (show) => {
    try {
      window.localStorage.setItem("adaptui:showStatusBar", String(show));
    } catch {}
    set({ showStatusBar: show });
  },
  toggleStatusBar: () => {
    const next = !get().showStatusBar;
    get().setShowStatusBar(next);
  },
  setDraftCommandText: (text) => set({ draftCommandText: text }),
  setLastTranscript: (text) => set({ lastTranscript: text }),
  setStatusBanner: (text) => set({ statusBanner: text }),

  initialize: async () => {
    const [initial, fixtures] = await Promise.all([
      window.adaptui.getInitialState(),
      window.adaptui.getFixtureUrls(),
    ]);
    set({
      appState: initial,
      fixtures,
      statusBanner: `Loaded ${initial.title || initial.url}`,
    });
    window.adaptui.onStateUpdated((nextState) => {
      set({ appState: nextState });
    });
    window.adaptui.onVoiceProgress((progress) => {
      set({ voiceProgress: progress });
    });
  },

  navigate: async (url) => {
    set({
      busy: true,
      activityMessage: `Loading ${url}...`,
      statusBanner: `Navigating to ${url}...`,
    });
    try {
      const next = await window.adaptui.navigate(url);
      set({
        appState: next,
        statusBanner: next.loadError ? next.loadError : `Loaded ${next.title || next.url}`,
      });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  goBack: async () => {
    set({ busy: true, activityMessage: "Returning to previous page..." });
    try {
      const next = await window.adaptui.goBack();
      set({ appState: next, statusBanner: `Navigated back to ${next.title || next.url}` });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  goForward: async () => {
    set({ busy: true, activityMessage: "Moving forward..." });
    try {
      const next = await window.adaptui.goForward();
      set({ appState: next, statusBanner: `Navigated forward to ${next.title || next.url}` });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  reload: async () => {
    set({ busy: true, activityMessage: "Reloading and analyzing page..." });
    try {
      const next = await window.adaptui.reload();
      set({ appState: next, statusBanner: `Reloaded ${next.title || next.url}` });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  setViewMode: async (mode) => {
    const next = await window.adaptui.setViewMode(mode);
    set({
      appState: next,
      statusBanner:
        mode === "original"
          ? "Showing Original Website view (same live browser session)."
          : "Showing Reconstructed Accessible Interface.",
    });
  },

  executeUiAction: async (payload) => {
    set({ busy: true, activityMessage: "Applying action and updating page..." });
    try {
      const res = await window.adaptui.executeUiAction(payload);
      set({
        appState: res.state,
        statusBanner: res.pendingConfirmation
          ? `Confirmation required for "${res.pendingConfirmation.label}".`
          : res.result.message,
      });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  executeCommand: async (text) => {
    set({
      busy: true,
      activityMessage: `Running command: "${text}"...`,
      statusBanner: `Running command: "${text}"...`,
    });
    try {
      const res = await window.adaptui.executeCommand(text);
      set({
        appState: res.state,
        statusBanner: res.result.summary,
      });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  confirmPending: async (confirmationId, approved) => {
    set({
      busy: true,
      activityMessage: approved ? "Executing confirmed action..." : "Cancelling action...",
    });
    try {
      const res = await window.adaptui.confirmPendingAction(confirmationId, approved);
      set({
        appState: res.state,
        statusBanner: res.result.summary,
      });
    } finally {
      set({ busy: false, activityMessage: null });
    }
  },

  setActiveProfile: async (profileId) => {
    const next = await window.adaptui.setActiveProfile(profileId);
    const active = next.profiles.find((p) => p.id === next.activeProfileId);
    set({
      appState: next,
      statusBanner: `Switched accessibility profile to "${active?.name ?? profileId}".`,
    });
  },

  saveProfile: async (profile) => {
    const profiles = await window.adaptui.saveProfile(profile);
    const cur = get().appState;
    if (cur) {
      set({
        appState: { ...cur, profiles },
        statusBanner: `Saved accessibility profile "${profile.name}".`,
      });
    }
  },

  deleteProfile: async (profileId) => {
    const profiles = await window.adaptui.deleteProfile(profileId);
    const cur = get().appState;
    if (cur) {
      set({
        appState: { ...cur, profiles },
        statusBanner: "Deleted accessibility profile.",
      });
    }
  },

  restoreDefaultProfiles: async () => {
    const next = await window.adaptui.restoreDefaultProfiles();
    set({ appState: next, statusBanner: "Restored default accessibility profiles." });
  },

  updateAISettings: async (settings, cloudApiKey) => {
    const saved = await window.adaptui.updateAISettings(settings, cloudApiKey);
    const cur = get().appState;
    if (cur) {
      set({
        appState: { ...cur, aiSettings: saved },
        statusBanner: `Updated AI settings (mode: ${saved.routingMode}).`,
      });
    }
  },

  updatePrivacySettings: async (settings) => {
    const saved = await window.adaptui.updatePrivacySettings(settings);
    const cur = get().appState;
    if (cur) {
      set({
        appState: { ...cur, privacySettings: saved },
        statusBanner: "Updated privacy settings.",
      });
    }
  },

  updateVoiceSettings: async (settings) => {
    const saved = await window.adaptui.updateVoiceSettings(settings);
    const cur = get().appState;
    if (cur) {
      set({
        appState: { ...cur, voiceSettings: saved },
        statusBanner: `Updated voice settings (${saved.modelId}, ${saved.activationMode}).`,
      });
    }
  },

  refreshVoiceStatus: async () => {
    const status = await window.adaptui.getVoiceStatus();
    set({ voiceStatus: status });
  },

  preloadVoiceModel: async () => {
    set({
      voicePreloading: true,
      activityMessage: "Downloading / loading local Whisper speech model...",
    });
    try {
      const res = await window.adaptui.preloadVoiceModel();
      set({ statusBanner: res.message });
      return res;
    } finally {
      set({ voicePreloading: false, activityMessage: null });
    }
  },

  refreshDiagnostics: async () => {
    const diag = await window.adaptui.getDiagnostics();
    set({ diagnostics: diag });
  },
}));

import { contextBridge, ipcRenderer } from "electron";
import type { AdaptUIIpcApi, AppStatePayload } from "@adaptui/shared-types";

const api: AdaptUIIpcApi = {
  getInitialState: () => ipcRenderer.invoke("adaptui:getInitialState"),
  navigate: (url) => ipcRenderer.invoke("adaptui:navigate", url),
  goBack: () => ipcRenderer.invoke("adaptui:goBack"),
  goForward: () => ipcRenderer.invoke("adaptui:goForward"),
  reload: () => ipcRenderer.invoke("adaptui:reload"),
  setViewMode: (mode) => ipcRenderer.invoke("adaptui:setViewMode", mode),
  updateViewportBounds: (bounds) => ipcRenderer.invoke("adaptui:updateViewportBounds", bounds),
  executeUiAction: (payload) => ipcRenderer.invoke("adaptui:executeUiAction", payload),
  executeCommand: (commandText) => ipcRenderer.invoke("adaptui:executeCommand", commandText),
  confirmPendingAction: (confirmationId, approved) =>
    ipcRenderer.invoke("adaptui:confirmPendingAction", confirmationId, approved),
  saveProfile: (profile) => ipcRenderer.invoke("adaptui:saveProfile", profile),
  deleteProfile: (profileId) => ipcRenderer.invoke("adaptui:deleteProfile", profileId),
  setActiveProfile: (profileId) => ipcRenderer.invoke("adaptui:setActiveProfile", profileId),
  restoreDefaultProfiles: () => ipcRenderer.invoke("adaptui:restoreDefaultProfiles"),
  updateAISettings: (settings, cloudApiKey) =>
    ipcRenderer.invoke("adaptui:updateAISettings", settings, cloudApiKey),
  checkAIHealth: () => ipcRenderer.invoke("adaptui:checkAIHealth"),
  updatePrivacySettings: (settings) => ipcRenderer.invoke("adaptui:updatePrivacySettings", settings),
  updateVoiceSettings: (settings) => ipcRenderer.invoke("adaptui:updateVoiceSettings", settings),
  getVoiceStatus: () => ipcRenderer.invoke("adaptui:getVoiceStatus"),
  preloadVoiceModel: () => ipcRenderer.invoke("adaptui:preloadVoiceModel"),
  transcribeAudio: (payload) => ipcRenderer.invoke("adaptui:transcribeAudio", payload),
  clearBrowsingData: () => ipcRenderer.invoke("adaptui:clearBrowsingData"),
  clearPersonalizationData: () => ipcRenderer.invoke("adaptui:clearPersonalizationData"),
  recordUserFeedback: (rating, note) =>
    ipcRenderer.invoke("adaptui:recordUserFeedback", rating, note),
  getDiagnostics: () => ipcRenderer.invoke("adaptui:getDiagnostics"),
  getFixtureUrls: () => ipcRenderer.invoke("adaptui:getFixtureUrls"),
  onStateUpdated: (listener) => {
    const handler = (_evt: Electron.IpcRendererEvent, state: AppStatePayload) => listener(state);
    ipcRenderer.on("adaptui:stateUpdated", handler);
    return () => ipcRenderer.removeListener("adaptui:stateUpdated", handler);
  },
  onVoiceProgress: (listener) => {
    const handler = (
      _evt: Electron.IpcRendererEvent,
      progress: { status: string; progress?: number; file?: string }
    ) => listener(progress);
    ipcRenderer.on("adaptui:voiceProgress", handler);
    return () => ipcRenderer.removeListener("adaptui:voiceProgress", handler);
  },
};

contextBridge.exposeInMainWorld("adaptui", api);

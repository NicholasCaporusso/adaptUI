"use strict";
const electron = require("electron");
const api = {
  getInitialState: () => electron.ipcRenderer.invoke("adaptui:getInitialState"),
  navigate: (url) => electron.ipcRenderer.invoke("adaptui:navigate", url),
  goBack: () => electron.ipcRenderer.invoke("adaptui:goBack"),
  goForward: () => electron.ipcRenderer.invoke("adaptui:goForward"),
  reload: () => electron.ipcRenderer.invoke("adaptui:reload"),
  setViewMode: (mode) => electron.ipcRenderer.invoke("adaptui:setViewMode", mode),
  updateViewportBounds: (bounds) => electron.ipcRenderer.invoke("adaptui:updateViewportBounds", bounds),
  executeUiAction: (payload) => electron.ipcRenderer.invoke("adaptui:executeUiAction", payload),
  executeCommand: (commandText) => electron.ipcRenderer.invoke("adaptui:executeCommand", commandText),
  confirmPendingAction: (confirmationId, approved) => electron.ipcRenderer.invoke("adaptui:confirmPendingAction", confirmationId, approved),
  saveProfile: (profile) => electron.ipcRenderer.invoke("adaptui:saveProfile", profile),
  deleteProfile: (profileId) => electron.ipcRenderer.invoke("adaptui:deleteProfile", profileId),
  setActiveProfile: (profileId) => electron.ipcRenderer.invoke("adaptui:setActiveProfile", profileId),
  restoreDefaultProfiles: () => electron.ipcRenderer.invoke("adaptui:restoreDefaultProfiles"),
  updateAISettings: (settings, cloudApiKey) => electron.ipcRenderer.invoke("adaptui:updateAISettings", settings, cloudApiKey),
  checkAIHealth: () => electron.ipcRenderer.invoke("adaptui:checkAIHealth"),
  updatePrivacySettings: (settings) => electron.ipcRenderer.invoke("adaptui:updatePrivacySettings", settings),
  updateVoiceSettings: (settings) => electron.ipcRenderer.invoke("adaptui:updateVoiceSettings", settings),
  getVoiceStatus: () => electron.ipcRenderer.invoke("adaptui:getVoiceStatus"),
  preloadVoiceModel: () => electron.ipcRenderer.invoke("adaptui:preloadVoiceModel"),
  transcribeAudio: (payload) => electron.ipcRenderer.invoke("adaptui:transcribeAudio", payload),
  clearBrowsingData: () => electron.ipcRenderer.invoke("adaptui:clearBrowsingData"),
  clearPersonalizationData: () => electron.ipcRenderer.invoke("adaptui:clearPersonalizationData"),
  recordUserFeedback: (rating, note) => electron.ipcRenderer.invoke("adaptui:recordUserFeedback", rating, note),
  getDiagnostics: () => electron.ipcRenderer.invoke("adaptui:getDiagnostics"),
  getFixtureUrls: () => electron.ipcRenderer.invoke("adaptui:getFixtureUrls"),
  onStateUpdated: (listener) => {
    const handler = (_evt, state) => listener(state);
    electron.ipcRenderer.on("adaptui:stateUpdated", handler);
    return () => electron.ipcRenderer.removeListener("adaptui:stateUpdated", handler);
  },
  onVoiceProgress: (listener) => {
    const handler = (_evt, progress) => listener(progress);
    electron.ipcRenderer.on("adaptui:voiceProgress", handler);
    return () => electron.ipcRenderer.removeListener("adaptui:voiceProgress", handler);
  }
};
electron.contextBridge.exposeInMainWorld("adaptui", api);
//# sourceMappingURL=preload.cjs.map

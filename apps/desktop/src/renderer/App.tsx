import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibleButton,
  AccessibleDialog,
  AccessibleError,
  AccessibleUIRenderer,
  profileToCssVariables,
} from "@adaptui/accessible-ui";
import type { VoiceSettings, VoiceTranscriptionResult } from "@adaptui/shared-types";
import { useShellStore, type ActivePanel } from "./store";
import { useVoiceCapture } from "./hooks/useVoiceCapture";
import { AICommandSidebar } from "./components/AICommandSidebar";
import { ProfilesPanel } from "./components/ProfilesPanel";
import { AIPrivacyPanel } from "./components/AIPrivacyPanel";
import { VoiceSettingsPanel } from "./components/VoiceSettingsPanel";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { SecurityPanel } from "./components/SecurityPanel";

const SETTINGS_ITEMS: Array<{ id: Exclude<ActivePanel, "none">; label: string }> = [
  { id: "profiles", label: "Profiles" },
  { id: "ai-privacy", label: "AI & Privacy" },
  { id: "voice", label: "Voice & Speech" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "security", label: "Security" },
];

const FALLBACK_VOICE: VoiceSettings = {
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

export const App: React.FC = () => {
  const {
    appState,
    fixtures,
    activePanel,
    aiSidebarOpen,
    showStatusBar,
    statusBanner,
    activityMessage,
    voiceProgress,
    voicePreloading,
    busy,
    setActivePanel,
    setAiSidebarOpen,
    toggleAiSidebar,
    toggleStatusBar,
    setDraftCommandText,
    setLastTranscript,
    setStatusBanner,
    initialize,
    navigate,
    goBack,
    goForward,
    reload,
    setViewMode,
    executeUiAction,
    executeCommand,
    confirmPending,
  } = useShellStore();

  const [urlInput, setUrlInput] = useState("");
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const mainPaneRef = useRef<HTMLDivElement>(null);
  const favoritesWrapRef = useRef<HTMLDivElement>(null);
  const favoritesButtonRef = useRef<HTMLButtonElement>(null);
  const settingsWrapRef = useRef<HTMLDivElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const voiceSettings = appState?.voiceSettings ?? FALLBACK_VOICE;

  const handleVoiceResult = useCallback(
    (result: VoiceTranscriptionResult, purpose: "command" | "dictation" | "wake-check") => {
      setVoiceError("");
      if (!result.transcript) {
        setStatusBanner("No speech detected. Please try speaking again.");
        return;
      }

      setLastTranscript(result.transcript);

      if (purpose === "wake-check" || voiceSettings.activationMode === "wake-word") {
        if (!result.wakeWordMatched) {
          return; // Ignore background speech without wake word
        }
        const cmd = (result.normalizedCommand || "").trim();
        if (!cmd) {
          setStatusBanner(`Wake word "${voiceSettings.wakeWord}" heard. Speak a command.`);
          return;
        }
        if (voiceSettings.executionMode === "auto-execute") {
          void executeCommand(cmd);
        } else {
          setAiSidebarOpen(true);
          setDraftCommandText(cmd);
          setStatusBanner(`Voice command ready for review: "${cmd}"`);
        }
        return;
      }

      const cmd = (result.normalizedCommand || result.transcript).trim();
      if (
        voiceSettings.activationMode === "manual" ||
        voiceSettings.executionMode === "review-before-run"
      ) {
        setAiSidebarOpen(true);
        setDraftCommandText(cmd);
        setStatusBanner(`Heard "${cmd}". Review and click Run Command.`);
      } else {
        void executeCommand(cmd);
      }
    },
    [
      executeCommand,
      setAiSidebarOpen,
      setDraftCommandText,
      setLastTranscript,
      setStatusBanner,
      voiceSettings.activationMode,
      voiceSettings.executionMode,
      voiceSettings.wakeWord,
    ]
  );

  const handleVoiceError = useCallback(
    (msg: string) => {
      setVoiceError(msg);
      setStatusBanner(msg);
    },
    [setStatusBanner]
  );

  const { captureState, audioLevel, startListening, stopListening } = useVoiceCapture({
    settings: voiceSettings,
    onResult: handleVoiceResult,
    onError: handleVoiceError,
  });

  const handleStartCommandVoice = useCallback(() => {
    setVoiceError("");
    void startListening({
      purpose: voiceSettings.activationMode === "wake-word" ? "wake-check" : "command",
      wakeContinuous: voiceSettings.activationMode === "wake-word",
    });
  }, [startListening, voiceSettings.activationMode]);

  const handleDictateField = useCallback(
    (label: string, applyText: (text: string) => void) => {
      setVoiceError("");
      if (captureState === "listening") {
        void stopListening(false);
        return;
      }
      setStatusBanner(`Listening for "${label}"... Speak now (or click Dictate again to stop).`);
      void startListening({
        purpose: "dictation",
        wakeContinuous: false,
        onCustomResult: (res) => {
          if (res.transcript) {
            setLastTranscript(res.transcript);
            applyText(res.transcript);
            setStatusBanner(`Dictated "${res.transcript}" into ${label}.`);
          }
        },
      });
    },
    [captureState, setLastTranscript, setStatusBanner, startListening, stopListening]
  );

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Global keyboard shortcut: Ctrl+Shift+V toggles voice command listening anywhere in AdaptUI
  useEffect(() => {
    const onShortcut = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        if (captureState === "listening" || captureState === "wake-listening") {
          void stopListening(false);
        } else {
          setAiSidebarOpen(true);
          handleStartCommandVoice();
        }
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [captureState, handleStartCommandVoice, setAiSidebarOpen, stopListening]);

  useEffect(() => {
    if (!favoritesOpen && !settingsOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (favoritesOpen && favoritesWrapRef.current && !favoritesWrapRef.current.contains(target)) {
        setFavoritesOpen(false);
      }
      if (settingsOpen && settingsWrapRef.current && !settingsWrapRef.current.contains(target)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (favoritesOpen) {
          setFavoritesOpen(false);
          favoritesButtonRef.current?.focus();
        }
        if (settingsOpen) {
          setSettingsOpen(false);
          settingsButtonRef.current?.focus();
        }
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [favoritesOpen, settingsOpen]);

  useEffect(() => {
    if (appState?.url) {
      setUrlInput(appState.url);
    }
  }, [appState?.url]);

  const pendingConfirmation = appState?.pendingConfirmation ?? null;

  const ongoingProcess = (() => {
    if (voicePreloading) {
      const pct =
        typeof voiceProgress?.progress === "number" ? ` (${voiceProgress.progress}%)` : "";
      return {
        label: `Loading local Whisper model${pct}...`,
        detail: voiceProgress?.file ? `File: ${voiceProgress.file}` : "Preparing offline speech engine",
        progress: voiceProgress?.progress,
      };
    }
    if (captureState === "transcribing") {
      const pct =
        typeof voiceProgress?.progress === "number" ? ` (${voiceProgress.progress}%)` : "";
      return {
        label: `Transcribing speech locally with Whisper${pct}...`,
        detail: "Processing audio on this device",
        progress: voiceProgress?.progress,
      };
    }
    if (activityMessage) {
      return {
        label: activityMessage,
        detail: "Please wait while AdaptUI updates the browser session and accessible view.",
        progress: undefined,
      };
    }
    if (busy || appState?.loading) {
      return {
        label: "Loading website...",
        detail: appState?.url || "Analyzing page structure",
        progress: undefined,
      };
    }
    return null;
  })();

  const hasOngoingProcess = Boolean(ongoingProcess);

  // Keep native WebContentsView bounds aligned with the main viewport slot in Original Website mode,
  // and yield viewport when a modal, top-bar menu, or full-screen transition overlay is active.
  useEffect(() => {
    const syncBounds = () => {
      const el = mainPaneRef.current;
      if (!el || !appState) return;
      if (
        appState.viewMode !== "original" ||
        pendingConfirmation ||
        favoritesOpen ||
        settingsOpen ||
        hasOngoingProcess
      ) {
        void window.adaptui.updateViewportBounds({ x: 0, y: 0, width: 0, height: 0 });
        return;
      }
      const rect = el.getBoundingClientRect();
      void window.adaptui.updateViewportBounds({
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    syncBounds();
    const observer = new ResizeObserver(syncBounds);
    if (mainPaneRef.current) observer.observe(mainPaneRef.current);
    window.addEventListener("resize", syncBounds);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncBounds);
    };
  }, [
    appState?.viewMode,
    activePanel,
    aiSidebarOpen,
    showStatusBar,
    hasOngoingProcess,
    pendingConfirmation,
    favoritesOpen,
    settingsOpen,
  ]);

  if (!appState) {
    return (
      <main className="shell-app" style={{ padding: 24 }}>
        <h1>AdaptUI</h1>
        <p role="status">Starting accessible browser session...</p>
      </main>
    );
  }

  const activeProfile =
    appState.profiles.find((p) => p.id === appState.activeProfileId) ?? appState.profiles[0]!;

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      void navigate(urlInput.trim());
    }
  };

  const handleMenuArrowKeys = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"], [role="menuitemcheckbox"]'
      )
    );
    const idx = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(idx + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(idx - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <div
      className="shell-app aui-root"
      style={profileToCssVariables(activeProfile)}
      data-contrast={activeProfile.presentation.contrast}
      data-density={activeProfile.presentation.density}
      data-reduced-motion={String(activeProfile.presentation.reducedMotion)}
      data-eye-gaze={String(activeProfile.interaction.eyeGazeMode)}
    >
      <a href="#adaptui-main-content" className="skip-link">
        Skip to main content
      </a>

      <header className="shell-toolbar" aria-label="AdaptUI Browser Controls">
        <div className="shell-row">
          <AccessibleButton
            label="Back"
            disabled={!appState.canGoBack || busy}
            onActivate={() => void goBack()}
          />
          <AccessibleButton
            label="Forward"
            disabled={!appState.canGoForward || busy}
            onActivate={() => void goForward()}
          />
          <AccessibleButton label="Reload" disabled={busy} onActivate={() => void reload()} />

          <form
            className="shell-address-form"
            onSubmit={handleAddressSubmit}
            role="search"
            aria-label="Website address bar"
          >
            <label htmlFor="adaptui-url-input" className="skip-link">
              Website URL
            </label>
            <input
              id="adaptui-url-input"
              className="shell-address-input"
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter website URL (https://...)"
              aria-label="Website URL"
            />
            <button type="submit" className="aui-button aui-button-primary" disabled={busy}>
              Go
            </button>
          </form>

          <AccessibleButton
            label={
              appState.viewMode === "reconstructed"
                ? "Original Website"
                : "Reconstructed View"
            }
            variant="primary"
            onActivate={() =>
              void setViewMode(
                appState.viewMode === "reconstructed" ? "original" : "reconstructed"
              )
            }
          />

          <button
            type="button"
            className={`aui-button ${aiSidebarOpen ? "aui-button-primary" : ""}`}
            aria-pressed={aiSidebarOpen}
            aria-controls="adaptui-ai-sidebar"
            onClick={toggleAiSidebar}
          >
            AI assistant
          </button>

          <div className="shell-menu-wrap" ref={favoritesWrapRef}>
            <button
              ref={favoritesButtonRef}
              type="button"
              className={`aui-button ${favoritesOpen ? "aui-button-primary" : ""}`}
              aria-haspopup="menu"
              aria-expanded={favoritesOpen}
              aria-controls="adaptui-favorites-menu"
              disabled={busy}
              onClick={() => {
                setSettingsOpen(false);
                setFavoritesOpen((open) => !open);
              }}
            >
              Favorites
              <span aria-hidden="true">{favoritesOpen ? "▴" : "▾"}</span>
            </button>

            {favoritesOpen && (
              <div
                id="adaptui-favorites-menu"
                role="menu"
                aria-label="Favorites"
                className="shell-menu-dropdown"
                onKeyDown={handleMenuArrowKeys}
              >
                <div className="shell-menu-heading" role="presentation">
                  Demo Sites
                </div>
                {fixtures.length > 0 ? (
                  fixtures.map((f) => (
                    <button
                      key={f.url}
                      type="button"
                      role="menuitem"
                      aria-current={appState.url === f.url ? "page" : undefined}
                      className={`shell-menu-item ${
                        appState.url === f.url ? "shell-menu-item-active" : ""
                      }`}
                      onClick={() => {
                        setFavoritesOpen(false);
                        void navigate(f.url);
                      }}
                    >
                      <span>{f.label}</span>
                      <span className="shell-menu-category">({f.category})</span>
                    </button>
                  ))
                ) : (
                  <div className="shell-menu-empty" role="presentation">
                    No favorites available
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shell-menu-wrap" ref={settingsWrapRef}>
            <button
              ref={settingsButtonRef}
              type="button"
              className={`aui-button ${settingsOpen || activePanel !== "none" ? "aui-button-primary" : ""}`}
              aria-haspopup="menu"
              aria-expanded={settingsOpen}
              aria-controls="adaptui-settings-menu"
              onClick={() => {
                setFavoritesOpen(false);
                setSettingsOpen((open) => !open);
              }}
            >
              Settings
              <span aria-hidden="true">{settingsOpen ? "▴" : "▾"}</span>
            </button>

            {settingsOpen && (
              <div
                id="adaptui-settings-menu"
                role="menu"
                aria-label="Settings"
                className="shell-menu-dropdown"
                onKeyDown={handleMenuArrowKeys}
              >
                <div className="shell-menu-heading" role="presentation">
                  Settings
                </div>
                {SETTINGS_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    aria-current={activePanel === item.id ? "true" : undefined}
                    className={`shell-menu-item ${
                      activePanel === item.id ? "shell-menu-item-active" : ""
                    }`}
                    onClick={() => {
                      setSettingsOpen(false);
                      setActivePanel(activePanel === item.id ? "none" : item.id);
                    }}
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
                <div className="shell-menu-divider" role="separator" />
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={showStatusBar}
                  className="shell-menu-item"
                  onClick={() => {
                    toggleStatusBar();
                  }}
                >
                  <span>Technician Status Bar</span>
                  <span className="shell-switch-pill" aria-hidden="true">
                    {showStatusBar ? "ON" : "OFF"}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="shell-workspace">
        {aiSidebarOpen && (
          <AICommandSidebar
            onClose={() => setAiSidebarOpen(false)}
            captureState={captureState}
            audioLevel={audioLevel}
            voiceError={voiceError}
            onStartVoice={handleStartCommandVoice}
            onStopVoice={(cancel) => void stopListening(Boolean(cancel))}
          />
        )}

        <main
          id="adaptui-main-content"
          ref={mainPaneRef}
          className="shell-main-pane"
          aria-busy={hasOngoingProcess}
          tabIndex={-1}
        >
          {appState.loadError && (
            <div style={{ padding: 16 }}>
              <AccessibleError message={appState.loadError} />
            </div>
          )}

          {appState.viewMode === "reconstructed" ? (
            appState.semanticPage && appState.uiSpec ? (
              <AccessibleUIRenderer
                spec={appState.uiSpec}
                semanticPage={appState.semanticPage}
                profile={activeProfile}
                onAction={(payload) => void executeUiAction(payload)}
                onDictate={
                  voiceSettings.enabled && voiceSettings.dictationEnabled
                    ? handleDictateField
                    : undefined
                }
                onSwitchToOriginal={() => void setViewMode("original")}
              />
            ) : (
              <div style={{ padding: 24 }}>
                <AccessibleError
                  message={
                    appState.uiSpecErrors.length > 0
                      ? `Could not reconstruct this page safely: ${appState.uiSpecErrors.join(" ")}`
                      : "Page could not be reconstructed. You can open the Original Website view."
                  }
                />
                <div style={{ marginTop: 12 }}>
                  <AccessibleButton
                    label="Switch to Original Website"
                    variant="primary"
                    onActivate={() => void setViewMode("original")}
                  />
                </div>
              </div>
            )
          ) : (
            <div className="shell-original-placeholder">
              <p>Original website live view is active in this viewport.</p>
            </div>
          )}
        </main>

        {activePanel === "profiles" && (
          <ProfilesPanel onClose={() => setActivePanel("none")} />
        )}
        {activePanel === "ai-privacy" && (
          <AIPrivacyPanel onClose={() => setActivePanel("none")} />
        )}
        {activePanel === "voice" && (
          <VoiceSettingsPanel onClose={() => setActivePanel("none")} />
        )}
        {activePanel === "diagnostics" && (
          <DiagnosticsPanel onClose={() => setActivePanel("none")} />
        )}
        {activePanel === "security" && (
          <SecurityPanel onClose={() => setActivePanel("none")} />
        )}
      </div>

      {showStatusBar && (
        <footer
          className="shell-status-strip"
          role="status"
          aria-live="polite"
          aria-label="Technician Status Bar"
          data-testid="technician-status-bar"
        >
          <span className="shell-status-message" data-testid="status-banner">
            {statusBanner}
          </span>
          <span className="shell-status-meta">
            Profile: <strong>{activeProfile.name}</strong> | AI:{" "}
            <strong>{appState.aiSettings.routingMode}</strong> | Voice:{" "}
            <strong>
              {voiceSettings.enabled
                ? captureState === "idle"
                  ? voiceSettings.backend
                  : captureState
                : "off"}
            </strong>{" "}
            | View:{" "}
            <strong>{appState.viewMode === "reconstructed" ? "Reconstructed" : "Original"}</strong>
          </span>
        </footer>
      )}

      {ongoingProcess && (
        <div
          className="shell-fullscreen-transition"
          role="status"
          aria-live="polite"
          aria-busy="true"
          data-testid="activity-indicator"
        >
          <div className="shell-transition-card">
            <span className="shell-spinner shell-spinner-lg" aria-hidden="true" />
            <h2 className="shell-transition-title">{ongoingProcess.label}</h2>
            {ongoingProcess.detail && ongoingProcess.detail !== ongoingProcess.label && (
              <p className="shell-transition-detail">{ongoingProcess.detail}</p>
            )}
            <div
              className="shell-progress-track"
              role="progressbar"
              aria-label={ongoingProcess.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ongoingProcess.progress}
            >
              <div
                className={`shell-progress-bar ${
                  typeof ongoingProcess.progress === "number"
                    ? ""
                    : "shell-progress-indeterminate"
                }`}
                style={
                  typeof ongoingProcess.progress === "number"
                    ? { width: `${Math.max(4, Math.min(100, ongoingProcess.progress))}%` }
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      )}

      <AccessibleDialog
        open={Boolean(pendingConfirmation)}
        title="Confirm Consequential Action"
        description={pendingConfirmation?.targetSummary}
        onClose={() => {
          if (pendingConfirmation) {
            void confirmPending(pendingConfirmation.confirmationId, false);
          }
        }}
      >
        {pendingConfirmation && (
          <>
            <p className="aui-text">
              You are about to perform: <strong>{pendingConfirmation.label}</strong>
            </p>
            {pendingConfirmation.consequences.length > 0 && (
              <ul className="aui-list">
                {pendingConfirmation.consequences.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            )}
            <div className="confirm-actions">
              <AccessibleButton
                label="Cancel"
                onActivate={() =>
                  void confirmPending(pendingConfirmation.confirmationId, false)
                }
              />
              <AccessibleButton
                label="Confirm & Execute"
                variant="danger"
                onActivate={() =>
                  void confirmPending(pendingConfirmation.confirmationId, true)
                }
              />
            </div>
          </>
        )}
      </AccessibleDialog>
    </div>
  );
};

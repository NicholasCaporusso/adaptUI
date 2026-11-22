import React from "react";
import { AccessibleButton, AccessibleStatus } from "@adaptui/accessible-ui";
import type { VoiceCaptureState } from "../hooks/useVoiceCapture";
import { useShellStore } from "../store";

const EXAMPLE_COMMANDS = [
  "Find the contact information",
  "Search for assistive technology and open the first result",
  "Go back to the previous page",
  "Show me the original website",
];

export interface AICommandSidebarProps {
  onClose: () => void;
  captureState: VoiceCaptureState;
  audioLevel: number;
  voiceError: string;
  onStartVoice: () => void;
  onStopVoice: (cancel?: boolean) => void;
}

export const AICommandSidebar: React.FC<AICommandSidebarProps> = ({
  onClose,
  captureState,
  audioLevel,
  voiceError,
  onStartVoice,
  onStopVoice,
}) => {
  const {
    appState,
    busy,
    draftCommandText,
    lastTranscript,
    voiceProgress,
    setDraftCommandText,
    setActivePanel,
    executeCommand,
    executeUiAction,
  } = useShellStore();

  if (!appState) return null;

  const lastResult = appState.lastCommandResult;
  const voice = appState.voiceSettings;
  const isListening = captureState === "listening" || captureState === "wake-listening";
  const isTranscribing = captureState === "transcribing";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = draftCommandText.trim();
    if (!cmd) return;
    setDraftCommandText("");
    void executeCommand(cmd);
  };

  const voiceButtonLabel = (() => {
    if (isTranscribing) return "Transcribing locally...";
    if (captureState === "wake-listening") return `Stop Wake-Word ("${voice.wakeWord}")`;
    if (captureState === "listening") return "Stop & Transcribe";
    if (voice.activationMode === "push-to-talk") return "Hold to Speak";
    if (voice.activationMode === "wake-word") return `Start Wake-Word ("${voice.wakeWord}")`;
    if (voice.activationMode === "manual") return "Start Voice Dictation";
    return "Start Voice Command";
  })();

  return (
    <aside
      id="adaptui-ai-sidebar"
      className="shell-ai-sidebar"
      aria-label="AI Command Sidebar"
    >
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>AI Command Assistant</h2>
        <AccessibleButton label="Hide" onActivate={onClose} />
      </div>

      <div className="panel-card" aria-label="Local Voice Commands">
        <div className="voice-header-row">
          <strong>Voice Commands (Local Whisper)</strong>
          <button
            type="button"
            className="shell-pill"
            onClick={() => setActivePanel("voice")}
          >
            Voice Settings
          </button>
        </div>

        {voice.enabled ? (
          <>
            {voice.activationMode === "push-to-talk" ? (
              <button
                type="button"
                className={`aui-button ${isListening ? "aui-button-danger" : "aui-button-primary"}`}
                disabled={busy || isTranscribing}
                onPointerDown={() => {
                  if (captureState === "idle") onStartVoice();
                }}
                onPointerUp={() => {
                  if (isListening) onStopVoice(false);
                }}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat && captureState === "idle") {
                    e.preventDefault();
                    onStartVoice();
                  }
                }}
                onKeyUp={(e) => {
                  if ((e.key === " " || e.key === "Enter") && isListening) {
                    e.preventDefault();
                    onStopVoice(false);
                  }
                }}
              >
                {voiceButtonLabel}
              </button>
            ) : (
              <div className="shell-row">
                <button
                  type="button"
                  className={`aui-button ${isListening ? "aui-button-danger" : "aui-button-primary"}`}
                  style={{ flex: 1 }}
                  disabled={busy || isTranscribing}
                  aria-pressed={isListening}
                  onClick={() => {
                    if (isListening) {
                      onStopVoice(false);
                    } else {
                      onStartVoice();
                    }
                  }}
                >
                  {voiceButtonLabel}
                </button>
                {isListening && (
                  <AccessibleButton label="Cancel" onActivate={() => onStopVoice(true)} />
                )}
              </div>
            )}

            {isListening && (
              <div className="voice-meter-wrap" role="status" aria-live="polite">
                <span>
                  {captureState === "wake-listening"
                    ? `Listening for "${voice.wakeWord}" locally...`
                    : "Listening locally (Ctrl+Shift+V to stop)..."}
                </span>
                <div className="voice-meter-track" aria-hidden="true">
                  <div
                    className="voice-meter-fill"
                    style={{ width: `${Math.max(6, Math.round(audioLevel * 100))}%` }}
                  />
                </div>
              </div>
            )}

            {isTranscribing && (
              <AccessibleStatus
                message={
                  voiceProgress?.progress !== undefined
                    ? `Loading local Whisper model (${voiceProgress.progress}%) and transcribing...`
                    : "Transcribing speech locally with Whisper..."
                }
                tone="info"
              />
            )}

            {voiceError && <AccessibleStatus message={voiceError} tone="warning" />}

            {lastTranscript && (
              <p className="aui-text voice-transcript" data-testid="voice-transcript">
                <strong>Heard:</strong> &ldquo;{lastTranscript}&rdquo;
              </p>
            )}

            <div className="ai-result-meta">
              <span>Mode: {voice.activationMode}</span>
              <span>
                {voice.executionMode === "auto-execute" && voice.activationMode !== "manual"
                  ? "Auto-run"
                  : "Review first"}
              </span>
            </div>
          </>
        ) : (
          <p className="aui-text">
            Voice commands are disabled. Open <strong>Voice Settings</strong> to enable local Whisper.
          </p>
        )}
      </div>

      <form
        className="ai-command-form"
        onSubmit={handleSubmit}
        aria-label="Natural-language command interface"
      >
        <label htmlFor="adaptui-command-input" className="aui-label">
          Enter a command
        </label>
        <input
          id="adaptui-command-input"
          className="shell-command-input"
          type="text"
          value={draftCommandText}
          onChange={(e) => setDraftCommandText(e.target.value)}
          placeholder='e.g. "Find the contact information"'
          aria-label="Natural-language command"
        />
        <button type="submit" className="aui-button aui-button-primary" disabled={busy}>
          Run Command
        </button>
      </form>

      {lastResult?.status === "needs-clarification" &&
        lastResult.clarificationOptions &&
        lastResult.clarificationOptions.length > 0 && (
          <div className="panel-card" role="region" aria-label="Command clarification">
            <strong>Choose target action:</strong>
            <div className="ai-clarification-list">
              {lastResult.clarificationOptions.map((opt) => (
                <AccessibleButton
                  key={opt.id}
                  label={opt.label}
                  variant="primary"
                  onActivate={() => void executeUiAction({ actionId: opt.actionId })}
                />
              ))}
            </div>
          </div>
        )}

      {lastResult && (
        <div className="panel-card" aria-label="Last command result">
          <strong>Latest Command Result</strong>
          <AccessibleStatus
            message={lastResult.summary}
            tone={
              lastResult.status === "completed"
                ? "success"
                : lastResult.status === "awaiting-confirmation" ||
                  lastResult.status === "needs-clarification"
                ? "warning"
                : "info"
            }
          />
          <div className="ai-result-meta">
            <span>Status: {lastResult.status}</span>
            <span>Provider: {lastResult.providerUsed}</span>
          </div>
          {lastResult.steps.length > 0 && (
            <ol className="aui-list">
              {lastResult.steps.map((step) => (
                <li key={step.stepIndex}>
                  <strong>{step.description}</strong> — {step.status}
                  {step.verified ? " (verified)" : ""}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="panel-card">
        <strong>Example Commands</strong>
        <div className="ai-examples-list">
          {EXAMPLE_COMMANDS.map((example) => (
            <button
              key={example}
              type="button"
              className="shell-menu-item"
              disabled={busy}
              onClick={() => setDraftCommandText(example)}
            >
              {example}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};

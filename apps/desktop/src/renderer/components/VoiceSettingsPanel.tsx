import React, { useEffect, useState } from "react";
import {
  VOICE_LANGUAGE_OPTIONS,
  WHISPER_MODEL_CATALOG,
  type VoiceSettings,
  type WhisperBackendKind,
  type WhisperModelId,
} from "@adaptui/shared-types";
import { AccessibleButton, AccessibleStatus } from "@adaptui/accessible-ui";
import { useShellStore } from "../store";

export const VoiceSettingsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    appState,
    voiceStatus,
    voiceProgress,
    updateVoiceSettings,
    refreshVoiceStatus,
    preloadVoiceModel,
  } = useShellStore();

  const [draft, setDraft] = useState<VoiceSettings>(
    structuredClone(appState!.voiceSettings)
  );
  const [message, setMessage] = useState("");
  const [preloading, setPreloading] = useState(false);

  useEffect(() => {
    void refreshVoiceStatus();
  }, [refreshVoiceStatus]);

  const selectedModelMeta =
    WHISPER_MODEL_CATALOG.find((m) => m.id === draft.modelId) ?? WHISPER_MODEL_CATALOG[4]!;

  const handleSave = async () => {
    await updateVoiceSettings(draft);
    await refreshVoiceStatus();
    setMessage("Saved local Whisper voice recognition settings.");
  };

  const handlePreload = async () => {
    setPreloading(true);
    setMessage(`Downloading / loading ${draft.modelId} locally...`);
    try {
      await updateVoiceSettings(draft);
      const res = await preloadVoiceModel();
      setMessage(res.message);
      await refreshVoiceStatus();
    } catch (err) {
      setMessage(`Model load error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPreloading(false);
    }
  };

  return (
    <section className="settings-section-view" aria-label="Voice and Speech Recognition Settings">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Voice &amp; Speech</h2>
        <AccessibleButton label="Close" onActivate={onClose} />
      </div>

      {message && <AccessibleStatus message={message} tone="info" />}

      {voiceProgress && preloading && (
        <AccessibleStatus
          message={`Model progress: ${voiceProgress.status}${
            voiceProgress.file ? ` (${voiceProgress.file})` : ""
          }${typeof voiceProgress.progress === "number" ? ` — ${voiceProgress.progress}%` : ""}`}
          tone="info"
        />
      )}

      <div className="panel-card">
        <strong>100% Local Whisper Speech Recognition</strong>
        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />
          <span>Enable Voice Commands &amp; Local Speech Recognition</span>
        </label>

        {voiceStatus && (
          <AccessibleStatus
            message={`${voiceStatus.healthy ? "Ready" : "Unavailable"}: ${voiceStatus.detail}`}
            tone={voiceStatus.healthy ? "success" : "warning"}
          />
        )}

        <label className="aui-field">
          <span className="aui-label">Local Speech Backend</span>
          <select
            className="aui-select"
            value={draft.backend}
            onChange={(e) =>
              setDraft({ ...draft, backend: e.target.value as WhisperBackendKind })
            }
          >
            <option value="onnx-local">
              Built-in ONNX Whisper (Zero setup, offline in AdaptUI)
            </option>
            <option value="faster-whisper-python">
              Python faster-whisper (CUDA GPU / CPU sidecar)
            </option>
            <option value="whisper-http">
              Local Whisper HTTP Server (whisper.cpp / localhost only)
            </option>
          </select>
        </label>

        <label className="aui-field">
          <span className="aui-label">Whisper Model Size</span>
          <select
            className="aui-select"
            value={draft.modelId}
            onChange={(e) =>
              setDraft({ ...draft, modelId: e.target.value as WhisperModelId })
            }
          >
            {WHISPER_MODEL_CATALOG.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} (~{m.approxSizeMb} MB)
              </option>
            ))}
          </select>
        </label>
        <p className="aui-text" style={{ fontSize: "0.9em" }}>
          <strong>Model note:</strong> {selectedModelMeta.recommendedFor} (
          {selectedModelMeta.multilingual ? "Multilingual" : "English-only"}).
        </p>

        <label className="aui-field">
          <span className="aui-label">Recognition Language</span>
          <select
            className="aui-select"
            value={selectedModelMeta.multilingual ? draft.language : "en"}
            disabled={!selectedModelMeta.multilingual}
            onChange={(e) => setDraft({ ...draft, language: e.target.value })}
          >
            {VOICE_LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>

        {draft.backend === "whisper-http" && (
          <label className="aui-field">
            <span className="aui-label">Local Whisper HTTP Endpoint (localhost/127.0.0.1 only)</span>
            <input
              className="aui-input"
              value={draft.httpEndpoint}
              onChange={(e) => setDraft({ ...draft, httpEndpoint: e.target.value })}
            />
          </label>
        )}

        {draft.backend === "faster-whisper-python" && (
          <div className="panel-grid">
            <label className="aui-field">
              <span className="aui-label">Python Executable</span>
              <input
                className="aui-input"
                value={draft.pythonPath}
                onChange={(e) => setDraft({ ...draft, pythonPath: e.target.value })}
              />
            </label>
            <label className="aui-field">
              <span className="aui-label">Compute Device</span>
              <select
                className="aui-select"
                value={draft.pythonDevice}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    pythonDevice: e.target.value as "auto" | "cuda" | "cpu",
                  })
                }
              >
                <option value="auto">Auto (GPU if available)</option>
                <option value="cuda">NVIDIA CUDA GPU</option>
                <option value="cpu">CPU Only</option>
              </select>
            </label>
          </div>
        )}

        <div className="shell-row">
          <AccessibleButton
            label={preloading ? "Loading Model..." : "Download / Preload Model"}
            disabled={preloading}
            onActivate={() => void handlePreload()}
          />
          <AccessibleButton
            label="Check Backend Health"
            onActivate={() => void refreshVoiceStatus()}
          />
        </div>
      </div>

      <div className="panel-card">
        <strong>Voice Activation &amp; Execution</strong>

        <label className="aui-field">
          <span className="aui-label">Activation Mode</span>
          <select
            className="aui-select"
            value={draft.activationMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                activationMode: e.target.value as VoiceSettings["activationMode"],
              })
            }
          >
            <option value="toggle">Toggle-to-Listen (with silence auto-stop + Ctrl+Shift+V)</option>
            <option value="push-to-talk">Push-to-Talk (hold button while speaking)</option>
            <option value="wake-word">Hands-Free Wake Word (continuous local listening)</option>
            <option value="manual">Manual Start/Stop Dictation (fills command box only)</option>
          </select>
        </label>

        {draft.activationMode === "wake-word" && (
          <label className="aui-field">
            <span className="aui-label">Wake Word Phrase</span>
            <input
              className="aui-input"
              value={draft.wakeWord}
              onChange={(e) => setDraft({ ...draft, wakeWord: e.target.value })}
              placeholder="e.g. adaptui"
            />
          </label>
        )}

        {(draft.activationMode === "toggle" || draft.activationMode === "wake-word") && (
          <label className="aui-field">
            <span className="aui-label">
              Silence Auto-Stop Delay ({(draft.silenceStopMs / 1000).toFixed(1)}s)
            </span>
            <input
              type="range"
              min="800"
              max="4500"
              step="200"
              value={draft.silenceStopMs}
              onChange={(e) =>
                setDraft({ ...draft, silenceStopMs: Number(e.target.value) })
              }
            />
          </label>
        )}

        <label className="aui-field">
          <span className="aui-label">Command Execution Mode</span>
          <select
            className="aui-select"
            value={draft.executionMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                executionMode: e.target.value as VoiceSettings["executionMode"],
              })
            }
          >
            <option value="auto-execute">
              Auto-Execute Safe Commands (consequential actions still require confirmation)
            </option>
            <option value="review-before-run">
              Review Transcript First (populate command box, press Run manually)
            </option>
          </select>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.dictationEnabled}
            onChange={(e) => setDraft({ ...draft, dictationEnabled: e.target.checked })}
          />
          <span>Show &ldquo;Dictate&rdquo; button on non-sensitive form fields</span>
        </label>

        <AccessibleButton
          label="Save Voice Settings"
          variant="primary"
          onActivate={() => void handleSave()}
        />
      </div>
    </section>
  );
};

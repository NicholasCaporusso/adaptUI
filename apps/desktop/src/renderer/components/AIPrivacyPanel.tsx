import React, { useState } from "react";
import type { AIProviderSettings, PrivacySettings } from "@adaptui/shared-types";
import { AccessibleButton, AccessibleStatus } from "@adaptui/accessible-ui";
import { useShellStore } from "../store";

export const AIPrivacyPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { appState, updateAISettings, updatePrivacySettings } = useShellStore();
  const [aiDraft, setAiDraft] = useState<AIProviderSettings>(
    structuredClone(appState!.aiSettings)
  );
  const [privacyDraft, setPrivacyDraft] = useState<PrivacySettings>(
    structuredClone(appState!.privacySettings)
  );
  const [cloudKeyInput, setCloudKeyInput] = useState("");
  const [healthMsg, setHealthMsg] = useState<string>("");

  const checkHealth = async () => {
    setHealthMsg("Checking AI providers...");
    const h = await window.adaptui.checkAIHealth();
    setHealthMsg(
      `Local Ollama: ${h.local ? `Online (${h.localModels.join(", ") || "no models listed"})` : "Offline"} | Cloud: ${
        h.cloud ? "Configured" : "Disabled / Not configured"
      }`
    );
  };

  const clearBrowsing = async () => {
    await window.adaptui.clearBrowsingData();
    setHealthMsg("Cleared isolated browser cookies, storage, and cache.");
  };

  const clearPersonalization = async () => {
    await window.adaptui.clearPersonalizationData();
    setHealthMsg("Cleared local evaluation and AI invocation history.");
  };

  return (
    <section className="settings-section-view" aria-label="AI and Privacy Settings">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>AI &amp; Privacy</h2>
        <AccessibleButton label="Close" onActivate={onClose} />
      </div>

      {healthMsg && <AccessibleStatus message={healthMsg} tone="info" />}

      <div className="panel-card">
        <strong>AI Routing Mode</strong>
        <label className="aui-field">
          <span className="aui-label">Execution Mode</span>
          <select
            className="aui-select"
            value={aiDraft.routingMode}
            onChange={(e) =>
              setAiDraft({
                ...aiDraft,
                routingMode: e.target.value as AIProviderSettings["routingMode"],
              })
            }
          >
            <option value="local-only">Local-Only (Never sends page data remotely)</option>
            <option value="hybrid">Hybrid (Local preferred with policy controls)</option>
            <option value="cloud-only">Cloud-Only (Requires privacy permission)</option>
          </select>
        </label>

        <label className="aui-field">
          <span className="aui-label">Local Ollama Endpoint</span>
          <input
            className="aui-input"
            value={aiDraft.local.endpoint}
            onChange={(e) =>
              setAiDraft({ ...aiDraft, local: { ...aiDraft.local, endpoint: e.target.value } })
            }
          />
        </label>

        <label className="aui-field">
          <span className="aui-label">Local Model Name</span>
          <input
            className="aui-input"
            value={aiDraft.local.model}
            onChange={(e) =>
              setAiDraft({ ...aiDraft, local: { ...aiDraft.local, model: e.target.value } })
            }
          />
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={aiDraft.cloud.enabled}
            onChange={(e) =>
              setAiDraft({ ...aiDraft, cloud: { ...aiDraft.cloud, enabled: e.target.checked } })
            }
          />
          <span>Enable Cloud Provider Adapter</span>
        </label>

        {aiDraft.cloud.enabled && (
          <>
            <label className="aui-field">
              <span className="aui-label">Cloud Provider</span>
              <select
                className="aui-select"
                value={aiDraft.cloud.provider}
                onChange={(e) =>
                  setAiDraft({
                    ...aiDraft,
                    cloud: {
                      ...aiDraft.cloud,
                      provider: e.target.value as AIProviderSettings["cloud"]["provider"],
                    },
                  })
                }
              >
                <option value="openai-compatible">OpenAI-Compatible</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </label>

            <label className="aui-field">
              <span className="aui-label">Cloud API Endpoint</span>
              <input
                className="aui-input"
                value={aiDraft.cloud.endpoint}
                onChange={(e) =>
                  setAiDraft({
                    ...aiDraft,
                    cloud: { ...aiDraft.cloud, endpoint: e.target.value },
                  })
                }
              />
            </label>

            <label className="aui-field">
              <span className="aui-label">Cloud Model</span>
              <input
                className="aui-input"
                value={aiDraft.cloud.model}
                onChange={(e) =>
                  setAiDraft({
                    ...aiDraft,
                    cloud: { ...aiDraft.cloud, model: e.target.value },
                  })
                }
              />
            </label>

            <label className="aui-field">
              <span className="aui-label">
                API Key (stored via OS encryption{aiDraft.cloud.hasApiKey ? " — key saved" : ""})
              </span>
              <input
                className="aui-input"
                type="password"
                placeholder="Enter new API key (leave blank to keep saved key)"
                value={cloudKeyInput}
                onChange={(e) => setCloudKeyInput(e.target.value)}
              />
            </label>
          </>
        )}

        <div className="shell-row">
          <AccessibleButton
            label="Save AI Settings"
            variant="primary"
            onActivate={() => {
              void updateAISettings(aiDraft, cloudKeyInput || undefined);
              setCloudKeyInput("");
            }}
          />
          <AccessibleButton label="Check Provider Health" onActivate={() => void checkHealth()} />
        </div>
      </div>

      <div className="panel-card">
        <strong>Privacy &amp; Data Controls</strong>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={privacyDraft.allowRemotePageContent}
            onChange={(e) =>
              setPrivacyDraft({ ...privacyDraft, allowRemotePageContent: e.target.checked })
            }
          />
          <span>Allow sending sanitized page structure to remote AI providers</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={privacyDraft.redactEmailsAndPhones}
            onChange={(e) =>
              setPrivacyDraft({ ...privacyDraft, redactEmailsAndPhones: e.target.checked })
            }
          />
          <span>Redact email addresses and phone numbers before remote AI</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={privacyDraft.enableEvaluationTelemetry}
            onChange={(e) =>
              setPrivacyDraft({ ...privacyDraft, enableEvaluationTelemetry: e.target.checked })
            }
          />
          <span>Consent to local evaluation metrics logging (for diagnostics)</span>
        </label>

        <AccessibleButton
          label="Save Privacy Settings"
          variant="primary"
          onActivate={() => void updatePrivacySettings(privacyDraft)}
        />

        <div className="shell-row">
          <AccessibleButton
            label="Clear Browsing Data"
            variant="danger"
            onActivate={() => void clearBrowsing()}
          />
          <AccessibleButton
            label="Clear History & Metrics"
            variant="danger"
            onActivate={() => void clearPersonalization()}
          />
        </div>
      </div>
    </section>
  );
};

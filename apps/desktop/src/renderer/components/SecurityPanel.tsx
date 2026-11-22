import React, { useState } from "react";
import { AccessibleButton, AccessibleStatus } from "@adaptui/accessible-ui";
import { useShellStore } from "../store";

export const SecurityPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { appState, saveProfile, setActiveProfile } = useShellStore();
  const [notice, setNotice] = useState("");

  if (!appState) return null;

  const page = appState.semanticPage;
  const flags = page?.securityFlags;
  const activeProfile =
    appState.profiles.find((p) => p.id === appState.activeProfileId) ?? appState.profiles[0];

  const handleConfirmationChange = async (level: "standard" | "enhanced") => {
    if (!activeProfile) return;
    const updated = {
      ...structuredClone(activeProfile),
      interaction: {
        ...activeProfile.interaction,
        confirmationLevel: level,
      },
    };
    await saveProfile(updated);
    await setActiveProfile(updated.id);
    setNotice(
      level === "enhanced"
        ? "Enhanced confirmation enabled: all clicks, links, and submissions require confirmation."
        : "Standard confirmation enabled: consequential actions require confirmation."
    );
  };

  const handleClearBrowsing = async () => {
    await window.adaptui.clearBrowsingData();
    setNotice("Cleared isolated browser cookies, storage, and cache.");
  };

  const scheme = (() => {
    try {
      return new URL(appState.url).protocol;
    } catch {
      return "unknown";
    }
  })();

  return (
    <aside className="shell-side-panel" aria-label="Security">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Security</h2>
        <AccessibleButton label="Close" onActivate={onClose} />
      </div>

      {notice && <AccessibleStatus message={notice} tone="info" />}

      <div className="panel-card">
        <strong>Current Page Security Inspection</strong>
        {flags ? (
          <>
            <AccessibleStatus
              message={
                flags.promptInjectionDetected || flags.blockedLinksCount > 0
                  ? "Active defenses mitigated suspicious content on this page."
                  : "No prompt-injection patterns or unsafe links detected on this page."
              }
              tone={
                flags.promptInjectionDetected || flags.blockedLinksCount > 0
                  ? "warning"
                  : "success"
              }
            />
            <ul className="aui-list">
              <li>URL Scheme: {scheme} (only http: and https: permitted)</li>
              <li>
                Prompt-Injection Defense:{" "}
                {flags.promptInjectionDetected
                  ? `Detected & isolated (${flags.injectionDetections.join(", ")})`
                  : "Clean"}
              </li>
              <li>Blocked Unsafe Links: {flags.blockedLinksCount}</li>
              <li>Sensitive Fields Redacted from AI: {flags.sensitiveFieldsRedacted}</li>
            </ul>
          </>
        ) : (
          <p className="aui-text">No active page inspected yet.</p>
        )}
      </div>

      {activeProfile && (
        <div className="panel-card">
          <strong>Consequential Action Protection</strong>
          <label className="aui-field">
            <span className="aui-label">Confirmation Policy ({activeProfile.name})</span>
            <select
              className="aui-select"
              value={activeProfile.interaction.confirmationLevel}
              onChange={(e) =>
                void handleConfirmationChange(e.target.value as "standard" | "enhanced")
              }
            >
              <option value="standard">
                Standard (payments, deletions, messages, security changes, form submits)
              </option>
              <option value="enhanced">
                Enhanced (confirm all clicks, links, and form submissions)
              </option>
            </select>
          </label>
          <p className="aui-text">
            Webpage instructions can never suppress or bypass explicit user confirmation.
          </p>
        </div>
      )}

      <div className="panel-card">
        <strong>Active Isolation &amp; Trust Boundaries</strong>
        <ul className="aui-list">
          <li>Untrusted pages isolated in sandboxed Chromium partition (`persist:adaptui-web`)</li>
          <li>Zero Node.js, IPC, or credential access exposed to website JavaScript</li>
          <li>Declarative UI schema validator rejects ungrounded controls and scripts</li>
          <li>Cloud API keys encrypted via OS credential storage (`safeStorage`)</li>
        </ul>
        <AccessibleButton
          label="Clear Isolated Browsing Data"
          variant="danger"
          onActivate={() => void handleClearBrowsing()}
        />
      </div>
    </aside>
  );
};

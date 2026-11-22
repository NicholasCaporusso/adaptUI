import React, { useState } from "react";
import { AccessibleButton, AccessibleStatus } from "@adaptui/accessible-ui";
import { useShellStore } from "../store";

export const DiagnosticsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { appState, diagnostics, showStatusBar, setShowStatusBar, refreshDiagnostics } =
    useShellStore();
  const [note, setNote] = useState("");
  const [feedbackSent, setFeedbackSent] = useState("");

  const page = appState?.semanticPage;

  const submitFeedback = async (rating: "helpful" | "needs-improvement") => {
    await window.adaptui.recordUserFeedback(rating, note);
    setNote("");
    setFeedbackSent(`Recorded feedback (${rating}).`);
    await refreshDiagnostics();
  };

  return (
    <section className="settings-section-view" aria-label="Local Diagnostics and Evaluation">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Diagnostics &amp; Model</h2>
        <AccessibleButton label="Close" onActivate={onClose} />
      </div>

      <div className="panel-card">
        <strong>Technician &amp; Debug Display</strong>
        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={showStatusBar}
            onChange={(e) => setShowStatusBar(e.target.checked)}
          />
          <span>Show Bottom Technician Status Bar</span>
        </label>
      </div>

      <div className="panel-card">
        <strong>Semantic Website Model (Shared Source of Truth)</strong>
        {page ? (
          <ul className="aui-list">
            <li>Page ID / Revision: {page.pageId} (rev {page.revision})</li>
            <li>Confidence: {Math.round(page.confidence * 100)}% {page.incomplete ? "(Incomplete)" : "(Complete)"}</li>
            <li>Regions: {page.regions.length} | Elements: {page.elements.length} | Grounded Actions: {page.actions.length}</li>
            <li>Workflows Detected: {page.workflows.map((w) => `${w.kind} (${w.steps.length} steps)`).join(", ") || "None"}</li>
            <li>
              Security Flags: Injection={String(page.securityFlags.promptInjectionDetected)}, Blocked Links=
              {page.securityFlags.blockedLinksCount}, Sensitive Redacted={page.securityFlags.sensitiveFieldsRedacted}
            </li>
          </ul>
        ) : (
          <p className="aui-text">No page analyzed yet.</p>
        )}
      </div>

      {diagnostics && (
        <div className="panel-card">
          <strong>Browser Runtime Capabilities</strong>
          <ul className="aui-list">
            <li>Adapter: {diagnostics.browserCapabilities.adapterName}</li>
            <li>Native CDP: {String(diagnostics.browserCapabilities.supportsCdp)}</li>
            <li>Accessibility Tree: {String(diagnostics.browserCapabilities.supportsAccessibilityTree)}</li>
            <li>Shared Embedded Session: {String(diagnostics.browserCapabilities.supportsEmbeddedOriginalView)}</li>
          </ul>
        </div>
      )}

      <div className="panel-card">
        <strong>Evaluation Metrics (Consent-Gated)</strong>
        <p className="aui-text">
          Telemetry Status: {diagnostics?.telemetryEnabled ? "Enabled (Local SQLite only)" : "Disabled"}
        </p>
        {diagnostics && Object.keys(diagnostics.countsByCategory).length > 0 ? (
          <ul className="aui-list">
            {Object.entries(diagnostics.countsByCategory).map(([cat, count]) => (
              <li key={cat}>
                {cat}: {count}
              </li>
            ))}
          </ul>
        ) : (
          <p className="aui-text">No evaluation metrics recorded yet.</p>
        )}
        <AccessibleButton label="Refresh Diagnostics" onActivate={() => void refreshDiagnostics()} />
      </div>

      <div className="panel-card">
        <strong>Interface Feedback</strong>
        {feedbackSent && <AccessibleStatus message={feedbackSent} tone="success" />}
        <label className="aui-field">
          <span className="aui-label">Optional Feedback Note</span>
          <input
            className="aui-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Describe what worked well or what was hard..."
          />
        </label>
        <div className="shell-row">
          <AccessibleButton label="Helpful" variant="primary" onActivate={() => void submitFeedback("helpful")} />
          <AccessibleButton
            label="Needs Improvement"
            onActivate={() => void submitFeedback("needs-improvement")}
          />
        </div>
      </div>
    </section>
  );
};

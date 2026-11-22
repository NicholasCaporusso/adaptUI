import React from "react";
import { AccessibleButton } from "@adaptui/accessible-ui";
import { useShellStore, type ActivePanel } from "../store";
import { ProfilesPanel } from "./ProfilesPanel";
import { AIPrivacyPanel } from "./AIPrivacyPanel";
import { VoiceSettingsPanel } from "./VoiceSettingsPanel";
import { DiagnosticsPanel } from "./DiagnosticsPanel";
import { SecurityPanel } from "./SecurityPanel";

const SETTINGS_SECTIONS: Array<{ id: Exclude<ActivePanel, "none">; label: string }> = [
  { id: "profiles", label: "Profiles" },
  { id: "ai-privacy", label: "AI & Privacy" },
  { id: "voice", label: "Voice & Speech" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "security", label: "Security" },
];

export interface SettingsPageProps {
  activeSection: Exclude<ActivePanel, "none">;
  onSelectSection: (section: Exclude<ActivePanel, "none">) => void;
  onClose: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  activeSection,
  onSelectSection,
  onClose,
}) => {
  const { showStatusBar, toggleStatusBar } = useShellStore();

  return (
    <div className="settings-page-layout" data-testid="settings-page">
      <nav className="settings-sidebar" aria-label="Settings navigation">
        <div className="settings-sidebar-header">
          <h1 className="settings-sidebar-title">Settings</h1>
        </div>

        <ul className="settings-sidebar-list">
          {SETTINGS_SECTIONS.map((section) => {
            const isActive = activeSection === section.id;
            return (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  className={`shell-menu-item ${isActive ? "shell-menu-item-active" : ""}`}
                  onClick={() => onSelectSection(section.id)}
                >
                  <span>{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="shell-menu-divider" role="separator" />

        <button
          type="button"
          role="switch"
          aria-checked={showStatusBar}
          className="shell-menu-item"
          onClick={toggleStatusBar}
        >
          <span>Technician Status Bar</span>
          <span className="shell-switch-pill" aria-hidden="true">
            {showStatusBar ? "ON" : "OFF"}
          </span>
        </button>

        <div className="settings-sidebar-footer">
          <AccessibleButton label="Back to Page" onActivate={onClose} />
        </div>
      </nav>

      <div className="settings-content">
        {activeSection === "profiles" && <ProfilesPanel onClose={onClose} />}
        {activeSection === "ai-privacy" && <AIPrivacyPanel onClose={onClose} />}
        {activeSection === "voice" && <VoiceSettingsPanel onClose={onClose} />}
        {activeSection === "diagnostics" && <DiagnosticsPanel onClose={onClose} />}
        {activeSection === "security" && <SecurityPanel onClose={onClose} />}
      </div>
    </div>
  );
};

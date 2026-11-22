import React, { useState } from "react";
import type { AccessibilityProfile } from "@adaptui/shared-types";
import { AccessibleButton } from "@adaptui/accessible-ui";
import { useShellStore } from "../store";

export const ProfilesPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const {
    appState,
    setActiveProfile,
    saveProfile,
    deleteProfile,
    restoreDefaultProfiles,
  } = useShellStore();

  const profiles = appState?.profiles ?? [];
  const activeProfile =
    profiles.find((p) => p.id === appState?.activeProfileId) ?? profiles[0];

  const [draft, setDraft] = useState<AccessibilityProfile | null>(
    activeProfile ? structuredClone(activeProfile) : null
  );

  if (!draft) return null;

  const selectForEdit = async (profile: AccessibilityProfile) => {
    setDraft(structuredClone(profile));
    await setActiveProfile(profile.id);
  };

  const createCustomProfile = async () => {
    const newProfile: AccessibilityProfile = {
      ...structuredClone(draft),
      id: `custom-${Date.now()}`,
      name: `Custom Profile ${profiles.length + 1}`,
      isDefault: false,
    };
    await saveProfile(newProfile);
    await setActiveProfile(newProfile.id);
    setDraft(newProfile);
  };

  const handleSave = async () => {
    await saveProfile(draft);
    await setActiveProfile(draft.id);
  };

  return (
    <section className="settings-section-view" aria-label="Accessibility Profiles">
      <div className="panel-header">
        <h2 style={{ margin: 0 }}>Accessibility Profiles</h2>
        <AccessibleButton label="Close" onActivate={onClose} />
      </div>

      <div className="panel-card">
        <strong>Switch Active Profile</strong>
        <div className="shell-row">
          {profiles.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`shell-pill ${p.id === appState?.activeProfileId ? "shell-pill-active" : ""}`}
              onClick={() => void selectForEdit(p)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="shell-row">
          <AccessibleButton label="New Custom Profile" onActivate={() => void createCustomProfile()} />
          <AccessibleButton
            label="Restore Defaults"
            onActivate={() => void restoreDefaultProfiles()}
          />
        </div>
      </div>

      <div className="panel-card">
        <strong>Edit Profile: {draft.name}</strong>

        <label className="aui-field">
          <span className="aui-label">Profile Name</span>
          <input
            className="aui-input"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>

        <div className="panel-grid">
          <label className="aui-field">
            <span className="aui-label">Text Scale ({draft.presentation.textScale}x)</span>
            <input
              type="range"
              min="0.9"
              max="2.0"
              step="0.05"
              value={draft.presentation.textScale}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  presentation: { ...draft.presentation, textScale: Number(e.target.value) },
                })
              }
            />
          </label>

          <label className="aui-field">
            <span className="aui-label">Min Target ({draft.interaction.minimumTargetSize}px)</span>
            <input
              type="range"
              min="44"
              max="84"
              step="4"
              value={draft.interaction.minimumTargetSize}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  interaction: {
                    ...draft.interaction,
                    minimumTargetSize: Number(e.target.value),
                  },
                })
              }
            />
          </label>
        </div>

        <div className="panel-grid">
          <label className="aui-field">
            <span className="aui-label">Contrast</span>
            <select
              className="aui-select"
              value={draft.presentation.contrast}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  presentation: {
                    ...draft.presentation,
                    contrast: e.target.value as AccessibilityProfile["presentation"]["contrast"],
                  },
                })
              }
            >
              <option value="standard">Standard (AA)</option>
              <option value="high">High Contrast (Light)</option>
              <option value="dark-high">High Contrast (Dark)</option>
            </select>
          </label>

          <label className="aui-field">
            <span className="aui-label">Density</span>
            <select
              className="aui-select"
              value={draft.presentation.density}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  presentation: {
                    ...draft.presentation,
                    density: e.target.value as AccessibilityProfile["presentation"]["density"],
                  },
                })
              }
            >
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
        </div>

        <label className="aui-field">
          <span className="aui-label">Control Spacing ({draft.interaction.controlSpacing}px)</span>
          <input
            type="range"
            min="6"
            max="32"
            step="2"
            value={draft.interaction.controlSpacing}
            onChange={(e) =>
              setDraft({
                ...draft,
                interaction: { ...draft.interaction, controlSpacing: Number(e.target.value) },
              })
            }
          />
        </label>

        <label className="aui-field">
          <span className="aui-label">Confirmation Level</span>
          <select
            className="aui-select"
            value={draft.interaction.confirmationLevel}
            onChange={(e) =>
              setDraft({
                ...draft,
                interaction: {
                  ...draft.interaction,
                  confirmationLevel: e.target.value as "standard" | "enhanced",
                },
              })
            }
          >
            <option value="standard">Standard (consequential actions)</option>
            <option value="enhanced">Enhanced (all clicks, links, submits)</option>
          </select>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.presentation.showImages}
            onChange={(e) =>
              setDraft({
                ...draft,
                presentation: { ...draft.presentation, showImages: e.target.checked },
              })
            }
          />
          <span>Show Images (comfortable accessible sizing &amp; captions)</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.presentation.showVideos}
            onChange={(e) =>
              setDraft({
                ...draft,
                presentation: { ...draft.presentation, showVideos: e.target.checked },
              })
            }
          />
          <span>Show Videos (user-controlled playback, no autoplay)</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.presentation.reducedMotion}
            onChange={(e) =>
              setDraft({
                ...draft,
                presentation: { ...draft.presentation, reducedMotion: e.target.checked },
              })
            }
          />
          <span>Reduced Motion</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.interaction.eyeGazeMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                interaction: { ...draft.interaction, eyeGazeMode: e.target.checked },
              })
            }
          />
          <span>Eye-Gaze Compatible Control Layout</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.interaction.scanningMode}
            onChange={(e) =>
              setDraft({
                ...draft,
                interaction: { ...draft.interaction, scanningMode: e.target.checked },
              })
            }
          />
          <span>Switch Scanning Focus Mode</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.workflow.preferStepByStepForms}
            onChange={(e) =>
              setDraft({
                ...draft,
                workflow: { ...draft.workflow, preferStepByStepForms: e.target.checked },
              })
            }
          />
          <span>Prefer Step-by-Step Forms</span>
        </label>

        <label className="aui-checkbox-label">
          <input
            type="checkbox"
            checked={draft.workflow.hideSecondaryContent}
            onChange={(e) =>
              setDraft({
                ...draft,
                workflow: { ...draft.workflow, hideSecondaryContent: e.target.checked },
              })
            }
          />
          <span>Hide Secondary Sidebar/Promotional Content</span>
        </label>

        <div className="shell-row">
          <AccessibleButton label="Save Profile" variant="primary" onActivate={() => void handleSave()} />
          {!draft.isDefault && profiles.length > 1 && (
            <AccessibleButton
              label="Delete Profile"
              variant="danger"
              onActivate={() => void deleteProfile(draft.id)}
            />
          )}
        </div>
      </div>
    </section>
  );
};

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  ConservativePersonalizationAdvisor,
  DEFAULT_PROFILES,
  PersonalizationStore,
} from "@adaptui/personalization";

describe("Personalization Store (SQLite) & Reversible Advisor", () => {
  it("persists profiles, active selection, and consent-gated telemetry to SQLite on disk", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "adaptui-test-"));
    const dbPath = path.join(tmpDir, "adaptui.sqlite");

    try {
      const store = await PersonalizationStore.open(dbPath);
      expect(store.listProfiles().length).toBe(DEFAULT_PROFILES.length);

      const custom = {
        ...structuredClone(DEFAULT_PROFILES[0]!),
        id: "custom-als-test",
        name: "My ALS Setup",
        isDefault: false,
      };
      custom.interaction.minimumTargetSize = 72;
      store.saveProfile(custom);
      store.setActiveProfileId("custom-als-test");

      // Telemetry disabled by default -> should not record non-feedback events
      expect(
        store.recordEvent({ category: "interaction", detail: "should be ignored" })
      ).toBeNull();

      // Enable consent -> records events
      store.savePrivacySettings({
        ...store.getPrivacySettings(),
        enableEvaluationTelemetry: true,
      });
      const recorded = store.recordEvent({
        category: "action-failed",
        detail: "Missed button target",
      });
      expect(recorded).not.toBeNull();
      store.close();

      // Reopen from SQLite file and confirm persistence
      const reopened = await PersonalizationStore.open(dbPath);
      expect(reopened.getActiveProfileId()).toBe("custom-als-test");
      expect(reopened.getActiveProfile().interaction.minimumTargetSize).toBe(72);
      expect(reopened.getRecentEvents().length).toBe(1);

      reopened.deleteProfile("custom-als-test");
      expect(reopened.listProfiles().some((p) => p.id === "custom-als-test")).toBe(false);

      reopened.clearPersonalizationHistory();
      expect(reopened.getRecentEvents()).toHaveLength(0);
      reopened.close();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("produces only reversible, user-approved adaptation recommendations", () => {
    const advisor = new ConservativePersonalizationAdvisor();
    const events = [1, 2, 3].map((n) => ({
      id: `e-${n}`,
      timestamp: new Date().toISOString(),
      category: "action-failed" as const,
      detail: "Miss",
    }));
    const recs = advisor.suggestAdaptations(DEFAULT_PROFILES[0]!, events);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.requiresUserApproval && r.reversible)).toBe(true);
  });
});

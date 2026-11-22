import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

test.describe("Real-World Public Website Integration Demonstration (example.com)", () => {
  test("navigates to https://example.com, extracts semantic model, reconstructs UI, and supports original fallback", async () => {
    const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "adaptui-public-e2e-"));
    const appPath = path.resolve(__dirname, "../../apps/desktop");

    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        ADAPTUI_DATA_DIR: tmpDataDir,
        ADAPTUI_START_URL: "https://example.com",
      },
    });

    try {
      const window = await electronApp.firstWindow();
      await window.waitForLoadState("domcontentloaded");

      // Reconstructed interface displays Example Domain heading & essential link
      await expect(
        window.getByRole("heading", { name: /Example Domain/i }).first()
      ).toBeVisible({ timeout: 20_000 });

      // Diagnostics (via Settings menu) confirms real semantic extraction & CDP capabilities
      await window.getByRole("button", { name: "Settings", exact: true }).click();
      await window.getByRole("menu", { name: "Settings" }).getByRole("menuitem", { name: "Diagnostics" }).click();
      await expect(window.getByText(/ElectronCdpBrowserAdapter/i)).toBeVisible();
      await expect(window.getByText(/Native CDP: true/i)).toBeVisible();
      await window.getByRole("button", { name: "Close" }).click();

      // Switch to View Original and back to View Adapted
      await window.getByRole("button", { name: "View Original", exact: true }).click();
      await expect(window.getByText(/Original website live view is active/i)).toBeVisible();
      await window.getByRole("button", { name: "View Adapted", exact: true }).click();
      await expect(
        window.getByRole("heading", { name: /Example Domain/i }).first()
      ).toBeVisible();
    } finally {
      await electronApp.close();
      fs.rmSync(tmpDataDir, { recursive: true, force: true });
    }
  });
});

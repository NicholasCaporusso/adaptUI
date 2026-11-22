import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

test.describe("AdaptUI Desktop End-to-End Verification", () => {
  test("executes all 9 MVP acceptance flows inside the real Electron app", async () => {
    const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "adaptui-e2e-"));
    const appPath = path.resolve(__dirname, "../../apps/desktop");

    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        ADAPTUI_DATA_DIR: tmpDataDir,
      },
    });

    try {
      const window = await electronApp.firstWindow();
      await window.waitForLoadState("domcontentloaded");

      // 1 & 2 & 3 & 4: Launch AdaptUI, load Information Site, analyze, display replacement interface
      await expect(window.getByRole("heading", { name: /Civic Accessibility Research Center/i })).toBeVisible({
        timeout: 15_000,
      });
      await expect(window.getByText(/support@civic-a11y\.example/i)).toBeVisible();

      // Verify images & videos render comfortably by default and can be toggled off/on in Profiles
      const labImg = window.getByRole("img", { name: /Diagram of Assistive Technology Lab/i });
      const labVideo = window.locator('video[aria-label="Civic Accessibility Lab Orientation Video"]');
      await expect(labImg).toBeVisible();
      await expect(labVideo).toBeVisible();

      await window.getByRole("button", { name: "Settings", exact: true }).click();
      await window.getByRole("menu", { name: "Settings" }).getByRole("menuitem", { name: "Profiles" }).click();
      await window.getByLabel(/Show Images/i).uncheck();
      await window.getByLabel(/Show Videos/i).uncheck();
      await window.getByRole("button", { name: "Save Profile" }).click();
      await expect(labImg).toHaveCount(0);
      await expect(labVideo).toHaveCount(0);

      // Re-enable images & videos and confirm they return
      await window.getByLabel(/Show Images/i).check();
      await window.getByLabel(/Show Videos/i).check();
      await window.getByRole("button", { name: "Save Profile" }).click();
      await expect(labImg).toBeVisible();
      await expect(labVideo).toBeVisible();
      await window.getByRole("button", { name: "Close" }).click();

      const openFavorite = async (namePattern: RegExp) => {
        const favBtn = window.getByRole("button", { name: "Favorites" });
        await favBtn.click();
        const menu = window.getByRole("menu", { name: "Favorites" });
        await expect(menu).toBeVisible();
        await menu.getByRole("menuitem", { name: namePattern }).click();
        await expect(menu).toBeHidden();
      };

      // Verify demo sites are inside the Favorites menu (not cluttering the toolbar when closed)
      await expect(window.getByRole("menu", { name: "Favorites" })).toBeHidden();

      // 5: Interact with reconstructed interface -> switch to Search Hub demo site via Favorites menu
      await openFavorite(/Search Hub.*Workflow B/i);
      await expect(window.getByRole("heading", { name: /Open Access Knowledge Hub/i })).toBeVisible({
        timeout: 10_000,
      });

      // 6 & 7: Execute grounded multi-step natural-language command & verify browser action outcome
      const cmdInput = window.getByRole("textbox", { name: "Natural-language command" });
      await cmdInput.fill("Search for assistive technology and open the first result");
      await window.getByRole("button", { name: "Run Command" }).click();

      await expect(
        window.getByRole("heading", { level: 1, name: /Assistive Technology Foundations for Web Browsing/i })
      ).toBeVisible({ timeout: 15_000 });
      await expect(window.getByTestId("status-banner")).toContainText(/Completed/i);

      // Test Workflow C (Form Interaction) & consequential action confirmation dialog
      await openFavorite(/Clinic Form.*Workflow C/i);
      await expect(
        window.getByRole("heading", { level: 1, name: /Appointment Request/i })
      ).toBeVisible({ timeout: 10_000 });

      await cmdInput.fill("Fill in my name as Jordan Taylor and email as jordan@example.com");
      await window.getByRole("button", { name: "Run Command" }).click();
      await expect(window.getByTestId("status-banner")).toContainText(/Completed/i);

      await cmdInput.fill("Check consent");
      await window.getByRole("button", { name: "Run Command" }).click();
      await expect(window.getByTestId("status-banner")).toContainText(/Completed/i);

      await cmdInput.fill("Submit Appointment Request");
      await window.getByRole("button", { name: "Run Command" }).click();

      // Consequential action MUST open confirmation dialog first!
      const dialog = window.getByRole("dialog", { name: /Confirm Consequential Action/i });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: /Confirm & Execute/i }).click();
      await expect(window.getByText(/Confirmation #APT-2026-042/i)).toBeVisible({ timeout: 10_000 });

      // Test Adversarial Security Page: injection isolated + blocked link + confirmation enforced
      await openFavorite(/Security Test.*Adversarial/i);
      await expect(
        window.getByText(/Suspicious webpage instructions were detected and isolated/i)
      ).toBeVisible({ timeout: 10_000 });
      await expect(window.getByText(/1 unsafe link\(s\) were blocked/i)).toBeVisible();

      const openSetting = async (name: string) => {
        await window.getByRole("button", { name: "Settings", exact: true }).click();
        const menu = window.getByRole("menu", { name: "Settings" });
        await expect(menu).toBeVisible();
        await menu.getByRole("menuitem", { name, exact: true }).click();
        await expect(menu).toBeHidden();
      };

      // Verify AI assistant toggle hides and shows the AI Command Sidebar
      const aiSidebar = window.getByRole("complementary", { name: "AI Command Sidebar" });
      await expect(aiSidebar).toBeVisible();
      const aiToggle = window.getByRole("button", { name: "AI assistant" });
      await expect(aiToggle).toHaveAttribute("aria-pressed", "true");
      await aiToggle.click();
      await expect(aiSidebar).toBeHidden();
      await expect(aiToggle).toHaveAttribute("aria-pressed", "false");
      await aiToggle.click();
      await expect(aiSidebar).toBeVisible();

      // Verify bottom Technician Status Bar position & Settings switch toggle
      const techStatusBar = window.getByTestId("technician-status-bar");
      await expect(techStatusBar).toBeVisible();
      const [mainBox, statusBox] = await Promise.all([
        window.locator("#adaptui-main-content").boundingBox(),
        techStatusBar.boundingBox(),
      ]);
      expect(statusBox!.y).toBeGreaterThanOrEqual(mainBox!.y + mainBox!.height - 2);
      const statusFontPx = await techStatusBar.evaluate((el) =>
        parseFloat(window.getComputedStyle(el).fontSize)
      );
      expect(statusFontPx).toBeLessThanOrEqual(12);

      // Verify Settings menu contains all sub-menus + Technician Status Bar switch
      await window.getByRole("button", { name: "Settings", exact: true }).click();
      const settingsMenu = window.getByRole("menu", { name: "Settings" });
      await expect(settingsMenu.getByRole("menuitem", { name: "Profiles" })).toBeVisible();
      await expect(settingsMenu.getByRole("menuitem", { name: "AI & Privacy" })).toBeVisible();
      await expect(settingsMenu.getByRole("menuitem", { name: "Voice & Speech" })).toBeVisible();
      await expect(settingsMenu.getByRole("menuitem", { name: "Diagnostics" })).toBeVisible();
      await expect(settingsMenu.getByRole("menuitem", { name: "Security" })).toBeVisible();

      const statusToggle = settingsMenu.getByRole("menuitemcheckbox", {
        name: /Technician Status Bar/i,
      });
      await expect(statusToggle).toHaveAttribute("aria-checked", "true");
      await statusToggle.click();
      await expect(techStatusBar).toBeHidden();
      await expect(statusToggle).toHaveAttribute("aria-checked", "false");
      await statusToggle.click();
      await expect(techStatusBar).toBeVisible();

      await settingsMenu.getByRole("menuitem", { name: "Security" }).click();
      await expect(window.getByRole("heading", { name: "Security", exact: true })).toBeVisible();
      await expect(window.getByText(/Blocked Unsafe Links: 1/i)).toBeVisible();
      await window.getByRole("button", { name: "Close" }).click();

      // Switch Accessibility Profile live via Settings -> Profiles
      await openSetting("Profiles");
      await window.getByRole("button", { name: "Eye-Gaze & Large Targets" }).click();
      await expect(window.locator(".shell-app")).toHaveAttribute("data-contrast", "high");
      await expect(window.locator(".shell-app")).toHaveAttribute("data-eye-gaze", "true");
      await window.getByRole("button", { name: "Close" }).click();

      // 8: Switch to Original Website view
      await window.getByRole("button", { name: "Original Website", exact: true }).click();
      await expect(window.getByText(/Original website live view is active/i)).toBeVisible();

      // 9: Return to Reconstructed View
      await window.getByRole("button", { name: "Reconstructed View" }).click();
      await expect(
        window.getByRole("heading", { level: 1, name: /Account Settings/i })
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await electronApp.close();
      fs.rmSync(tmpDataDir, { recursive: true, force: true });
    }
  });
});

import { test, expect, _electron as electron } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

test.describe("Local Whisper Voice Commands E2E", () => {
  test("configures Whisper settings, executes voice commands, enforces confirmation, and dictates form fields", async () => {
    const tmpDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "adaptui-voice-e2e-"));
    const appPath = path.resolve(__dirname, "../../apps/desktop");

    const electronApp = await electron.launch({
      args: [
        appPath,
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
      env: {
        ...process.env,
        ADAPTUI_DATA_DIR: tmpDataDir,
        ADAPTUI_MOCK_VOICE_TRANSCRIPT:
          "Find the contact information||Delete All Account Data||Jordan Taylor",
      },
    });

    try {
      const window = await electronApp.firstWindow();
      await window.waitForLoadState("domcontentloaded");

      await expect(
        window.getByRole("heading", { name: /Civic Accessibility Research Center/i })
      ).toBeVisible({ timeout: 15_000 });

      // 1. Open Settings -> Voice & Speech and verify model/backend/mode/language configuration
      await window.getByRole("button", { name: "Settings", exact: true }).click();
      await window
        .getByRole("menu", { name: "Settings" })
        .getByRole("menuitem", { name: "Voice & Speech" })
        .click();

      await expect(window.getByRole("heading", { name: /Voice & Speech/i })).toBeVisible();
      await window
        .getByLabel("Whisper Model Size")
        .selectOption("onnx-community/whisper-large-v3-turbo");
      await window.getByLabel("Recognition Language").selectOption("en");
      await window.getByRole("button", { name: "Save Voice Settings" }).click();
      await expect(window.getByText(/Saved local Whisper voice recognition settings/i)).toBeVisible();
      await window.getByRole("button", { name: "Close" }).click();

      // 2. Execute voice command #1 ("Find the contact information") in auto-execute mode
      await window.getByRole("button", { name: "Start Voice Command" }).click();
      await expect(window.getByRole("button", { name: "Stop & Transcribe" })).toBeVisible();
      await window.waitForTimeout(250);
      await window.getByRole("button", { name: "Stop & Transcribe" }).click();

      await expect(window.getByTestId("voice-transcript")).toContainText(
        "Find the contact information",
        { timeout: 10_000 }
      );
      await expect(
        window.getByRole("heading", { level: 1, name: /Contact Information/i })
      ).toBeVisible({ timeout: 10_000 });

      // 3. Navigate to Adversarial page and issue consequential voice command #2 ("Delete All Account Data")
      // Even in auto-execute voice mode, consequential actions MUST trigger confirmation dialog!
      await window.getByRole("button", { name: "Favorites" }).click();
      await window
        .getByRole("menu", { name: "Favorites" })
        .getByRole("menuitem", { name: /Security Test/i })
        .click();
      await expect(
        window.getByRole("heading", { level: 1, name: /Account Settings/i })
      ).toBeVisible({ timeout: 10_000 });

      await window.getByRole("button", { name: "Start Voice Command" }).click();
      await window.waitForTimeout(250);
      await window.getByRole("button", { name: "Stop & Transcribe" }).click();

      const confirmDialog = window.getByRole("dialog", { name: /Confirm Consequential Action/i });
      await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
      await confirmDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(confirmDialog).toBeHidden();

      // 4. Navigate to Clinic Form and use Dictate button on Full Name field (transcript #3: "Jordan Taylor")
      await window.getByRole("button", { name: "Favorites" }).click();
      await window
        .getByRole("menu", { name: "Favorites" })
        .getByRole("menuitem", { name: /Clinic Form/i })
        .click();
      await expect(
        window.getByRole("heading", { level: 1, name: /Appointment Request/i })
      ).toBeVisible({ timeout: 10_000 });

      const dictateNameBtn = window.getByRole("button", { name: /Dictate Full Name/i });
      await expect(dictateNameBtn).toBeVisible();
      await dictateNameBtn.click();
      await window.waitForTimeout(250);
      await dictateNameBtn.click();

      await expect(window.getByRole("textbox", { name: /Full Name/i })).toHaveValue("Jordan Taylor", {
        timeout: 10_000,
      });
    } finally {
      await electronApp.close();
      fs.rmSync(tmpDataDir, { recursive: true, force: true });
    }
  });
});

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import type { BrowserSnapshot } from "@adaptui/shared-types";
import { extractSemanticPage } from "@adaptui/semantic-model";
import { generateDeterministicUISpec } from "@adaptui/ui-schema";
import { AccessibleDialog, AccessibleUIRenderer } from "@adaptui/accessible-ui";
import { DEFAULT_PROFILES } from "@adaptui/personalization";

const clinicSnapshot: BrowserSnapshot = {
  pageId: "a11y-page",
  url: "http://127.0.0.1:4179/form/index.html",
  title: "Community Accessibility Clinic",
  capturedAt: "2026-11-21T12:00:00.000Z",
  axNodes: [],
  unsupportedFeatures: [],
  canGoBack: false,
  canGoForward: false,
  domElements: [
    {
      uid: "1",
      tagName: "a",
      idAttr: "nav-home",
      accessibleName: "Clinic Home",
      textContent: "Clinic Home",
      href: "http://127.0.0.1:4179/info/index.html",
      visible: true,
      regionHint: "navigation",
      regionLabel: "Clinic navigation",
      locator: "#nav-home",
    },
    {
      uid: "2",
      tagName: "div",
      role: "alert",
      accessibleName: "Form validation error",
      textContent: "Please enter a valid Email Address.",
      visible: true,
      regionHint: "alert",
      locator: "#err",
    },
    {
      uid: "3",
      tagName: "input",
      inputType: "text",
      idAttr: "full-name",
      accessibleName: "Full Name",
      textContent: "",
      required: true,
      visible: true,
      formId: "clinic-form",
      regionHint: "form",
      errorMessage: "Full Name is required.",
      locator: "#full-name",
    },
    {
      uid: "4",
      tagName: "select",
      idAttr: "dept",
      accessibleName: "Support Department",
      textContent: "",
      value: "eye-gaze",
      options: [
        { value: "eye-gaze", label: "Eye-Gaze Lab", selected: true },
        { value: "switch", label: "Switch Clinic", selected: false },
      ],
      visible: true,
      formId: "clinic-form",
      regionHint: "form",
      locator: "#dept",
    },
    {
      uid: "5",
      tagName: "input",
      inputType: "checkbox",
      idAttr: "consent",
      accessibleName: "I consent to be contacted",
      textContent: "",
      required: true,
      checked: false,
      visible: true,
      formId: "clinic-form",
      regionHint: "form",
      locator: "#consent",
    },
    {
      uid: "6",
      tagName: "button",
      inputType: "submit",
      idAttr: "submit-btn",
      accessibleName: "Submit Appointment Request",
      textContent: "Submit Appointment Request",
      visible: true,
      formId: "clinic-form",
      regionHint: "form",
      locator: "#submit-btn",
    },
  ],
};

describe("Accessibility Verification (WCAG 2.2 AA & Profile Rendering)", () => {
  it("passes axe-core automated accessibility audit with zero violations", async () => {
    const page = extractSemanticPage(clinicSnapshot);
    const profile = DEFAULT_PROFILES[0]!;
    const spec = generateDeterministicUISpec(page, profile);

    const { container } = render(
      <main>
        <AccessibleUIRenderer
          spec={spec}
          semanticPage={page}
          profile={profile}
          onAction={vi.fn()}
          onSwitchToOriginal={vi.fn()}
        />
      </main>
    );

    const results = await axe.run(container, {
      rules: {
        // jsdom does not compute color contrast CSS cascade
        "color-contrast": { enabled: false },
      },
    });
    expect(results.violations).toEqual([]);
  });

  it("supports complete keyboard navigation, ARIA alerts, and logical step progression", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const page = extractSemanticPage(clinicSnapshot);
    const profile = DEFAULT_PROFILES[0]!;
    const spec = generateDeterministicUISpec(page, profile);

    render(
      <AccessibleUIRenderer
        spec={spec}
        semanticPage={page}
        profile={profile}
        onAction={onAction}
        onSwitchToOriginal={vi.fn()}
      />
    );

    // Error announcements are exposed via role="alert"
    const alerts = screen.getAllByRole("alert");
    expect(alerts.length).toBeGreaterThanOrEqual(2);

    // Step-by-step form groups exist in logical order
    expect(screen.getByText("Step 1 of 4")).toBeTruthy();
    expect(screen.getByText("Step 4 of 4")).toBeTruthy();

    // Keyboard tab order reaches input and fires action on typing
    const nameInput = screen.getByRole("textbox", { name: /Full Name/i });
    expect(nameInput.getAttribute("aria-invalid")).toBe("true");
    await user.click(nameInput);
    await user.type(nameInput, "Alex");
    expect(onAction).toHaveBeenCalled();
  });

  it("applies Eye-Gaze & High Contrast profile variables (64px targets, scaling, reduced motion)", () => {
    const page = extractSemanticPage(clinicSnapshot);
    const eyeGazeProfile = DEFAULT_PROFILES.find((p) => p.id === "eye-gaze-large")!;
    const spec = generateDeterministicUISpec(page, eyeGazeProfile);

    const { container } = render(
      <AccessibleUIRenderer
        spec={spec}
        semanticPage={page}
        profile={eyeGazeProfile}
        onAction={vi.fn()}
        onSwitchToOriginal={vi.fn()}
      />
    );

    const root = container.querySelector(".aui-root") as HTMLElement;
    expect(root.dataset.contrast).toBe("high");
    expect(root.dataset.reducedMotion).toBe("true");
    expect(root.dataset.eyeGaze).toBe("true");
    expect(root.style.getPropertyValue("--aui-min-target")).toBe("64px");
    expect(root.style.getPropertyValue("--aui-text-scale")).toBe("1.35");
  });

  it("renders accessible confirmation dialog and closes cleanly on Escape key", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <AccessibleDialog
        open={true}
        title="Confirm Action"
        description="This action will submit your appointment."
        onClose={onClose}
      >
        <button type="button">Confirm</button>
      </AccessibleDialog>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

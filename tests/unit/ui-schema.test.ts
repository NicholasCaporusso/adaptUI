import { describe, it, expect } from "vitest";
import type { BrowserSnapshot } from "@adaptui/shared-types";
import { extractSemanticPage } from "@adaptui/semantic-model";
import { generateDeterministicUISpec, validateAccessibleUISpec } from "@adaptui/ui-schema";
import { DEFAULT_PROFILES } from "@adaptui/personalization";

const formSnapshot: BrowserSnapshot = {
  pageId: "page-form",
  url: "http://127.0.0.1:4179/form/index.html",
  title: "Clinic Form",
  capturedAt: "2026-11-21T12:00:00.000Z",
  axNodes: [],
  unsupportedFeatures: [],
  canGoBack: false,
  canGoForward: false,
  domElements: [
    {
      uid: "1",
      tagName: "input",
      inputType: "text",
      idAttr: "full-name",
      accessibleName: "Full Name",
      textContent: "",
      required: true,
      visible: true,
      formId: "clinic-form",
      regionHint: "form",
      locator: "#full-name",
    },
    {
      uid: "2",
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
    {
      uid: "3",
      tagName: "p",
      accessibleName: "Promo banner",
      textContent: "Promotional sidebar text",
      visible: true,
      regionHint: "complementary",
      regionLabel: "Sidebar",
      locator: "aside p",
    },
  ],
};

describe("Declarative Accessible UI Schema & Validator", () => {
  it("generates a valid step-by-step form UI spec and hides secondary content per profile", () => {
    const page = extractSemanticPage(formSnapshot);
    const profile = DEFAULT_PROFILES[0]!; // preferStepByStepForms=true, hideSecondaryContent=true
    const spec = generateDeterministicUISpec(page, profile);
    const result = validateAccessibleUISpec(spec, page);

    expect(result.valid).toBe(true);
    const formNode = spec.components.find((c) => c.type === "form");
    expect(formNode?.type).toBe("form");
    if (formNode && formNode.type === "form") {
      expect(formNode.children.every((c) => c.type === "taskStep")).toBe(true);
    }
    expect(JSON.stringify(spec)).not.toContain("Promotional sidebar text");
  });

  it("rejects UI specs referencing ungrounded actions", () => {
    const page = extractSemanticPage(formSnapshot);
    const spec = generateDeterministicUISpec(page, DEFAULT_PROFILES[0]!);
    spec.components.push({
      id: "evil-btn",
      type: "button",
      label: "Invented Control",
      actionId: "act-does-not-exist",
    });

    const validation = validateAccessibleUISpec(spec, page);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("ungrounded actionId"))).toBe(true);
  });

  it("rejects UI specs with unknown component types or executable script props", () => {
    const page = extractSemanticPage(formSnapshot);
    const badSpec = {
      schemaVersion: "1.0.0",
      pageId: page.pageId,
      pageRevision: page.revision,
      layout: "task",
      title: "Bad Spec",
      components: [
        {
          id: "bad-1",
          type: "script",
          code: "alert(1)",
        },
      ],
    };

    const validation = validateAccessibleUISpec(badSpec, page);
    expect(validation.valid).toBe(false);
  });

  it("rejects UI specs that silently omit required form fields", () => {
    const page = extractSemanticPage(formSnapshot);
    const strippedSpec = {
      schemaVersion: "1.0.0",
      pageId: page.pageId,
      pageRevision: page.revision,
      layout: "form" as const,
      title: "Stripped Form",
      components: [
        {
          id: "only-text",
          type: "text" as const,
          text: "Summary only without required field",
        },
      ],
    };

    const validation = validateAccessibleUISpec(strippedSpec, page);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("Required form field"))).toBe(true);
  });

  it("rejects UI specs attempting to disable confirmation on consequential actions", () => {
    const page = extractSemanticPage(formSnapshot);
    const submitAction = page.actions.find((a) => a.kind === "submit")!;
    const spec = generateDeterministicUISpec(page, DEFAULT_PROFILES[0]!);
    spec.components.push({
      id: "bypass-btn",
      type: "button",
      label: "Submit without confirmation",
      actionId: submitAction.id,
      requiresConfirmation: false,
    });

    const validation = validateAccessibleUISpec(spec, page);
    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("disable confirmation"))).toBe(true);
  });

  it("respects profile showImages and showVideos toggles and rejects unsafe media URLs", () => {
    const mediaSnapshot: BrowserSnapshot = {
      ...formSnapshot,
      domElements: [
        ...formSnapshot.domElements,
        {
          uid: "10",
          tagName: "img",
          accessibleName: "Assistive Lab Diagram",
          textContent: "",
          mediaSrc: "http://127.0.0.1:4179/info/assistive-lab.svg",
          mediaAlt: "Assistive Lab Diagram",
          visible: true,
          regionHint: "main",
          locator: "img",
        },
        {
          uid: "11",
          tagName: "video",
          accessibleName: "Orientation Video",
          textContent: "",
          mediaSrc: "http://127.0.0.1:4179/info/orientation-demo.mp4",
          posterSrc: "http://127.0.0.1:4179/info/assistive-lab.svg",
          mediaAlt: "Orientation Video",
          visible: true,
          regionHint: "main",
          locator: "video",
        },
      ],
    };

    const page = extractSemanticPage(mediaSnapshot);

    // Enabled by default -> both image and video appear
    const withMedia = generateDeterministicUISpec(page, DEFAULT_PROFILES[0]!);
    expect(validateAccessibleUISpec(withMedia, page).valid).toBe(true);
    expect(JSON.stringify(withMedia)).toContain('"type":"image"');
    expect(JSON.stringify(withMedia)).toContain('"type":"video"');

    // Disabled -> image and video omitted cleanly
    const noMediaProfile = structuredClone(DEFAULT_PROFILES[0]!);
    noMediaProfile.presentation.showImages = false;
    noMediaProfile.presentation.showVideos = false;
    const withoutMedia = generateDeterministicUISpec(page, noMediaProfile);
    expect(validateAccessibleUISpec(withoutMedia, page).valid).toBe(true);
    expect(JSON.stringify(withoutMedia)).not.toContain('"type":"image"');
    expect(JSON.stringify(withoutMedia)).not.toContain('"type":"video"');

    // Unsafe media URL in a generated spec must be rejected
    withMedia.components.push({
      id: "bad-img",
      type: "image",
      src: "javascript:alert(1)",
      alt: "Evil",
    });
    expect(validateAccessibleUISpec(withMedia, page).valid).toBe(false);
  });
});

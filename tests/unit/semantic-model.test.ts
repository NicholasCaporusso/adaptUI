import { describe, it, expect } from "vitest";
import type { BrowserSnapshot } from "@adaptui/shared-types";
import {
  extractSemanticPage,
  isElementReferenceStale,
  validateSemanticPage,
} from "@adaptui/semantic-model";

function sampleSnapshot(overrides?: Partial<BrowserSnapshot>): BrowserSnapshot {
  return {
    pageId: "page-1",
    url: "http://127.0.0.1:4179/form/index.html",
    title: "Appointment Request — Clinic",
    capturedAt: "2026-11-21T12:00:00.000Z",
    canGoBack: true,
    canGoForward: false,
    unsupportedFeatures: [],
    axNodes: [
      {
        nodeId: "ax-1",
        backendDOMNodeId: 101,
        role: "textbox",
        name: "Full Name (Required)",
      },
      {
        nodeId: "ax-2",
        backendDOMNodeId: 102,
        role: "button",
        name: "Submit Appointment Request",
      },
    ],
    domElements: [
      {
        uid: "aui-1",
        tagName: "h1",
        accessibleName: "Request a Consultation",
        textContent: "Request a Consultation",
        visible: true,
        headingLevel: 1,
        regionHint: "main",
        regionLabel: "Main Content",
        locator: "h1",
      },
      {
        uid: "aui-2",
        backendNodeId: 101,
        tagName: "input",
        inputType: "text",
        idAttr: "full-name",
        nameAttr: "fullName",
        accessibleName: "Full Name (Required)",
        textContent: "",
        required: true,
        visible: true,
        formId: "consultation-form",
        regionHint: "form",
        regionLabel: "Consultation Form",
        errorMessage: "Full Name is required.",
        locator: "#full-name",
      },
      {
        uid: "aui-3",
        backendNodeId: 102,
        tagName: "button",
        inputType: "submit",
        idAttr: "submit-appointment",
        accessibleName: "Submit Appointment Request",
        textContent: "Submit Appointment Request",
        visible: true,
        formId: "consultation-form",
        regionHint: "form",
        regionLabel: "Consultation Form",
        locator: "#submit-appointment",
      },
    ],
    ...overrides,
  };
}

describe("Semantic Website Model", () => {
  it("extracts a valid semantic page with merged AX+DOM provenance, constraints, and workflows", () => {
    const page = extractSemanticPage(sampleSnapshot());
    const validation = validateSemanticPage(page);

    expect(validation.valid).toBe(true);
    expect(page.revision).toBe(1);
    expect(page.elements).toHaveLength(3);
    expect(page.workflows).toHaveLength(1);
    expect(page.workflows[0]?.kind).toBe("form");

    const nameField = page.elements.find((e) => e.sourceRef?.domId === "full-name");
    expect(nameField?.constraints?.required).toBe(true);
    expect(nameField?.errorMessage).toBe("Full Name is required.");
    expect(nameField?.provenance.source).toBe("merged");

    const submitAct = page.actions.find((a) => a.kind === "submit");
    expect(submitAct?.requiresConfirmation).toBe(true);
    expect(submitAct?.riskLevel).toBe("consequential");
  });

  it("preserves stable element identities across revisions and detects stale references", () => {
    const rev1 = extractSemanticPage(sampleSnapshot());
    const rev2 = extractSemanticPage(sampleSnapshot(), rev1);

    expect(rev2.revision).toBe(2);
    const id1 = rev1.elements.find((e) => e.sourceRef?.domId === "full-name")?.id;
    const id2 = rev2.elements.find((e) => e.sourceRef?.domId === "full-name")?.id;
    expect(id1).toBe(id2);

    const oldRef = rev1.elements[1]?.sourceRef;
    expect(isElementReferenceStale(oldRef, rev1)).toBe(false);
    expect(isElementReferenceStale(oldRef, rev2)).toBe(true);
  });

  it("flags incomplete models when unsupported website features exist", () => {
    const page = extractSemanticPage(
      sampleSnapshot({ unsupportedFeatures: ["cross-origin-iframe", "html5-canvas"] })
    );
    expect(page.incomplete).toBe(true);
    expect(page.extractionWarnings.some((w) => w.includes("cross-origin-iframe"))).toBe(true);
  });

  it("rejects semantic models with ungrounded actions during validation", () => {
    const page = extractSemanticPage(sampleSnapshot());
    page.actions.push({
      id: "act-hallucinated",
      label: "Ghost button",
      kind: "click",
      targetElementId: "non-existent-element",
      requiresConfirmation: false,
      riskLevel: "safe",
      riskReasons: [],
      preconditions: [],
    });
    const validation = validateSemanticPage(page);
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain("non-existent-element");
  });
});

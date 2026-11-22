import { describe, it, expect } from "vitest";
import { MockBrowserAdapter } from "@adaptui/browser-core";
import { extractSemanticPage, validateSemanticPage } from "@adaptui/semantic-model";
import { generateDeterministicUISpec, validateAccessibleUISpec } from "@adaptui/ui-schema";
import { NaturalLanguageCommandAgent } from "@adaptui/command-agent";
import { HybridAIRouter } from "@adaptui/ai-core";
import { DeterministicMockAIProvider } from "@adaptui/ai-providers";
import {
  DEFAULT_AI_SETTINGS,
  DEFAULT_PRIVACY_SETTINGS,
  DEFAULT_PROFILES,
} from "@adaptui/personalization";

describe("Integration Tests: Workflows A, B, C, Stale Recovery & Provider Failures", () => {
  it("Workflow A (Information Retrieval): opens info site, extracts content, finds contact section, navigates to related page", async () => {
    const infoUrl = "http://127.0.0.1:4179/info/index.html";
    const contactUrl = "http://127.0.0.1:4179/info/contact.html";

    const browser = new MockBrowserAdapter([
      {
        url: infoUrl,
        title: "Civic Accessibility Research Center — Home",
        elements: [
          {
            uid: "1",
            tagName: "h1",
            accessibleName: "Assistive Technology & Digital Inclusion",
            textContent: "Assistive Technology & Digital Inclusion",
            visible: true,
            headingLevel: 1,
            regionHint: "main",
            locator: "h1",
          },
          {
            uid: "2",
            tagName: "p",
            accessibleName: "Email: support@civic-a11y.example",
            textContent: "Email: support@civic-a11y.example",
            visible: true,
            regionHint: "section",
            regionLabel: "Direct Contact Summary",
            locator: "#contact-email",
          },
          {
            uid: "3",
            tagName: "a",
            idAttr: "open-contact-page",
            accessibleName: "Contact Information",
            textContent: "Contact Information",
            href: contactUrl,
            visible: true,
            regionHint: "navigation",
            regionLabel: "Primary navigation",
            locator: "#open-contact-page",
          },
        ],
      },
      {
        url: contactUrl,
        title: "Contact Information — Civic Accessibility Research Center",
        elements: [
          {
            uid: "4",
            tagName: "h1",
            accessibleName: "Contact Information",
            textContent: "Contact Information",
            visible: true,
            headingLevel: 1,
            regionHint: "main",
            locator: "h1",
          },
          {
            uid: "5",
            tagName: "p",
            accessibleName: "Phone",
            textContent: "Telephone: +1 (555) 014-8920",
            visible: true,
            regionHint: "main",
            locator: "p",
          },
        ],
      },
    ]);

    const page1 = extractSemanticPage(await browser.snapshot());
    expect(validateSemanticPage(page1).valid).toBe(true);
    const spec1 = generateDeterministicUISpec(page1, DEFAULT_PROFILES[0]!);
    expect(validateAccessibleUISpec(spec1, page1).valid).toBe(true);

    const agent = new NaturalLanguageCommandAgent();
    const res = await agent.executeCommand({
      commandText: "Find the contact information",
      browser,
      currentPage: page1,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });

    expect(res.result.status).toBe("completed");
    expect(res.updatedPage.url).toBe(contactUrl);

    // Go back to previous page
    const backRes = await agent.executeCommand({
      commandText: "Go back to the previous page",
      browser,
      currentPage: res.updatedPage,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });
    expect(backRes.result.status).toBe("completed");
    expect(backRes.updatedPage.url).toBe(infoUrl);
  });

  it("Workflow C (Form Interaction): step-by-step form filling, validation errors, and confirmed submission", async () => {
    const formUrl = "http://127.0.0.1:4179/form/index.html";
    const browser = new MockBrowserAdapter([
      {
        url: formUrl,
        title: "Appointment Request — Clinic",
        elements: [
          {
            uid: "1",
            tagName: "input",
            inputType: "text",
            idAttr: "full-name",
            accessibleName: "Full Name",
            textContent: "",
            required: true,
            visible: true,
            formId: "consultation-form",
            regionHint: "form",
            locator: "#full-name",
          },
          {
            uid: "2",
            tagName: "input",
            inputType: "email",
            idAttr: "email",
            accessibleName: "Email Address",
            textContent: "",
            required: true,
            visible: true,
            formId: "consultation-form",
            regionHint: "form",
            locator: "#email",
          },
          {
            uid: "3",
            tagName: "input",
            inputType: "checkbox",
            idAttr: "consent-checkbox",
            accessibleName: "Consent to contact",
            textContent: "",
            required: true,
            checked: false,
            visible: true,
            formId: "consultation-form",
            regionHint: "form",
            locator: "#consent-checkbox",
          },
          {
            uid: "4",
            tagName: "button",
            inputType: "submit",
            idAttr: "submit-appointment",
            accessibleName: "Submit Appointment Request",
            textContent: "Submit Appointment Request",
            visible: true,
            formId: "consultation-form",
            regionHint: "form",
            locator: "#submit-appointment",
          },
        ],
        onAction(action, page, adapter) {
          if (action.kind === "submit") {
            const name = page.elements.find((e) => e.idAttr === "full-name")?.value || "";
            const email = page.elements.find((e) => e.idAttr === "email")?.value || "";
            const consent = page.elements.find((e) => e.idAttr === "consent-checkbox")?.checked;
            if (!name || !email || !consent) {
              page.elements.push({
                uid: "err",
                tagName: "div",
                role: "alert",
                accessibleName: "Validation Error",
                textContent: "Required fields are missing.",
                visible: true,
                regionHint: "alert",
                locator: "#form-error-summary",
              });
              return { domChanged: true, message: "Validation failed." };
            }
            adapter.cookies["appointment"] = name;
            page.elements.push({
              uid: "rcpt",
              tagName: "div",
              role: "status",
              accessibleName: "Confirmation",
              textContent: `Appointment request submitted for ${name} (${email}).`,
              visible: true,
              regionHint: "status",
              locator: "#form-receipt",
            });
            return { domChanged: true, message: "Appointment submitted." };
          }
          return undefined;
        },
      },
    ]);

    const agent = new NaturalLanguageCommandAgent();
    let page = extractSemanticPage(await browser.snapshot());

    const fillRes = await agent.executeCommand({
      commandText: "Fill in my name as Jordan Taylor and email as jordan@example.com",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });
    expect(fillRes.result.status).toBe("completed");
    page = fillRes.updatedPage;

    const checkRes = await agent.executeCommand({
      commandText: "Check consent",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });
    expect(checkRes.result.status).toBe("completed");
    page = checkRes.updatedPage;

    // Submitting consequential form MUST ask confirmation first
    const submitAttempt = await agent.executeCommand({
      commandText: "Submit Appointment Request",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });
    expect(submitAttempt.result.status).toBe("awaiting-confirmation");

    const confirmed = await agent.resolvePendingConfirmation({
      confirmationId: submitAttempt.result.pendingConfirmation!.confirmationId,
      approved: true,
      browser,
      currentPage: submitAttempt.updatedPage,
      profile: DEFAULT_PROFILES[0]!,
    });
    expect(confirmed.result.status).toBe("completed");
    expect(
      confirmed.updatedPage.elements.some((e) =>
        (e.textContent || "").includes("Appointment request submitted for Jordan Taylor")
      )
    ).toBe(true);
    expect(browser.cookies["appointment"]).toBe("Jordan Taylor");
  });

  it("handles stale element references and recovers cleanly when AI provider fails", async () => {
    const urlA = "http://127.0.0.1:4179/a";
    const urlB = "http://127.0.0.1:4179/b";
    const browser = new MockBrowserAdapter([
      {
        url: urlA,
        title: "Page A",
        elements: [
          {
            uid: "1",
            tagName: "button",
            idAttr: "btn-a",
            accessibleName: "Action A",
            textContent: "Action A",
            visible: true,
            regionHint: "main",
            locator: "#btn-a",
          },
        ],
      },
      {
        url: urlB,
        title: "Page B",
        elements: [],
      },
    ]);

    const pageA = extractSemanticPage(await browser.snapshot());
    const staleRef = pageA.elements[0]!.sourceRef!;

    // Navigate away so pageA reference becomes stale
    await browser.navigate(urlB);
    const execResult = await browser.execute({
      id: "stale-act",
      kind: "click",
      targetRef: staleRef,
    });
    expect(execResult.success).toBe(false);
    expect(execResult.errorCode).toBe("STALE_ELEMENT");

    // Verify AI failure falls back cleanly without crashing command agent
    const failingRouter = new HybridAIRouter({
      settings: { ...DEFAULT_AI_SETTINGS, routingMode: "local-only" },
      privacy: DEFAULT_PRIVACY_SETTINGS,
      localProvider: {
        id: "ollama:broken",
        kind: "local",
        capabilities: { supportsStructuredOutput: true, supportsJsonMode: true, maxContextChars: 4000 },
        healthCheck: async () => false,
        generateStructured: async () => {
          throw new Error("Model crashed");
        },
      },
      mockProvider: new DeterministicMockAIProvider(),
    });

    const agent = new NaturalLanguageCommandAgent();
    const pageB = extractSemanticPage(await browser.snapshot());
    const fallbackRes = await agent.executeCommand({
      commandText: "Do something unsupported",
      browser,
      currentPage: pageB,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
      aiRouter: failingRouter,
    });
    expect(fallbackRes.result.status).toBe("rejected");
  });
});

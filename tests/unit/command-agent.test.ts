import { describe, it, expect } from "vitest";
import { MockBrowserAdapter } from "@adaptui/browser-core";
import { extractSemanticPage } from "@adaptui/semantic-model";
import { NaturalLanguageCommandAgent } from "@adaptui/command-agent";
import { DEFAULT_PRIVACY_SETTINGS, DEFAULT_PROFILES } from "@adaptui/personalization";

function createSearchMockBrowser() {
  const resultsPageUrl = "http://127.0.0.1:4179/search/index.html";
  const article1Url = "http://127.0.0.1:4179/search/article.html?id=1";

  return new MockBrowserAdapter([
    {
      url: resultsPageUrl,
      title: "Knowledge Hub — Search",
      elements: [
        {
          uid: "1",
          tagName: "input",
          inputType: "search",
          idAttr: "search-input",
          accessibleName: "Search publications",
          textContent: "",
          visible: true,
          formId: "search-form",
          regionHint: "search",
          locator: "#search-input",
        },
        {
          uid: "2",
          tagName: "button",
          inputType: "submit",
          idAttr: "search-submit",
          accessibleName: "Search",
          textContent: "Search",
          visible: true,
          formId: "search-form",
          regionHint: "search",
          locator: "#search-submit",
        },
        {
          uid: "3",
          tagName: "button",
          idAttr: "delete-btn",
          accessibleName: "Delete Account",
          textContent: "Delete Account",
          visible: true,
          regionHint: "main",
          locator: "#delete-btn",
        },
      ],
      onAction(action, page) {
        if (action.kind === "submit") {
          const query = page.elements.find((e) => e.idAttr === "search-input")?.value || "";
          page.elements = page.elements.filter((e) => e.idAttr !== "res-1");
          page.elements.push({
            uid: "9",
            tagName: "a",
            idAttr: "res-1",
            accessibleName: `Assistive Technology Result for ${query}`,
            textContent: `Assistive Technology Result for ${query}`,
            href: article1Url,
            visible: true,
            regionHint: "section",
            regionLabel: "Search Results",
            locator: "#res-1",
          });
          return { domChanged: true, message: `Displayed results for "${query}".` };
        }
        return undefined;
      },
    },
    {
      url: article1Url,
      title: "Assistive Technology Foundations",
      elements: [
        {
          uid: "10",
          tagName: "h1",
          accessibleName: "Assistive Technology Foundations",
          textContent: "Assistive Technology Foundations",
          visible: true,
          headingLevel: 1,
          regionHint: "main",
          locator: "h1",
        },
      ],
    },
  ]);
}

describe("Natural-Language Command Agent", () => {
  it("executes multi-step 'Search for assistive technology and open the first result' with state refresh & verification", async () => {
    const browser = createSearchMockBrowser();
    const agent = new NaturalLanguageCommandAgent();
    const initialPage = extractSemanticPage(await browser.snapshot());

    const { result, updatedPage } = await agent.executeCommand({
      commandText: "Search for assistive technology and open the first result",
      browser,
      currentPage: initialPage,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });

    expect(result.status).toBe("completed");
    expect(result.steps).toHaveLength(3);
    expect(result.steps.every((s) => s.verified)).toBe(true);
    expect(updatedPage.url).toContain("article.html?id=1");
  });

  it("pauses for explicit confirmation before consequential actions and executes only when approved", async () => {
    const browser = createSearchMockBrowser();
    const agent = new NaturalLanguageCommandAgent();
    const page = extractSemanticPage(await browser.snapshot());

    const first = await agent.executeCommand({
      commandText: "Delete Account",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });

    expect(first.result.status).toBe("awaiting-confirmation");
    expect(first.result.pendingConfirmation).toBeDefined();
    expect(browser.executedActions).toHaveLength(0);

    // Declining must NOT execute the action
    const declined = await agent.resolvePendingConfirmation({
      confirmationId: first.result.pendingConfirmation!.confirmationId,
      approved: false,
      browser,
      currentPage: first.updatedPage,
      profile: DEFAULT_PROFILES[0]!,
    });
    expect(declined.result.status).toBe("rejected");
    expect(browser.executedActions).toHaveLength(0);

    // Re-run and approve
    const second = await agent.executeCommand({
      commandText: "Delete Account",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });
    const approved = await agent.resolvePendingConfirmation({
      confirmationId: second.result.pendingConfirmation!.confirmationId,
      approved: true,
      browser,
      currentPage: second.updatedPage,
      profile: DEFAULT_PROFILES[0]!,
    });
    expect(approved.result.status).toBe("completed");
    expect(browser.executedActions).toHaveLength(1);
  });

  it("supports switching to the original website via natural language", async () => {
    const browser = createSearchMockBrowser();
    const agent = new NaturalLanguageCommandAgent();
    const page = extractSemanticPage(await browser.snapshot());

    const { result } = await agent.executeCommand({
      commandText: "Show me the original website",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });

    expect(result.status).toBe("completed");
    expect(result.requestedViewMode).toBe("original");
  });

  it("rejects unsupported commands clearly without fabricating actions", async () => {
    const browser = createSearchMockBrowser();
    const agent = new NaturalLanguageCommandAgent();
    const page = extractSemanticPage(await browser.snapshot());

    const { result } = await agent.executeCommand({
      commandText: "Launch spacecraft to Mars",
      browser,
      currentPage: page,
      profile: DEFAULT_PROFILES[0]!,
      privacy: DEFAULT_PRIVACY_SETTINGS,
    });

    expect(result.status).toBe("rejected");
    expect(browser.executedActions).toHaveLength(0);
  });
});

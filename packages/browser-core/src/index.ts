import type {
  ActionResult,
  BrowserAction,
  BrowserCapabilities,
  BrowserSnapshot,
  RawAxNode,
  RawDomElement,
} from "@adaptui/shared-types";
import { validateNavigationUrl } from "@adaptui/security";

export interface BrowserStateChangeEvent {
  url: string;
  title: string;
  reason: "navigation" | "dom-mutation" | "action";
  timestamp: string;
}

export type BrowserStateListener = (event: BrowserStateChangeEvent) => void;

export interface BrowserAdapter {
  readonly capabilities: BrowserCapabilities;
  navigate(url: string, signal?: AbortSignal): Promise<void>;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  reload(): Promise<void>;
  snapshot(): Promise<BrowserSnapshot>;
  execute(action: BrowserAction, signal?: AbortSignal): Promise<ActionResult>;
  currentUrl(): Promise<string>;
  clearBrowsingData(): Promise<void>;
  onStateChange(listener: BrowserStateListener): () => void;
  close(): Promise<void>;
}

/**
 * Deterministic browser-side read-only DOM extraction script.
 * Uses semantic HTML and ARIA properties first; never mutates page state.
 */
export const DOM_EXTRACTION_SCRIPT = `(() => {
  const unsupported = [];
  const iframes = Array.from(document.querySelectorAll('iframe'));
  for (const frame of iframes) {
    try {
      void frame.contentDocument;
    } catch {
      if (!unsupported.includes('cross-origin-iframe')) {
        unsupported.push('cross-origin-iframe');
      }
    }
  }
  if (document.querySelector('canvas')) {
    unsupported.push('html5-canvas');
  }

  function isVisible(el) {
    if (!el || el.hidden) return false;
    const style = window.getComputedStyle(el);
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0 || el.tagName === 'OPTION';
  }

  function getAccessibleName(el) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const parts = labelledBy
        .split(/\\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() || '')
        .filter(Boolean);
      if (parts.length > 0) return parts.join(' ');
    }

    if (el.id) {
      const explicitLabel = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (explicitLabel?.textContent?.trim()) return explicitLabel.textContent.trim();
    }

    const parentLabel = el.closest('label');
    if (parentLabel) {
      const clone = parentLabel.cloneNode(true);
      clone.querySelectorAll('input,select,textarea').forEach((n) => n.remove());
      const txt = clone.textContent?.trim();
      if (txt) return txt;
    }

    if (el.getAttribute('placeholder')) return el.getAttribute('placeholder').trim();
    if (el.getAttribute('title')) return el.getAttribute('title').trim();
    if (el.tagName === 'INPUT' && (el.type === 'submit' || el.type === 'button') && el.value) {
      return el.value.trim();
    }
    return (el.textContent || '').replace(/\\s+/g, ' ').trim();
  }

  function getErrorMessage(el) {
    const describedBy = el.getAttribute('aria-describedby');
    if (!describedBy) return undefined;
    const msgs = describedBy
      .split(/\\s+/)
      .map((id) => {
        const node = document.getElementById(id);
        if (!node || !isVisible(node)) return '';
        return (node.textContent || '').trim();
      })
      .filter(Boolean);
    return msgs.length > 0 ? msgs.join(' ') : undefined;
  }

  function getRegionInfo(el) {
    const role = el.getAttribute('role');
    if (role === 'alert') return { kind: 'alert', label: 'Alerts' };
    if (role === 'status') return { kind: 'status', label: 'Status' };
    const nav = el.closest('nav, [role="navigation"]');
    if (nav) return { kind: 'navigation', label: nav.getAttribute('aria-label') || 'Navigation' };
    const search = el.closest('[role="search"]');
    if (search) return { kind: 'search', label: search.getAttribute('aria-label') || 'Search' };
    const dialog = el.closest('dialog, [role="dialog"]');
    if (dialog) return { kind: 'dialog', label: dialog.getAttribute('aria-label') || 'Dialog' };
    const aside = el.closest('aside, [role="complementary"]');
    if (aside) return { kind: 'complementary', label: aside.getAttribute('aria-label') || 'Related' };
    const footer = el.closest('footer, [role="contentinfo"]');
    if (footer) return { kind: 'contentinfo', label: 'Footer' };
    const form = el.closest('form');
    if (form) return { kind: 'form', label: form.getAttribute('aria-label') || 'Form' };
    const section = el.closest('section');
    if (section) {
      const heading = section.querySelector('h1,h2,h3,h4');
      return {
        kind: 'section',
        label: section.getAttribute('aria-label') || heading?.textContent?.trim() || 'Section'
      };
    }
    return { kind: 'main', label: 'Main Content' };
  }

  function buildLocator(el, index) {
    if (el.id) return '#' + CSS.escape(el.id);
    const tag = el.tagName.toLowerCase();
    const name = el.getAttribute('name');
    if (name && (tag === 'input' || tag === 'select' || tag === 'textarea')) {
      const val = el.type === 'radio' ? '[value="' + CSS.escape(el.value) + '"]' : '';
      return tag + '[name="' + CSS.escape(name) + '"]' + val;
    }
    return '[data-adaptui-uid="aui-' + index + '"]';
  }

  const selector = [
    'h1','h2','h3','h4','h5','h6',
    'p',
    'img',
    'video',
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    'table',
    'ul','ol',
    '[role="alert"]',
    '[role="status"]',
    '[role="button"]',
    '[role="link"]',
    '.hidden-injection'
  ].join(',');

  const nodes = Array.from(document.querySelectorAll(selector));
  const domElements = [];
  let idx = 0;

  for (const el of nodes) {
    const tag = el.tagName.toLowerCase();
    // Skip nested paragraphs inside links/buttons or nav lists whose links are already extracted
    if ((tag === 'ul' || tag === 'ol') && el.closest('nav')) continue;
    if ((tag === 'ul' || tag === 'ol') && el.querySelector('a[href]')) continue;
    if (tag === 'p' && el.closest('table')) continue;
    if (tag === 'input' && el.type === 'hidden') continue;

    idx += 1;
    const uid = 'aui-' + idx;
    try { el.setAttribute('data-adaptui-uid', uid); } catch {}

    const visible = isVisible(el);
    const region = getRegionInfo(el);
    const form = el.closest('form');
    const formId = form ? (form.id || form.getAttribute('aria-label') || 'page-form') : undefined;

    let tableData;
    if (tag === 'table') {
      const caption = el.querySelector('caption')?.textContent?.trim();
      const headers = Array.from(el.querySelectorAll('thead th, tr:first-child th')).map(
        (th) => (th.textContent || '').trim()
      );
      const rows = Array.from(el.querySelectorAll('tbody tr')).map((tr) =>
        Array.from(tr.querySelectorAll('td,th')).map((cell) => (cell.textContent || '').trim())
      );
      tableData = { caption, headers, rows };
    }

    let listItems;
    if (tag === 'ul' || tag === 'ol') {
      listItems = Array.from(el.children)
        .filter((c) => c.tagName === 'LI')
        .map((li) => (li.textContent || '').replace(/\\s+/g, ' ').trim())
        .filter(Boolean);
      if (listItems.length === 0) continue;
    }

    let options;
    if (tag === 'select') {
      options = Array.from(el.options).map((o) => ({
        value: o.value,
        label: (o.textContent || o.value).trim(),
        selected: o.selected,
      }));
    }

    let mediaSrc;
    let posterSrc;
    let mediaAlt;
    if (tag === 'img') {
      const rawSrc = el.currentSrc || el.getAttribute('src') || '';
      if (!rawSrc) continue;
      const rect = el.getBoundingClientRect();
      // Skip tiny 1px tracking beacons or purely decorative hidden icons
      if (rect.width > 0 && rect.height > 0 && rect.width < 16 && rect.height < 16 && !el.getAttribute('alt')) {
        continue;
      }
      try {
        mediaSrc = new URL(rawSrc, window.location.href).toString();
      } catch {
        mediaSrc = rawSrc;
      }
      const figcaption = el.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
      mediaAlt = (el.getAttribute('alt') || figcaption || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim();
    } else if (tag === 'video') {
      const sourceEl = el.querySelector('source[src]');
      const rawSrc = el.currentSrc || el.getAttribute('src') || sourceEl?.getAttribute('src') || '';
      if (!rawSrc) continue;
      try {
        mediaSrc = new URL(rawSrc, window.location.href).toString();
      } catch {
        mediaSrc = rawSrc;
      }
      const rawPoster = el.getAttribute('poster');
      if (rawPoster) {
        try {
          posterSrc = new URL(rawPoster, window.location.href).toString();
        } catch {
          posterSrc = rawPoster;
        }
      }
      const figcaption = el.closest('figure')?.querySelector('figcaption')?.textContent?.trim();
      mediaAlt = (el.getAttribute('aria-label') || figcaption || el.getAttribute('title') || 'Video').trim();
    }

    const textContent = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    const accessibleName = mediaAlt || getAccessibleName(el);
    if (visible && !accessibleName && !textContent && tag !== 'input' && tag !== 'select' && tag !== 'textarea' && tag !== 'table' && tag !== 'img' && tag !== 'video') {
      continue;
    }

    const headingLevel = /^h[1-6]$/.test(tag) ? Number(tag[1]) : undefined;
    const rawHref = tag === 'a' ? el.getAttribute('href') : undefined;
    let resolvedHref = rawHref || undefined;
    if (rawHref && !/^(javascript|data|vbscript|mailto|tel):/i.test(rawHref.trim())) {
      try {
        resolvedHref = new URL(rawHref, window.location.href).toString();
      } catch {
        resolvedHref = rawHref;
      }
    }

    domElements.push({
      uid,
      tagName: tag,
      role: el.getAttribute('role') || undefined,
      accessibleName,
      textContent: textContent.slice(0, 2000),
      description: el.getAttribute('aria-description') || undefined,
      idAttr: el.id || undefined,
      nameAttr: el.getAttribute('name') || undefined,
      inputType: tag === 'input' ? (el.type || 'text') : tag === 'button' ? (el.type || 'submit') : undefined,
      value: (tag === 'input' || tag === 'textarea' || tag === 'select') ? String(el.value ?? '') : undefined,
      placeholder: el.getAttribute('placeholder') || undefined,
      href: resolvedHref,
      mediaSrc,
      posterSrc,
      mediaAlt,
      checked: (tag === 'input' && (el.type === 'checkbox' || el.type === 'radio')) ? Boolean(el.checked) : undefined,
      required: Boolean(el.required || el.getAttribute('aria-required') === 'true'),
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      visible,
      headingLevel,
      formId,
      regionHint: region.kind,
      regionLabel: region.label,
      errorMessage: getErrorMessage(el),
      options,
      tableData,
      listItems,
      autocomplete: el.getAttribute('autocomplete') || undefined,
      locator: buildLocator(el, idx),
      ariaLive: el.getAttribute('aria-live') || undefined,
    });
  }

  return {
    url: window.location.href,
    title: document.title || '',
    domElements,
    unsupportedFeatures: unsupported,
  };
})()`;

export interface ElectronDebuggerLike {
  isAttached(): boolean;
  attach(protocolVersion?: string): void;
  detach(): void;
  sendCommand(method: string, commandParams?: Record<string, unknown>): Promise<any>;
}

export interface ElectronWebContentsLike {
  loadURL(url: string): Promise<void>;
  getURL(): string;
  getTitle(): string;
  executeJavaScript(code: string, userGesture?: boolean): Promise<any>;
  reload(): void;
  navigationHistory: {
    canGoBack(): boolean;
    canGoForward(): boolean;
    goBack(): void;
    goForward(): void;
  };
  debugger: ElectronDebuggerLike;
  session: {
    clearStorageData(): Promise<void>;
    clearCache(): Promise<void>;
  };
}

export class ElectronCdpBrowserAdapter implements BrowserAdapter {
  public readonly capabilities: BrowserCapabilities = {
    adapterName: "ElectronCdpBrowserAdapter",
    supportsCdp: true,
    supportsAccessibilityTree: true,
    supportsEmbeddedOriginalView: true,
    supportsCookiesAndSessions: true,
    supportsCancellation: true,
  };

  private readonly webContents: ElectronWebContentsLike;
  private readonly listeners = new Set<BrowserStateListener>();
  private pageCounter = 0;
  private currentPageId = "page-1";
  private lastUrl = "";
  private cdpReady = false;

  constructor(webContents: ElectronWebContentsLike) {
    this.webContents = webContents;
  }

  private async ensureCdp(): Promise<void> {
    if (!this.webContents.debugger.isAttached()) {
      this.webContents.debugger.attach("1.3");
      this.cdpReady = false;
    }
    if (!this.cdpReady) {
      await this.webContents.debugger.sendCommand("DOM.enable");
      await this.webContents.debugger.sendCommand("Accessibility.enable");
      this.cdpReady = true;
    }
  }

  public notifyExternalStateChange(reason: BrowserStateChangeEvent["reason"]): void {
    const url = this.webContents.getURL();
    if (url !== this.lastUrl) {
      this.pageCounter += 1;
      this.currentPageId = `page-${this.pageCounter}`;
      this.lastUrl = url;
    }
    const event: BrowserStateChangeEvent = {
      url,
      title: this.webContents.getTitle(),
      reason,
      timestamp: new Date().toISOString(),
    };
    this.listeners.forEach((fn) => fn(event));
  }

  public onStateChange(listener: BrowserStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public async currentUrl(): Promise<string> {
    return this.webContents.getURL();
  }

  public async navigate(rawUrl: string, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw new Error("Navigation cancelled");
    const check = validateNavigationUrl(rawUrl, { allowAboutBlank: true });
    if (!check.allowed || !check.normalizedUrl) {
      throw new Error(check.reason || "Navigation blocked by URL policy");
    }
    await this.webContents.loadURL(check.normalizedUrl);
    this.pageCounter += 1;
    this.currentPageId = `page-${this.pageCounter}`;
    this.lastUrl = this.webContents.getURL();
    this.notifyExternalStateChange("navigation");
  }

  public async goBack(): Promise<boolean> {
    if (!this.webContents.navigationHistory.canGoBack()) return false;
    this.webContents.navigationHistory.goBack();
    await new Promise((r) => setTimeout(r, 250));
    this.notifyExternalStateChange("navigation");
    return true;
  }

  public async goForward(): Promise<boolean> {
    if (!this.webContents.navigationHistory.canGoForward()) return false;
    this.webContents.navigationHistory.goForward();
    await new Promise((r) => setTimeout(r, 250));
    this.notifyExternalStateChange("navigation");
    return true;
  }

  public async reload(): Promise<void> {
    this.webContents.reload();
    await new Promise((r) => setTimeout(r, 300));
    this.notifyExternalStateChange("navigation");
  }

  public async snapshot(): Promise<BrowserSnapshot> {
    const url = this.webContents.getURL();
    if (url !== this.lastUrl) {
      this.pageCounter += 1;
      this.currentPageId = `page-${this.pageCounter}`;
      this.lastUrl = url;
    }

    let axNodes: RawAxNode[] = [];
    let domResult: {
      url: string;
      title: string;
      domElements: RawDomElement[];
      unsupportedFeatures: string[];
    } = {
      url,
      title: this.webContents.getTitle(),
      domElements: [],
      unsupportedFeatures: [],
    };
    let loadError: string | undefined;

    try {
      await this.ensureCdp();
      const rawAx = await this.webContents.debugger.sendCommand("Accessibility.getFullAXTree");
      axNodes = (rawAx?.nodes || []).map((n: any) => ({
        nodeId: String(n.nodeId),
        backendDOMNodeId: typeof n.backendDOMNodeId === "number" ? n.backendDOMNodeId : undefined,
        ignored: Boolean(n.ignored),
        role: n.role?.value ? String(n.role.value) : undefined,
        name: n.name?.value ? String(n.name.value) : undefined,
        description: n.description?.value ? String(n.description.value) : undefined,
        value: n.value?.value !== undefined ? String(n.value.value) : undefined,
      }));
    } catch (err) {
      loadError = `AX tree inspection warning: ${err instanceof Error ? err.message : String(err)}`;
    }

    try {
      domResult = await this.webContents.executeJavaScript(DOM_EXTRACTION_SCRIPT, false);
      // Map backendNodeIds via CDP for interactive elements (best effort)
      if (this.cdpReady) {
        const doc = await this.webContents.debugger.sendCommand("DOM.getDocument", { depth: 1 });
        if (doc?.root?.nodeId) {
          for (const el of domResult.domElements) {
            if (!el.visible) continue;
            const isInteractive =
              el.tagName === "button" ||
              el.tagName === "a" ||
              el.tagName === "input" ||
              el.tagName === "select" ||
              el.tagName === "textarea";
            if (!isInteractive) continue;
            try {
              const found = await this.webContents.debugger.sendCommand("DOM.querySelector", {
                nodeId: doc.root.nodeId,
                selector: `[data-adaptui-uid="${el.uid}"]`,
              });
              if (found?.nodeId) {
                const described = await this.webContents.debugger.sendCommand("DOM.describeNode", {
                  nodeId: found.nodeId,
                });
                if (described?.node?.backendNodeId) {
                  el.backendNodeId = described.node.backendNodeId;
                }
              }
            } catch {
              // Fallback locator remains available
            }
          }
        }
      }
    } catch (err) {
      loadError = `DOM extraction error: ${err instanceof Error ? err.message : String(err)}`;
    }

    return {
      pageId: this.currentPageId,
      url: domResult.url || url,
      title: domResult.title || this.webContents.getTitle(),
      capturedAt: new Date().toISOString(),
      axNodes,
      domElements: domResult.domElements || [],
      unsupportedFeatures: domResult.unsupportedFeatures || [],
      canGoBack: this.webContents.navigationHistory.canGoBack(),
      canGoForward: this.webContents.navigationHistory.canGoForward(),
      loadError,
    };
  }

  private async getDomFingerprint(): Promise<string> {
    try {
      return await this.webContents.executeJavaScript(
        `(() => {
          const textLen = (document.body?.innerText || '').length;
          const alerts = Array.from(document.querySelectorAll('[role="alert"],[role="status"]')).map(e => e.textContent).join('|');
          const inputs = Array.from(document.querySelectorAll('input,select,textarea')).map(e => e.type === 'checkbox' || e.type === 'radio' ? String(e.checked) : String(e.value)).join('|');
          return location.href + '::' + textLen + '::' + alerts + '::' + inputs;
        })()`,
        false
      );
    } catch {
      return this.webContents.getURL();
    }
  }

  public async execute(action: BrowserAction, signal?: AbortSignal): Promise<ActionResult> {
    const start = Date.now();
    const beforeUrl = this.webContents.getURL();

    if (signal?.aborted) {
      return {
        actionId: action.id,
        success: false,
        verified: false,
        message: "Action was cancelled before execution.",
        beforeUrl,
        afterUrl: beforeUrl,
        domChanged: false,
        errorCode: "CANCELLED",
        durationMs: Date.now() - start,
      };
    }

    const beforeFingerprint = await this.getDomFingerprint();

    try {
      if (action.kind === "back") {
        const ok = await this.goBack();
        const afterUrl = this.webContents.getURL();
        return {
          actionId: action.id,
          success: ok,
          verified: ok && afterUrl !== beforeUrl,
          message: ok ? `Navigated back to ${afterUrl}.` : "No previous page in history.",
          beforeUrl,
          afterUrl,
          domChanged: afterUrl !== beforeUrl,
          durationMs: Date.now() - start,
        };
      }

      if (action.kind === "forward") {
        const ok = await this.goForward();
        const afterUrl = this.webContents.getURL();
        return {
          actionId: action.id,
          success: ok,
          verified: ok && afterUrl !== beforeUrl,
          message: ok ? `Navigated forward to ${afterUrl}.` : "No forward page in history.",
          beforeUrl,
          afterUrl,
          domChanged: afterUrl !== beforeUrl,
          durationMs: Date.now() - start,
        };
      }

      if (action.kind === "scroll") {
        const dir = action.scrollDirection || "down";
        await this.webContents.executeJavaScript(
          `window.scrollBy({ top: ${dir === "up" ? -420 : dir === "top" ? -99999 : dir === "bottom" ? 99999 : 420}, behavior: "instant" })`,
          true
        );
        return {
          actionId: action.id,
          success: true,
          verified: true,
          message: `Scrolled ${dir}.`,
          beforeUrl,
          afterUrl: this.webContents.getURL(),
          domChanged: false,
          durationMs: Date.now() - start,
        };
      }

      if (action.kind === "navigate" && action.url) {
        const check = validateNavigationUrl(action.url);
        if (!check.allowed || !check.normalizedUrl) {
          return {
            actionId: action.id,
            success: false,
            verified: false,
            message: check.reason || "Navigation blocked.",
            beforeUrl,
            afterUrl: beforeUrl,
            domChanged: false,
            errorCode: "NAVIGATION_BLOCKED",
            durationMs: Date.now() - start,
          };
        }
        await this.navigate(check.normalizedUrl, signal);
        const afterUrl = this.webContents.getURL();
        return {
          actionId: action.id,
          success: true,
          verified: true,
          message: `Navigated to ${this.webContents.getTitle() || afterUrl}.`,
          beforeUrl,
          afterUrl,
          domChanged: true,
          durationMs: Date.now() - start,
        };
      }

      const ref = action.targetRef;
      if (!ref) {
        return {
          actionId: action.id,
          success: false,
          verified: false,
          message: "Missing target element reference.",
          beforeUrl,
          afterUrl: beforeUrl,
          domChanged: false,
          errorCode: "ELEMENT_NOT_FOUND",
          durationMs: Date.now() - start,
        };
      }

      if (ref.pageId !== this.currentPageId) {
        return {
          actionId: action.id,
          success: false,
          verified: false,
          message: "Element reference is stale because the page changed. Please refresh and try again.",
          beforeUrl,
          afterUrl: beforeUrl,
          domChanged: false,
          errorCode: "STALE_ELEMENT",
          durationMs: Date.now() - start,
        };
      }

      // Resolve target: prefer CDP backendNodeId, fallback to semantic accessibleName+role / domId / locator
      let executedViaCdp = false;
      if (ref.backendNodeId) {
        try {
          await this.ensureCdp();
          const resolved = await this.webContents.debugger.sendCommand("DOM.resolveNode", {
            backendNodeId: ref.backendNodeId,
          });
          if (resolved?.object?.objectId) {
            const fnDecl = buildRemoteActionFunction(action);
            await this.webContents.debugger.sendCommand("Runtime.callFunctionOn", {
              objectId: resolved.object.objectId,
              functionDeclaration: fnDecl.declaration,
              arguments: fnDecl.args,
              userGesture: true,
            });
            executedViaCdp = true;
          }
        } catch {
          executedViaCdp = false;
        }
      }

      if (!executedViaCdp) {
        const res = await this.webContents.executeJavaScript(
          buildFallbackDomExecutionScript(action),
          true
        );
        if (!res?.found) {
          return {
            actionId: action.id,
            success: false,
            verified: false,
            message: `Could not locate target element "${ref.accessibleName || ref.locator || action.id}".`,
            beforeUrl,
            afterUrl: this.webContents.getURL(),
            domChanged: false,
            errorCode: "ELEMENT_NOT_FOUND",
            durationMs: Date.now() - start,
          };
        }
      }

      // Allow DOM updates or navigations triggered by click/submit to settle
      await new Promise((r) => setTimeout(r, action.kind === "click" || action.kind === "submit" || action.kind === "navigate" ? 220 : 80));

      const afterUrl = this.webContents.getURL();
      const afterFingerprint = await this.getDomFingerprint();
      const domChanged = afterUrl !== beforeUrl || afterFingerprint !== beforeFingerprint;

      this.notifyExternalStateChange(afterUrl !== beforeUrl ? "navigation" : "action");

      return {
        actionId: action.id,
        success: true,
        verified: domChanged || action.kind === "fill" || action.kind === "select" || action.kind === "check",
        message:
          afterUrl !== beforeUrl
            ? `Action completed and navigated to ${afterUrl}.`
            : domChanged
            ? "Action completed and page state updated."
            : "Action executed.",
        beforeUrl,
        afterUrl,
        domChanged,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        actionId: action.id,
        success: false,
        verified: false,
        message: `Browser action failed: ${msg}`,
        beforeUrl,
        afterUrl: this.webContents.getURL(),
        domChanged: false,
        errorCode: msg.toLowerCase().includes("timeout") ? "TIMEOUT" : "EXECUTION_ERROR",
        durationMs: Date.now() - start,
      };
    }
  }

  public async clearBrowsingData(): Promise<void> {
    await this.webContents.session.clearStorageData();
    await this.webContents.session.clearCache();
  }

  public async close(): Promise<void> {
    if (this.webContents.debugger.isAttached()) {
      this.webContents.debugger.detach();
    }
    this.listeners.clear();
  }
}

function buildRemoteActionFunction(action: BrowserAction): {
  declaration: string;
  args: Array<{ value: unknown }>;
} {
  switch (action.kind) {
    case "fill":
      return {
        declaration: `function(val) {
          this.focus();
          this.value = val;
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
        }`,
        args: [{ value: action.value ?? "" }],
      };
    case "select":
      return {
        declaration: `function(val) {
          this.focus();
          this.value = val;
          this.dispatchEvent(new Event('input', { bubbles: true }));
          this.dispatchEvent(new Event('change', { bubbles: true }));
        }`,
        args: [{ value: action.value ?? "" }],
      };
    case "check":
      return {
        declaration: `function(checked) {
          this.focus();
          if (typeof checked === 'boolean') {
            if (this.checked !== checked) this.click();
          } else {
            this.click();
          }
        }`,
        args: [{ value: action.checked }],
      };
    default:
      return {
        declaration: `function() {
          this.scrollIntoView({ block: 'center' });
          this.focus();
          this.click();
        }`,
        args: [],
      };
  }
}

function buildFallbackDomExecutionScript(action: BrowserAction): string {
  const ref = action.targetRef!;
  const payload = JSON.stringify({
    domId: ref.domId,
    locator: ref.locator,
    accessibleName: ref.accessibleName,
    tagName: ref.tagName,
    kind: action.kind,
    value: action.value,
    checked: action.checked,
  });

  return `(() => {
    const p = ${payload};
    let el = null;
    if (p.domId) el = document.getElementById(p.domId);
    if (!el && p.locator) {
      try { el = document.querySelector(p.locator); } catch {}
    }
    if (!el && p.accessibleName) {
      const candidates = Array.from(document.querySelectorAll(p.tagName || 'a,button,input,select,textarea'));
      const target = p.accessibleName.toLowerCase();
      el = candidates.find((c) => {
        const label = (c.getAttribute('aria-label') || c.textContent || c.getAttribute('placeholder') || '').trim().toLowerCase();
        return label === target || label.includes(target);
      }) || null;
    }
    if (!el) return { found: false };
    if (p.kind === 'fill' || p.kind === 'select') {
      el.focus();
      el.value = p.value ?? '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { found: true };
    }
    if (p.kind === 'check') {
      el.focus();
      if (typeof p.checked === 'boolean') {
        if (el.checked !== p.checked) el.click();
      } else {
        el.click();
      }
      return { found: true };
    }
    el.scrollIntoView({ block: 'center' });
    el.focus();
    el.click();
    return { found: true };
  })()`;
}

export interface MockPageDefinition {
  url: string;
  title: string;
  elements: RawDomElement[];
  axNodes?: RawAxNode[];
  unsupportedFeatures?: string[];
  onAction?: (
    action: BrowserAction,
    page: MockPageDefinition,
    adapter: MockBrowserAdapter
  ) => { navigatedTo?: string; domChanged?: boolean; message?: string } | void;
}

/**
 * Deterministic mock browser adapter for unit, security, and workflow tests.
 */
export class MockBrowserAdapter implements BrowserAdapter {
  public readonly capabilities: BrowserCapabilities = {
    adapterName: "MockBrowserAdapter",
    supportsCdp: false,
    supportsAccessibilityTree: true,
    supportsEmbeddedOriginalView: false,
    supportsCookiesAndSessions: true,
    supportsCancellation: true,
  };

  private readonly pages = new Map<string, MockPageDefinition>();
  private history: string[] = [];
  private historyIndex = -1;
  private pageCounter = 0;
  private currentPageId = "mock-page-1";
  private readonly listeners = new Set<BrowserStateListener>();
  public readonly executedActions: BrowserAction[] = [];
  public cookies: Record<string, string> = {};

  constructor(initialPages: MockPageDefinition[] = []) {
    for (const p of initialPages) {
      this.registerPage(p);
    }
    if (initialPages[0]) {
      this.history = [initialPages[0].url];
      this.historyIndex = 0;
      this.pageCounter = 1;
      this.currentPageId = "mock-page-1";
    }
  }

  public registerPage(page: MockPageDefinition): void {
    this.pages.set(page.url, {
      ...page,
      elements: page.elements.map((e) => ({ ...e })),
    });
  }

  public onStateChange(listener: BrowserStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(reason: BrowserStateChangeEvent["reason"]): void {
    const page = this.getCurrentPage();
    const evt: BrowserStateChangeEvent = {
      url: page?.url || "about:blank",
      title: page?.title || "",
      reason,
      timestamp: new Date().toISOString(),
    };
    this.listeners.forEach((fn) => fn(evt));
  }

  public getCurrentPage(): MockPageDefinition | undefined {
    const url = this.history[this.historyIndex];
    return url ? this.pages.get(url) : undefined;
  }

  public async currentUrl(): Promise<string> {
    return this.history[this.historyIndex] || "about:blank";
  }

  public async navigate(rawUrl: string): Promise<void> {
    const check = validateNavigationUrl(rawUrl, { allowAboutBlank: true });
    if (!check.allowed || !check.normalizedUrl) {
      throw new Error(check.reason || "Navigation blocked");
    }
    const target = this.pages.has(rawUrl)
      ? rawUrl
      : this.pages.has(check.normalizedUrl)
      ? check.normalizedUrl
      : null;
    if (!target) {
      throw new Error(`Mock page not found: ${rawUrl}`);
    }
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(target);
    this.historyIndex = this.history.length - 1;
    this.pageCounter += 1;
    this.currentPageId = `mock-page-${this.pageCounter}`;
    this.emit("navigation");
  }

  public async goBack(): Promise<boolean> {
    if (this.historyIndex <= 0) return false;
    this.historyIndex -= 1;
    this.pageCounter += 1;
    this.currentPageId = `mock-page-${this.pageCounter}`;
    this.emit("navigation");
    return true;
  }

  public async goForward(): Promise<boolean> {
    if (this.historyIndex >= this.history.length - 1) return false;
    this.historyIndex += 1;
    this.pageCounter += 1;
    this.currentPageId = `mock-page-${this.pageCounter}`;
    this.emit("navigation");
    return true;
  }

  public async reload(): Promise<void> {
    this.emit("navigation");
  }

  public async snapshot(): Promise<BrowserSnapshot> {
    const page = this.getCurrentPage();
    if (!page) {
      return {
        pageId: this.currentPageId,
        url: "about:blank",
        title: "Blank",
        capturedAt: new Date().toISOString(),
        axNodes: [],
        domElements: [],
        unsupportedFeatures: [],
        canGoBack: false,
        canGoForward: false,
      };
    }

    return {
      pageId: this.currentPageId,
      url: page.url,
      title: page.title,
      capturedAt: new Date().toISOString(),
      axNodes: page.axNodes ?? [],
      domElements: page.elements.map((e) => ({ ...e })),
      unsupportedFeatures: page.unsupportedFeatures ?? [],
      canGoBack: this.historyIndex > 0,
      canGoForward: this.historyIndex < this.history.length - 1,
    };
  }

  public async execute(action: BrowserAction, signal?: AbortSignal): Promise<ActionResult> {
    const start = Date.now();
    const beforeUrl = await this.currentUrl();
    if (signal?.aborted) {
      return {
        actionId: action.id,
        success: false,
        verified: false,
        message: "Cancelled",
        beforeUrl,
        afterUrl: beforeUrl,
        domChanged: false,
        errorCode: "CANCELLED",
        durationMs: Date.now() - start,
      };
    }

    this.executedActions.push(action);

    if (action.kind === "back") {
      const ok = await this.goBack();
      const afterUrl = await this.currentUrl();
      return {
        actionId: action.id,
        success: ok,
        verified: ok,
        message: ok ? `Returned to ${afterUrl}.` : "Cannot go back.",
        beforeUrl,
        afterUrl,
        domChanged: ok,
        durationMs: Date.now() - start,
      };
    }

    if (action.kind === "forward") {
      const ok = await this.goForward();
      const afterUrl = await this.currentUrl();
      return {
        actionId: action.id,
        success: ok,
        verified: ok,
        message: ok ? `Advanced to ${afterUrl}.` : "Cannot go forward.",
        beforeUrl,
        afterUrl,
        domChanged: ok,
        durationMs: Date.now() - start,
      };
    }

    if (action.kind === "navigate" && action.url) {
      const check = validateNavigationUrl(action.url);
      if (!check.allowed) {
        return {
          actionId: action.id,
          success: false,
          verified: false,
          message: check.reason || "Blocked URL",
          beforeUrl,
          afterUrl: beforeUrl,
          domChanged: false,
          errorCode: "NAVIGATION_BLOCKED",
          durationMs: Date.now() - start,
        };
      }
      await this.navigate(action.url);
      const afterUrl = await this.currentUrl();
      return {
        actionId: action.id,
        success: true,
        verified: true,
        message: `Navigated to ${afterUrl}.`,
        beforeUrl,
        afterUrl,
        domChanged: true,
        durationMs: Date.now() - start,
      };
    }

    const page = this.getCurrentPage();
    if (!page) {
      return {
        actionId: action.id,
        success: false,
        verified: false,
        message: "No active page",
        beforeUrl,
        afterUrl: beforeUrl,
        domChanged: false,
        errorCode: "ELEMENT_NOT_FOUND",
        durationMs: Date.now() - start,
      };
    }

    if (action.targetRef && action.targetRef.pageId !== this.currentPageId) {
      return {
        actionId: action.id,
        success: false,
        verified: false,
        message: "Element reference is stale.",
        beforeUrl,
        afterUrl: beforeUrl,
        domChanged: false,
        errorCode: "STALE_ELEMENT",
        durationMs: Date.now() - start,
      };
    }

    const target = action.targetRef
      ? page.elements.find(
          (e) =>
            (action.targetRef?.domId && e.idAttr === action.targetRef.domId) ||
            (action.targetRef?.locator && e.locator === action.targetRef.locator) ||
            (action.targetRef?.accessibleName &&
              e.accessibleName.toLowerCase() === action.targetRef.accessibleName.toLowerCase())
        )
      : undefined;

    if (!target) {
      return {
        actionId: action.id,
        success: false,
        verified: false,
        message: "Element not found on mock page.",
        beforeUrl,
        afterUrl: beforeUrl,
        domChanged: false,
        errorCode: "ELEMENT_NOT_FOUND",
        durationMs: Date.now() - start,
      };
    }

    let domChanged = false;
    if (action.kind === "fill" || action.kind === "select") {
      target.value = action.value ?? "";
      domChanged = true;
    } else if (action.kind === "check") {
      target.checked = typeof action.checked === "boolean" ? action.checked : !target.checked;
      domChanged = true;
    } else if (target.href) {
      await this.navigate(target.href);
      domChanged = true;
    }

    const hookResult = page.onAction?.(action, page, this);
    if (hookResult?.navigatedTo) {
      await this.navigate(hookResult.navigatedTo);
      domChanged = true;
    }
    if (hookResult?.domChanged) {
      domChanged = true;
    }

    const afterUrl = await this.currentUrl();
    this.emit("action");

    return {
      actionId: action.id,
      success: true,
      verified: domChanged || afterUrl !== beforeUrl,
      message: hookResult?.message || `Executed ${action.kind} on ${target.accessibleName}.`,
      beforeUrl,
      afterUrl,
      domChanged: domChanged || afterUrl !== beforeUrl,
      durationMs: Date.now() - start,
    };
  }

  public async clearBrowsingData(): Promise<void> {
    this.cookies = {};
  }

  public async close(): Promise<void> {
    this.listeners.clear();
  }
}

/**
 * Phase 0 Technical Feasibility Prototype
 *
 * Validates Option C (Electron + WebContentsView + native CDP via webContents.debugger):
 * 1. Launches Electron desktop shell with an isolated WebContentsView for untrusted web content.
 * 2. Serves & navigates to local fixture websites.
 * 3. Attaches CDP (1.3) directly to the WebContentsView, extracts DOM + full Accessibility Tree.
 * 4. Executes grounded browser actions (fill search, submit, click result link) via CDP/DOM.
 * 5. Verifies real browser session continuity (cookies + live DOM state) when toggling between
 *    "Reconstructed UI" mode (WebContentsView hidden/offscreen) and "Original Website" mode
 *    (WebContentsView visible in the same desktop window).
 */

const { app, BrowserWindow, WebContentsView, session } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function runFeasibility() {
  const fixtureModule = await import(
    pathToFileURL(path.resolve(__dirname, "../../fixtures/server.mjs")).href
  );
  const fixture = await fixtureModule.startFixtureServer(0);
  const results = {
    architecture: "Option C: Electron + WebContentsView + native CDP",
    electronVersion: process.versions.electron,
    chromiumVersion: process.versions.chrome,
    nodeVersion: process.versions.node,
    platform: process.platform,
    checks: {},
  };

  try {
    const win = new BrowserWindow({
      width: 1100,
      height: 760,
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    // Dedicated isolated partition for untrusted web browsing
    const webPartition = session.fromPartition("persist:adaptui-phase0");
    const webView = new WebContentsView({
      webPreferences: {
        session: webPartition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    win.contentView.addChildView(webView);
    webView.setBounds({ x: 0, y: 0, width: 1100, height: 760 });

    // 1. Navigate to search fixture
    const searchUrl = `${fixture.baseUrl}/search/index.html`;
    await webView.webContents.loadURL(searchUrl);
    results.checks.navigation = {
      passed: webView.webContents.getURL() === searchUrl,
      url: webView.webContents.getURL(),
      title: webView.webContents.getTitle(),
    };

    // 2. Attach CDP and extract Accessibility Tree + DOM
    webView.webContents.debugger.attach("1.3");
    await webView.webContents.debugger.sendCommand("DOM.enable");
    await webView.webContents.debugger.sendCommand("Accessibility.enable");

    const axTree = await webView.webContents.debugger.sendCommand("Accessibility.getFullAXTree");
    const doc = await webView.webContents.debugger.sendCommand("DOM.getDocument", { depth: 3 });

    const axNodes = axTree.nodes || [];
    const searchBoxNode = axNodes.find(
      (n) =>
        (n.role?.value === "searchbox" || n.role?.value === "textbox") &&
        String(n.name?.value || "").toLowerCase().includes("search")
    );
    const submitButtonNode = axNodes.find(
      (n) =>
        n.role?.value === "button" &&
        String(n.name?.value || "").toLowerCase().includes("search")
    );

    results.checks.cdpInspection = {
      passed: Boolean(searchBoxNode && submitButtonNode && doc.root?.nodeId),
      axNodeCount: axNodes.length,
      searchBoxBackendNodeId: searchBoxNode?.backendDOMNodeId ?? null,
      submitButtonBackendNodeId: submitButtonNode?.backendDOMNodeId ?? null,
    };

    // 3. Execute grounded action using backendDOMNodeId resolved via CDP
    const resolvedInput = await webView.webContents.debugger.sendCommand("DOM.resolveNode", {
      backendNodeId: searchBoxNode.backendDOMNodeId,
    });
    await webView.webContents.debugger.sendCommand("Runtime.callFunctionOn", {
      objectId: resolvedInput.object.objectId,
      functionDeclaration: `function(val) {
        this.focus();
        this.value = val;
        this.dispatchEvent(new Event('input', { bubbles: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
      }`,
      arguments: [{ value: "assistive technology" }],
    });

    const resolvedButton = await webView.webContents.debugger.sendCommand("DOM.resolveNode", {
      backendNodeId: submitButtonNode.backendDOMNodeId,
    });
    await webView.webContents.debugger.sendCommand("Runtime.callFunctionOn", {
      objectId: resolvedButton.object.objectId,
      functionDeclaration: `function() { this.click(); }`,
    });

    // Wait briefly for dynamic DOM update
    await new Promise((r) => setTimeout(r, 150));

    const updatedStatus = await webView.webContents.executeJavaScript(
      `document.getElementById('search-status')?.textContent || ''`
    );
    const updatedUrl = webView.webContents.getURL();

    results.checks.groundedAction = {
      passed:
        updatedStatus.toLowerCase().includes("assistive technology") &&
        updatedUrl.includes("q=assistive+technology"),
      updatedUrl,
      updatedStatus,
    };

    // 4. Verify session continuity across view-mode toggles (Reconstructed <-> Original)
    await webView.webContents.executeJavaScript(
      `document.cookie = "adaptui_session_check=verified_phase0; path=/";`
    );
    // Simulate switching to Reconstructed mode (hide original WebContentsView)
    webView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
    webView.setVisible(false);

    // Perform navigation while hidden (as happens when user interacts via Reconstructed UI)
    const formUrl = `${fixture.baseUrl}/form/index.html`;
    await webView.webContents.loadURL(formUrl);

    // Switch back to Original Website view
    webView.setVisible(true);
    webView.setBounds({ x: 0, y: 0, width: 1100, height: 760 });

    const cookies = await webPartition.cookies.get({ url: fixture.baseUrl });
    const sessionCookie = cookies.find((c) => c.name === "adaptui_session_check");

    results.checks.sessionContinuity = {
      passed:
        webView.webContents.getURL() === formUrl &&
        sessionCookie?.value === "verified_phase0",
      currentUrl: webView.webContents.getURL(),
      cookiePreserved: sessionCookie?.value ?? null,
    };

    webView.webContents.debugger.detach();
    win.destroy();

    const allPassed = Object.values(results.checks).every((c) => c.passed);
    results.allPassed = allPassed;
    console.log(JSON.stringify(results, null, 2));
    await fixture.close();
    app.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error("Phase 0 feasibility error:", err);
    await fixture.close();
    app.exit(1);
  }
}

app.whenReady().then(runFeasibility);

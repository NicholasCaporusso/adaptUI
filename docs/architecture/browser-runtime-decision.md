# Architecture Decision Record: Browser Runtime Selection

- **Date:** 2026-11-21
- **Status:** Accepted and Validated (Phase 0 Prototype Passed)
- **Decision:** Adopt **Option C — Electron (v35.7.5 / Chromium 134) + `WebContentsView` + native Chromium DevTools Protocol (`webContents.debugger`)**, paired with a strict `BrowserAdapter` abstraction so alternative runtimes (such as Playwright or a future Tauri/CDP adapter) can be plugged in without rewriting core modules.

---

## 1. Requirements & Evaluation Criteria

AdaptUI requires a desktop browser architecture that satisfies all of the following:

1. **Single authoritative browser session:** Both the reconstructed accessible UI and the original website fallback view must share the exact same live browser session (cookies, authentication state, history, DOM state).
2. **Full DOM & Accessibility-Tree inspection:** Reliable access to semantic roles, accessible names, descriptions, live states, and stable backend node references (`backendDOMNodeId`).
3. **Reliable grounded action execution & verification:** Ability to re-resolve targets, execute click/fill/select/check/submit/navigate/scroll operations, and observe resulting DOM/URL changes.
4. **Strict security isolation:** Untrusted websites must never gain access to Node.js APIs, AI provider credentials, or application configuration.
5. **Cross-platform consistency:** Identical browser engine and automation protocol across Windows, macOS, and Linux.
6. **Reproducible packaging & local toolchain viability:** Practical distribution and immediate buildability.

---

## 2. Comparison of Architectural Options

| Criterion | Option A: Tauri 2 + Managed Chromium/Playwright | Option B: Tauri 2 + System WebView Bridge | Option C: Electron + `WebContentsView` + Native CDP *(Selected)* |
|---|---|---|---|
| **Browser engine parity (Win/macOS/Linux)** | High (Chromium everywhere) | Low (WebView2 / WKWebView / WebKitGTK diverge significantly) | **High** (Embedded Chromium 134 everywhere) |
| **Accessibility-tree inspection (CDP `Accessibility.getFullAXTree`)** | Yes (over external CDP WebSocket) | **No** — WKWebView and WebKitGTK do not expose CDP | **Yes** — native `webContents.debugger` (`1.3`) built directly into Chromium |
| **Shared session between Reconstructed & Original views** | **Hard / fragmented** — Tauri's WebView cannot share cookies/DOM with an external Chromium process; requires either a separate Chromium OS window or screencasting frames | Partial (single WebView, but fragile script injection & CSP/cross-origin conflicts) | **Native & seamless** — a single `WebContentsView` holds the live website session and toggles visibility/bounds inside the desktop shell |
| **Process & lifecycle management** | Must bundle/locate Chromium binary + manage child process crashes/ports | Lightweight (system WebView) | **Unified** — Electron manages Chromium renderer processes natively with crash recovery events |
| **Security isolation** | Good (separate OS process) | Risky if injecting privileged bridges into untrusted origins | **Strong** — dedicated `session.fromPartition('persist:adaptui-web')`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, zero preload bridge on web view |
| **Packaging & footprint** | Smaller Rust shell, but bundling Chromium (~150MB+) negates size savings | Smallest (~10–20MB), but lacks reliable automation | ~120–160MB installer via `electron-builder` (NSIS/DMG/AppImage), self-contained with zero external browser dependency |
| **Local dev environment readiness** | Requires Rust toolchain (`rustc`/`cargo`) + MSVC + Chromium | Requires Rust toolchain (`rustc`/`cargo`) | Ready immediately on Node.js v22 + TypeScript |

---

## 3. Empirical Validation (Phase 0 Feasibility Prototype)

We implemented and executed [tests/phase0-feasibility/main.cjs](file:///c:/Users/Nicholas/Desktop/adaptUI/tests/phase0-feasibility/main.cjs) against our local fixture websites (`npm run phase0`) on Windows (`win32`, Electron `35.7.5`, Chromium `134.0.6998.205`, Node `22.16.0`):

| Check | Result | Empirical Evidence |
|---|---|---|
| **1. Isolated Navigation** | PASS | Loaded `http://127.0.0.1:<port>/search/index.html` inside sandboxed `WebContentsView` (`persist:adaptui-phase0`) |
| **2. Native CDP DOM + AX Inspection** | PASS | `Accessibility.getFullAXTree` returned **102 AX nodes**; located search box (`backendDOMNodeId: 20`) and submit button (`backendDOMNodeId: 34`) |
| **3. Grounded Action & Verification** | PASS | Resolved `backendNodeId` via `DOM.resolveNode`, filled `"assistive technology"`, clicked Submit, verified updated URL (`?q=assistive+technology`) and live status (`Found 1 result for "assistive technology".`) |
| **4. Session Continuity Across View Switches** | PASS | Set session cookie, hid `WebContentsView` (reconstructed mode), navigated to `/form/index.html`, re-showed `WebContentsView` (original mode), confirmed URL and cookie `adaptui_session_check=verified_phase0` persisted intact |

---

## 4. Security & Trust Boundary Architecture

- **App Shell Renderer (`BrowserWindow`):** Runs local AdaptUI React UI only, with `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, and a minimal typed preload IPC bridge (`window.adaptui`).
- **Untrusted Website View (`WebContentsView`):** Runs in an isolated Electron session partition (`persist:adaptui-web`), `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, with **no preload script** and **no IPC access**.
- **Main Process Broker:** Owns the `ElectronCdpBrowserAdapter`, SQLite database, OS credential store (`safeStorage`), AI provider clients, and security validation gates. Website JavaScript can never see AI API keys, local storage, or Electron APIs.
- **Navigation Guards:** `will-navigate` and `setWindowOpenHandler` block dangerous schemes (`javascript:`, `data:`, `vbscript:`) and route popups safely within policy boundaries.

---

## 5. Known Cross-Platform Limitations & Mitigations

- **Windows validated first:** Phase 0 and full integration/E2E tests are verified on `win32`. macOS (`.dmg`) and Linux (`.AppImage`/`.deb`) packaging targets are configured in `apps/desktop/electron-builder.yml` and documented in [docs/development/setup.md](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/development/setup.md), but must be built and verified on native macOS/Linux hosts before claiming full cross-platform certification.
- **Closed Shadow DOM / Cross-Origin Iframes:** Standard browser security boundaries restrict DOM inspection inside cross-origin iframes and closed shadow roots. AdaptUI explicitly detects and reports these in `SemanticPage.unsupportedFeatures` rather than attempting to bypass browser security boundaries.
- **Pluggability:** Because all upper layers depend only on the `BrowserAdapter` interface in `@adaptui/browser-core`, a Playwright or future Rust/Tauri adapter can be swapped in without modifying semantic modeling, UI reconstruction, or command execution.

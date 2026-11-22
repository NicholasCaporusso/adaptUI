# Browser Adapter API Documentation (`@adaptui/browser-core`)

AdaptUI isolates all browser runtime specifics behind the `BrowserAdapter` interface so the semantic model, UI generator, and command agent remain completely runtime-agnostic.

## Interface Contract

```ts
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
```

## Implementations

### 1. `ElectronCdpBrowserAdapter`
- Connects directly to an Electron `WebContentsView` via native CDP `1.3` (`webContents.debugger`).
- Extracts both `Accessibility.getFullAXTree` and DOM semantics (`DOM_EXTRACTION_SCRIPT`), resolving `backendDOMNodeId` for interactive controls.
- Executes actions by resolving `backendNodeId` (`DOM.resolveNode` + `Runtime.callFunctionOn`), falling back to `domId` / `locator` / accessible name + role if the DOM refreshed.
- Verifies every action by comparing pre-action and post-action URLs and DOM state fingerprints (text length, live alerts/statuses, form values) and returns explicit error codes (`STALE_ELEMENT`, `ELEMENT_NOT_FOUND`, `NAVIGATION_BLOCKED`, `TIMEOUT`, `CANCELLED`, `EXECUTION_ERROR`).

### 2. `MockBrowserAdapter`
- Stateful, deterministic in-memory browser adapter supporting multi-page navigation, history stacks, form state, dynamic action hooks, cookies, and simulated stale references for fast unit, integration, and security tests.

## Integrating Future Browser Agents
To integrate a Playwright or external browser-agent backend, implement `BrowserAdapter` in a new adapter class and supply it to the main orchestrator — zero changes are required in `@adaptui/semantic-model`, `@adaptui/ui-schema`, `@adaptui/command-agent`, or `@adaptui/accessible-ui`.

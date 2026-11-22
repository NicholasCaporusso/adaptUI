# Security & Privacy Architecture (`@adaptui/security`)

AdaptUI treats every website as an **untrusted environment**. Website text, DOM nodes, `aria-label` attributes, and metadata are never promoted to trusted instructions.

## 1. Trust Boundaries

| Boundary | Enforcement Mechanism |
|---|---|
| **Untrusted Website vs. Desktop Shell** | Website renders in an isolated `WebContentsView` (`session.fromPartition('persist:adaptui-web')`, `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, zero preload bridge). |
| **App Shell vs. Main Process** | Minimal typed preload bridge (`window.adaptui`) via `contextBridge`; strict Content Security Policy (`default-src 'self'; script-src 'self'`). |
| **Website Content vs. AI Prompts** | `detectAndSanitizePromptInjection()` scans visible & hidden nodes, strips fake `[SYSTEM: ...]` directives, and `wrapUntrustedWebsiteData()` encloses all website JSON inside explicit `<untrusted_website_content>` boundaries. |
| **AI Output vs. Browser Execution** | Every action proposed by an LLM is re-grounded against `SemanticPage.actions` (invented action IDs are rejected), and `validateAccessibleUISpec()` rejects unknown components, executable code props, missing required fields, or confirmation downgrades. |
| **AI Provider Credentials** | Cloud API keys are encrypted via OS credential protection (`Electron safeStorage` — DPAPI on Windows, Keychain on macOS, libsecret on Linux) in `credentials.enc.json` (`0600`), never written to plaintext SQLite, never sent to renderer/website JS, and scrubbed from logs. |

## 2. Consequential Action Policy

`classifyActionRisk()` enforces mandatory user confirmation before:
- Purchases, payments, checkout, transfers, donations
- Deleting or erasing data / closing accounts
- Sending messages or publishing content
- Modifying security/privacy settings
- Submitting consequential (non-search) forms
- Under `confirmationLevel: "enhanced"`, all clicks, navigations, and form submissions

Website text claiming `"user already confirmed"` or `"skip confirmation"` cannot reduce or bypass confirmation.

## 3. Navigation & Link Safety

- `validateNavigationUrl()` allows only `http:` and `https:` URLs.
- `javascript:`, `data:`, `vbscript:`, `file:`, `chrome:`, and `electron:` schemes are rejected during extraction, command execution, and Electron's `will-navigate` / `setWindowOpenHandler` hooks.

## 4. Privacy Controls

Users control all data flows via the **AI & Privacy** panel:
- **Local-Only Mode (Default):** Hard-blocks all remote AI calls even if a cloud key exists or `allowCloudFallback` is toggled.
- **Remote Page Content Permission (`allowRemotePageContent`):** Disabled by default; blocks sending page content to cloud providers unless explicitly enabled.
- **Sensitive Field Redaction:** Passwords, credit cards, CVVs, SSNs, and API tokens are excluded from `SemanticPage` values and removed from remote AI payloads (`sanitizeSemanticPageForRemoteAI()`).
- **Email & Phone Redaction (`redactEmailsAndPhones`):** Enabled by default.
- **Consent-Gated Evaluation Telemetry (`enableEvaluationTelemetry`):** Off by default; stored only in local SQLite when enabled.
- **One-Click Data Clearing:** Clear isolated browsing cookies/storage/cache and clear local personalization/evaluation history independently.

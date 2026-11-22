# Evaluation Metrics & Known Limitations

## 1. Instrumented Evaluation Metrics

AdaptUI includes consent-gated local evaluation instrumentation in `@adaptui/personalization` (stored exclusively in local SQLite when `enableEvaluationTelemetry` is enabled):

- `task-completed` (with `durationMs`)
- `interaction` (UI actions, navigations)
- `action-failed`
- `repeated-attempt`
- `reconstruction-failed`
- `browser-execution-failed`
- `user-fallback-original` (tracks when users switch to the Original Website view)
- `user-feedback` (`helpful` / `needs-improvement` + qualitative notes)

All counts and recent records are inspectable locally via the **Diagnostics** panel and can be erased in one click via **AI & Privacy -> Clear History & Metrics**.

> **Important Research Disclaimer:** Automated developer testing and fixture evaluations validate software correctness, accessibility markup, and security invariants — they do **not** constitute clinical evidence of usability for people living with ALS. Formal user studies with people living with ALS and assistive-technology specialists are required before making clinical usability claims.

---

## 2. Known Limitations

1. **Cross-Origin Iframes & Canvas Applications:** Browser security boundaries prevent inspecting DOM inside cross-origin `<iframe>` elements or pixel-rendered `<canvas>` / WebGL applications. AdaptUI explicitly detects and flags these in `unsupportedFeatures` and directs users to the **Original Website** fallback.
2. **Complex SPA Virtualization & Custom Widgets:** Websites using non-semantic `<div>` grids without ARIA roles/labels may extract with lower confidence or incomplete interactive bindings.
3. **Bounded Website Scope:** MVP testing verifies three deterministic fixture workflows (Information Retrieval, Search & Navigation, Form Interaction), an adversarial security fixture, and `https://example.com`. General compatibility across arbitrary commercial websites (e.g., complex banking, CAPTCHA-gated portals, or anti-bot sites) is not claimed.
4. **Assistive Hardware Verification:** Profiles provide keyboard-only navigation, switch-compatible scanning focus cycling, and large eye-gaze control dimensions/spacing, but have not yet been validated on physical eye-tracking hardware (e.g., Tobii) or hardware switch boxes.
5. **Cross-Platform Installer Verification:** Builds, Phase 0 feasibility, and Electron E2E tests have been executed and verified on **Windows (`win32`)**. macOS (`.dmg`) and Linux (`.AppImage`/`.deb`) builds must be tested natively on those operating systems.
6. **Offline Default AI Behavior:** When neither Ollama nor a cloud API key is configured, AdaptUI operates reliably via its deterministic semantic extraction, UI generation, and command-grounding engine. More nuanced open-ended phrasing benefits from connecting a local Ollama model or configured cloud provider.

# AdaptUI — Cross-Platform Accessible AI Browser

AdaptUI is a desktop accessibility browser that transforms websites into simpler, personalized, WCAG 2.2 AA task-oriented interfaces and enables users to operate websites through grounded, verified natural-language text commands.

## Architecture Highlights

- **Desktop Shell & Authoritative Browser Runtime:** Electron + isolated `WebContentsView` + native Chromium DevTools Protocol (`webContents.debugger`), verified in Phase 0 ([ADR](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/architecture/browser-runtime-decision.md)). Reconstructed and Original Website views share a single live browser session (cookies, auth, navigation history, DOM).
- **Shared Semantic Website Model (`@adaptui/semantic-model`):** Merges CDP Accessibility Trees and DOM metadata into a versioned, Zod-validated source of truth used by both UI reconstruction and command execution.
- **Declarative Accessible UI (`@adaptui/ui-schema`, `@adaptui/accessible-ui`):** 18 WCAG 2.2 AA React primitives rendered strictly from validated declarative JSON specifications — never LLM-generated executable JS or raw untrusted HTML.
- **Natural-Language Command Agent (`@adaptui/command-agent`):** Grounds multi-step commands against the live semantic model, refreshes state between steps, verifies browser outcomes, requests disambiguation when ambiguous, and enforces explicit confirmation before consequential actions.
- **Hybrid Privacy-Preserving AI (`@adaptui/ai-core`, `@adaptui/ai-providers`):** Supports Local (Ollama-compatible), Cloud (OpenAI-compatible, Anthropic, Gemini), and Deterministic Mock providers with strict `local-only` isolation, OS-encrypted API keys (`safeStorage`), and sensitive-field redaction.
- **Persistent Accessibility Profiles & Telemetry (`@adaptui/personalization`):** Local SQLite storage (`sql.js`) for live-switchable profiles (text scaling, high/dark contrast, target size, spacing, reduced motion, eye-gaze layout, switch scanning, step-by-step forms) and consent-gated evaluation diagnostics.

## Quick Start

```bash
npm install
npm run build
npm run dev
```

## Verification & Test Commands

```bash
npm run phase0          # Phase 0 Electron + WebContentsView + CDP feasibility check
npm run typecheck       # Strict TypeScript check across all 10 packages + desktop app
npm run test            # Unit + Integration + Security + Accessibility (axe-core) suites
npm run test:e2e        # Real Electron Playwright E2E suite (workflows + public site demo)
```

## Documentation

- [Architecture Overview](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/architecture/overview.md)
- [Browser Runtime Decision Record (ADR)](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/architecture/browser-runtime-decision.md)
- [Semantic Website Model Specification](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/architecture/semantic-model.md)
- [Browser Adapter API](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/architecture/browser-adapter-api.md)
- [Accessibility Profiles Specification](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/architecture/accessibility-profiles.md)
- [AI Provider Configuration](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/development/ai-providers.md)
- [Local Speech Recognition & Voice Commands](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/development/voice-recognition.md)
- [Security & Privacy](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/security/security-and-privacy.md)
- [Development Setup & Cross-Platform Packaging](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/development/setup.md)
- [MVP Demonstration Walkthrough](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/development/walkthrough.md)
- [Evaluation Metrics & Known Limitations](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/evaluation/metrics-and-limitations.md)
- [Prioritized Backlog](file:///c:/Users/Nicholas/Desktop/adaptUI/docs/evaluation/backlog.md)

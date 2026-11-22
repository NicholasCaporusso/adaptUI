# Prioritized Backlog for Future Development

## P0 — Immediate Post-MVP Hardening
1. **Native macOS & Linux CI Validation:** Run `npm run phase0`, `npm run test`, `npm run test:e2e`, and `electron-builder` packaging on macOS and Linux runners.
2. **Real-Time DOM Mutation Observer Bridge:** Stream incremental DOM mutation notifications from `WebContentsView` via CDP `DOM.documentUpdated` to keep reconstructed UI synchronized with live background SPA updates (e.g., chat feeds, stock tickers, async notifications).
3. **Assistive Hardware Usability Testing:** Conduct structured evaluation sessions with physical switch-access devices, eye-gaze trackers, screen readers (NVDA, VoiceOver, Orca), and people living with ALS.

## P1 — Expanded Web & AI Capabilities
4. **Playwright External Browser Adapter:** Implement a `PlaywrightBrowserAdapter` conforming to `BrowserAdapter` for headless CI benchmarking and multi-browser comparisons.
5. **Richer Multi-Page Workflow Memory:** Track multi-step checkout/booking wizards spanning several URL transitions with reversible step history.
6. **Streaming Local Model Support & Capability Probing:** Automatically benchmark connected Ollama models on a built-in JSON-schema compliance probe before enabling them for command planning.
7. **Consent-Gated Reversible Adaptation UI:** Surface recommendations from `ConservativePersonalizationAdvisor` in a non-intrusive banner with one-click Accept / Revert controls.

## P2 — Platform Expansion
8. **Voice Input & Text-to-Speech Integration:** Optional local speech-to-text command input and accessible spoken confirmation summaries.
9. **Multi-Tab Session Support:** Accessible tab switcher managing multiple isolated `WebContentsView` sessions.
10. **Desktop Application Automation Layer (Proposal Extension):** Implement OS Accessibility API adapters (Windows UI Automation, macOS AXUIElement, Linux AT-SPI) targeting the same `@adaptui/semantic-model`, `@adaptui/ui-schema`, and `@adaptui/command-agent` core packages without redesign.

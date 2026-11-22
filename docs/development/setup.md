# Development Setup, Build & Cross-Platform Packaging

## Prerequisites

- **Node.js:** v22.x LTS (`v22.17.1` verified)
- **npm:** v10.x (`10.9.2` verified)
- **Operating System:**
  - **Windows (Verified Primary Platform):** Windows 10/11 x64
  - **macOS (Documented, requires native-host validation):** macOS 13+ (Apple Silicon / Intel)
  - **Linux (Documented, requires native-host validation):** Ubuntu 22.04+ / Fedora with standard Chromium desktop libraries (`libgtk-3`, `libnss3`, `libasound2`)
- **Optional Local AI:** Ollama (`http://127.0.0.1:11434`)

## Local Development Setup

```bash
# 1. Install workspace dependencies
npm install

# 2. Build all shared packages and the Electron desktop bundle
npm run build

# 3. Typecheck the entire monorepo
npm run typecheck

# 4. Launch the AdaptUI desktop application
npm run dev
```

## Running Automated Tests

```bash
# Phase 0 browser-runtime feasibility check (Electron + WebContentsView + CDP)
npm run phase0

# Unit, Integration, Security, and Accessibility (axe-core) suites
npm run test

# Individual suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:a11y

# End-to-End Electron Playwright suite (launches real compiled desktop app)
npm run test:e2e
```

## Packaging Platform Installers

Installer targets are configured in [apps/desktop/electron-builder.yml](file:///c:/Users/Nicholas/Desktop/adaptUI/apps/desktop/electron-builder.yml):

```bash
# Windows (NSIS installer + Portable executable)
npm run package:win

# macOS (DMG — run on macOS host with signing identity for distribution)
npm run package:mac

# Linux (AppImage + deb — run on Linux host)
npm run package:linux
```

> **Cross-Platform Certification Note:** Builds, Phase 0 feasibility, unit/integration/security/accessibility tests, and Electron Playwright E2E tests have been validated on Windows (`win32`). macOS and Linux installers must be built and verified on native macOS/Linux machines before claiming full cross-platform release readiness.

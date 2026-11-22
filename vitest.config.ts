import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    environmentMatchGlobs: [["tests/accessibility/**", "jsdom"]],
  },
  resolve: {
    alias: {
      "@adaptui/shared-types": path.resolve(__dirname, "packages/shared-types/src/index.ts"),
      "@adaptui/security": path.resolve(__dirname, "packages/security/src/index.ts"),
      "@adaptui/semantic-model": path.resolve(__dirname, "packages/semantic-model/src/index.ts"),
      "@adaptui/ui-schema": path.resolve(__dirname, "packages/ui-schema/src/index.ts"),
      "@adaptui/accessible-ui": path.resolve(__dirname, "packages/accessible-ui/src/index.tsx"),
      "@adaptui/browser-core": path.resolve(__dirname, "packages/browser-core/src/index.ts"),
      "@adaptui/ai-core": path.resolve(__dirname, "packages/ai-core/src/index.ts"),
      "@adaptui/ai-providers": path.resolve(__dirname, "packages/ai-providers/src/index.ts"),
      "@adaptui/speech-core": path.resolve(__dirname, "packages/speech-core/src/index.ts"),
      "@adaptui/command-agent": path.resolve(__dirname, "packages/command-agent/src/index.ts"),
      "@adaptui/personalization": path.resolve(__dirname, "packages/personalization/src/index.ts"),
    },
  },
});

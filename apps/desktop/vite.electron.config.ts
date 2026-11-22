import { defineConfig } from "vite";
import path from "node:path";
import { builtinModules } from "node:module";

const external = [
  "electron",
  "sql.js",
  "@huggingface/transformers",
  "onnxruntime-node",
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
];

export default defineConfig({
  build: {
    outDir: "dist-electron",
    emptyOutDir: true,
    ssr: true,
    target: "node22",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "src/main/main.ts"),
        preload: path.resolve(__dirname, "src/preload/preload.ts"),
      },
      external,
      output: {
        format: "cjs",
        entryFileNames: "[name].cjs",
      },
    },
  },
  resolve: {
    alias: {
      "@adaptui/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
      "@adaptui/security": path.resolve(__dirname, "../../packages/security/src/index.ts"),
      "@adaptui/semantic-model": path.resolve(__dirname, "../../packages/semantic-model/src/index.ts"),
      "@adaptui/ui-schema": path.resolve(__dirname, "../../packages/ui-schema/src/index.ts"),
      "@adaptui/browser-core": path.resolve(__dirname, "../../packages/browser-core/src/index.ts"),
      "@adaptui/ai-core": path.resolve(__dirname, "../../packages/ai-core/src/index.ts"),
      "@adaptui/ai-providers": path.resolve(__dirname, "../../packages/ai-providers/src/index.ts"),
      "@adaptui/speech-core": path.resolve(__dirname, "../../packages/speech-core/src/index.ts"),
      "@adaptui/command-agent": path.resolve(__dirname, "../../packages/command-agent/src/index.ts"),
      "@adaptui/personalization": path.resolve(__dirname, "../../packages/personalization/src/index.ts"),
    },
  },
});

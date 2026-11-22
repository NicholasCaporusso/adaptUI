import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  root: path.resolve(__dirname),
  build: {
    outDir: "dist-renderer",
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@adaptui/shared-types": path.resolve(__dirname, "../../packages/shared-types/src/index.ts"),
      "@adaptui/security": path.resolve(__dirname, "../../packages/security/src/index.ts"),
      "@adaptui/semantic-model": path.resolve(__dirname, "../../packages/semantic-model/src/index.ts"),
      "@adaptui/ui-schema": path.resolve(__dirname, "../../packages/ui-schema/src/index.ts"),
      "@adaptui/accessible-ui/styles.css": path.resolve(__dirname, "../../packages/accessible-ui/src/styles.css"),
      "@adaptui/accessible-ui": path.resolve(__dirname, "../../packages/accessible-ui/src/index.tsx"),
    },
  },
});

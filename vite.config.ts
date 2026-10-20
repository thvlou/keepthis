import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, "sidepanel.html"),
        // Design-review page: every panel state on one screen with fixture
        // data. Harmless inside the packaged extension (nothing links to it)
        // and it keeps the preview building against the real components.
        preview: resolve(__dirname, "preview.html"),
        "service-worker": resolve(__dirname, "src/background/service-worker.ts"),
      },
      output: {
        entryFileNames: "[name].js",
      },
    },
  },
});

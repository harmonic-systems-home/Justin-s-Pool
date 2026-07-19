import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds to a single self-contained dist/index.html — no external JS/CSS.
// base "./" keeps asset refs relative so the file works when opened directly
// (file://) and when served from any subdirectory on harmonicsystems.com.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  build: {
    target: "es2020",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});

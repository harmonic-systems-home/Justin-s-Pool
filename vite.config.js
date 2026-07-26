import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { cpSync, existsSync } from "node:fs";

// The app bundle is a single self-contained dist/index.html (no external JS/CSS).
// The survey photos are far too large to inline, so copy photos/ alongside the
// build; the Photos tab loads them at ./photos/<file> (base "./" keeps it
// relative, so it works on Pages, on harmonicsystems.com, and via file://).
const copyPhotos = () => ({
  name: "copy-photos",
  closeBundle() {
    if (existsSync("photos")) cpSync("photos", "dist/photos", { recursive: true });
  },
});

export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile(), copyPhotos()],
  build: {
    target: "es2020",
    assetsInlineLimit: 100000000,
    cssCodeSplit: false,
  },
});

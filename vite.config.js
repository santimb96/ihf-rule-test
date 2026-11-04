import fs from "node:fs";
import { defineConfig } from "vite";

/**
 * The Rules of Game PDF and the two catalogues are linked by relative URL at
 * runtime (footer links and the hint deep links in scripts/data.js), so the
 * build has to ship the folder verbatim instead of fingerprinting it.
 */
function copyAssetsAndDocs() {
  return {
    name: "copy-assets-and-docs",
    closeBundle() {
      if (fs.existsSync("assets")) {
        fs.cpSync("assets", "dist/assets", { recursive: true });
      }
      if (fs.existsSync("documents")) {
        fs.cpSync("documents", "dist/documents", { recursive: true });
      }
    },
  };
}

export default defineConfig({
  plugins: [copyAssetsAndDocs()],
});

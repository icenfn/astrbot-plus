import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import legacy from "@vitejs/plugin-legacy";
import { fileURLToPath, URL } from "node:url";

/**
 * Old-WebView support baseline.
 *
 * The floor we must support is Android WebView 91 (Chromium 91). WebView 91 DOES
 * support native ESM / dynamic import / import.meta / async generators, so
 * @vitejs/plugin-legacy classifies it as a "modern" browser: it is served the
 * *modern* bundle and ignores the `<script nomodule>` legacy bundle entirely.
 *
 * Consequence (this is what v0.4.11 got wrong): the MODERN bundle — not just the
 * legacy one — must be down-levelled *and* polyfilled to the WebView 91 baseline.
 * A modern-only build with `modernPolyfills: false` and `build.target: 'esnext'`
 * hands WebView 91 syntax/runtime it cannot run.
 *
 * Collaboration boundary with PostCSS (see postcss.config.js):
 *   • PostCSS  → lowers the STYLESHEET (vendor prefixes / modern CSS syntax).
 *   • legacy   → lowers the JAVASCRIPT (syntax via babel + runtime via core-js)
 *                and emits the SystemJS bundle for pre-ESM browsers.
 * Both derive from the same dependency floor so the two layers never disagree;
 * they do not overlap, so there is no double-processing conflict.
 */
const LEGACY_TARGETS = ["chrome >= 61", "safari >= 12", "firefox >= 60", "edge >= 79"];
// Chromium 87 is used as the modern floor — slightly below WebView 91 so there
// is head-room for other aged Chromium WebViews.
const MODERN_TARGETS = ["chrome >= 87", "safari >= 13", "firefox >= 78", "edge >= 87"];

// Tauri expects a fixed port and no clearing of the terminal.
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    legacy({
      // Applied to the pre-ESM legacy/SystemJS chunks.
      targets: LEGACY_TARGETS,
      // Applied to the MODERN chunks too — the crucial bit for WebView 91.
      modernTargets: MODERN_TARGETS,
      // Emit a core-js polyfills chunk for the modern bundle (auto-detected from
      // modernTargets + actual usage) so WebView 91 — native ESM, but missing
      // newer runtime APIs like Object.hasOwn / Array.prototype.at — is covered.
      // NOTE: use `modernPolyfills` (array or `true`); those strings are mapped to
      // `core-js/modules/*.js`. `additionalModernPolyfills` entries are added
      // verbatim and must therefore be full module specifiers.
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
    watch: {
      // Tell Vite to ignore watching `src-tauri`.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // esbuild syntax down-levelling matches the modern baseline; the legacy
    // chunks get an even lower target from the plugin above.
    target: MODERN_TARGETS,
    // Keep CSS minification from emitting syntax old WebViews cannot parse.
    cssTarget: "chrome61",
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
});

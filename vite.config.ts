import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import legacy from "@vitejs/plugin-legacy";
import { fileURLToPath, URL } from "node:url";

// Tauri expects a fixed port and no clearing of the terminal.
export default defineConfig({
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
    /**
     * Legacy (old Android WebView) support — JS-runtime layer.
     *
     * This is the *polyfill* half of the old-WebView strategy and is deliberately
     * kept separate from the PostCSS layer in postcss.config.js:
     *   • PostCSS  → down-levels the stylesheet (prefixes / syntax).
     *   • legacy   → emits a SystemJS build + injects `core-js` runtime polyfills
     *                and `regenerator-runtime` so old engines can run the JS.
     *
     * Collaboration boundary / conflict notes:
     *   • `targets` here and `browserslist` in package.json are intentionally the
     *     same dependency list; keep a single source of truth so Babel and
     *     Autoprefixer never disagree about what "old" means.
     *   • `modernPolyfills` is OFF: the modern bundle keeps shipping to modern
     *     WebViews untouched, avoiding double-injected polyfills that would fight
     *     the legacy chunk's own polyfills.
     *   • `renderLegacyChunks` is ON so the legacy build is written even for the
     *     Android (arm64) Tauri target.
     */
    legacy({
      targets: ["chrome >= 64", "android >= 6", "safari >= 12"],
      modernPolyfills: false,
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
    // Keep esbuild from lowering the *legacy* output below what the legacy
    // target already guarantees — plugin-legacy owns that down-levelling.
    target: "esnext",
    // Do not let esbuild minify CSS into syntax old WebViews cannot parse; the
    // PostCSS layer above already produced compatible CSS.
    cssTarget: "chrome61",
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
});

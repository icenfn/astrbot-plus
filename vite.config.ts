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
    // Emit a legacy (nomodule) bundle with core-js polyfills so the app also
    // runs on older Android WebViews / system webviews.
    legacy({
      targets: ["defaults", "chrome >= 61", "android >= 7", "not IE 11"],
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
    // Emit older syntax so the legacy bundle (and native WebView) can parse it.
    target: "es2015",
    minify: "terser",
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
});

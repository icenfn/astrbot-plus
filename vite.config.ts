import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import legacy from "@vitejs/plugin-legacy";
import { browserslistToTargets } from "lightningcss";
import browserslist from "browserslist";
import { legacyCssCompat } from "./scripts/css-legacy-compat.mjs";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf-8"),
) as { version: string };

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
 * Collaboration boundary with LightningCSS (see scripts/css-legacy-compat.mjs):
 *   • LightningCSS → lowers the STYLESHEET (vendor prefixes / modern CSS syntax)
 *                    to `CSS_TARGETS`; the two gaps it leaves (@layer + dynamic
 *                    viewport units) are closed by the local pure-JS plugin.
 *   • legacy   → lowers the JAVASCRIPT (syntax via babel + runtime via core-js)
 *                and emits the SystemJS bundle for pre-ESM browsers.
 * Both derive from the same dependency floor so the two layers never disagree;
 * they do not overlap, so there is no double-processing conflict.
 */
const LEGACY_TARGETS = ["chrome >= 61", "safari >= 12", "firefox >= 60", "edge >= 79"];
// LightningCSS targets for the STYLESHEET, derived from the same browserslist
// floor the JS/legacy layer uses, so CSS and JS never disagree.
const CSS_TARGETS = browserslistToTargets(browserslist());
// Chromium 87 is used as the modern floor — slightly below WebView 91 so there
// is head-room for other aged Chromium WebViews.
const MODERN_TARGETS = ["chrome >= 87", "safari >= 13", "firefox >= 78", "edge >= 87"];

/**
 * Modern runtime polyfills — scoped to the WHOLE dependency surface.
 *
 * Vuetify 4 (and Vue 3 / Pinia / vue-router) touch a broad slice of modern JS
 * runtime APIs that Chromium 91 lacks: `Object.hasOwn`, `Array.prototype.at`,
 * `Array.prototype.flat`, typed-array helpers, structuredClone, queueMicrotask,
 * `String.prototype.replaceAll`, and more. Rather than enabling only the handful
 * the app's *own* source happens to reference (usage-based / on-demand
 * detection), we declare a comprehensive explicit list so every API the
 * framework stack may reach at runtime is polyfilled up-front — i.e. coverage
 * for the whole Vuetify 4 stack, not just our own code.
 *
 * Each entry maps to `core-js/modules/<specifier>.js`.
 */
const MODERN_POLYFILLS = [
  "es.symbol",
  "es.symbol.description",
  "es.symbol.iterator",
  "es.symbol.async-iterator",
  "es.array.from",
  "es.array.of",
  "es.array.includes",
  "es.array.flat",
  "es.array.flat-map",
  "es.array.at",
  "es.array.find",
  "es.array.find-index",
  "es.array.find-last",
  "es.array.find-last-index",
  "es.array.iterator",
  "es.array.sort",
  "es.array.push",
  "es.array.unshift",
  "es.array.splice",
  "es.array.slice",
  "es.string.at-alternative",
  "es.string.replace-all",
  "es.string.trim-start",
  "es.string.trim-end",
  "es.string.iterator",
  "es.string.match-all",
  "es.string.pad-start",
  "es.string.pad-end",
  "es.number.is-integer",
  "es.number.to-fixed",
  "es.number.parse-float",
  "es.number.parse-int",
  "es.number.constructor",
  "es.object.assign",
  "es.object.keys",
  "es.object.values",
  "es.object.entries",
  "es.object.from-entries",
  "es.object.has-own",
  "es.object.get-own-property-descriptor",
  "es.object.get-own-property-descriptors",
  "es.object.get-own-property-symbols",
  "es.object.get-own-property-names",
  "es.object.define-property",
  "es.object.define-properties",
  "es.object.freeze",
  "es.object.is-frozen",
  "es.object.seal",
  "es.object.create",
  "es.object.set-prototype-of",
  "es.object.to-string",
  "es.map",
  "es.set",
  "es.weak-map",
  "es.weak-set",
  "es.promise",
  "es.promise.all-settled",
  "es.promise.any",
  "es.promise.finally",
  "es.promise.all",
  "es.promise.race",
  "es.regexp.constructor",
  "es.regexp.to-string",
  "es.regexp.exec",
  "es.regexp.sticky",
  "es.regexp.flags",
  "es.regexp.dot-all",
  "es.json.stringify",
  "es.json.to-string-tag",
  "es.math.trunc",
  "es.math.sign",
  "es.math.log2",
  "es.math.log10",
  "es.math.hypot",
  "es.math.imul",
  "es.math.clz32",
  "es.function.name",
  "es.function.bind",
  "es.function.has-instance",
  "es.error.cause",
  "es.aggregate-error",
  "es.reflect.to-string-tag",
  "es.typed-array.from",
  "es.typed-array.of",
  "es.typed-array.at",
  "es.typed-array.to-string",
  "es.typed-array.iterator",
  "es.typed-array.includes",
  "es.typed-array.find",
  "es.typed-array.find-index",
  "es.typed-array.sort",
  "es.typed-array.slice",
  "es.typed-array.copy-within",
  "es.typed-array.fill",
  "es.typed-array.for-each",
  "es.typed-array.index-of",
  "es.typed-array.join",
  "es.typed-array.last-index-of",
  "es.typed-array.reduce",
  "es.typed-array.reduce-right",
  "es.typed-array.some",
  "es.typed-array.every",
  "es.typed-array.map",
  "es.typed-array.filter",
  "es.typed-array.subarray",
  "es.typed-array.set",
  "es.typed-array.reverse",
  "es.typed-array.to-locale-string",
  "es.typed-array.to-reversed",
  "es.typed-array.to-sorted",
  "es.typed-array.with",
  "es.array-buffer.constructor",
  "es.array-buffer.slice",
  "es.array-buffer.is-view",
  "es.date.to-string",
  "es.date.to-iso-string",
  "es.date.get-year",
  "es.date.set-year",
  "es.global-this",
  "es.escape",
  "es.unescape",
  "web.dom-collections.iterator",
  "web.dom-collections.for-each",
  "web.dom-exception.constructor",
  "web.dom-exception.stack",
  "web.dom-exception.to-string-tag",
  "web.queue-microtask",
  "web.structured-clone",
  "web.url",
  "web.url.can-parse",
  "web.url-search-params",
  "web.url-search-params.size",
  "web.immediate",
  "web.timers",
  "web.atob",
  "web.btoa",
  "web.self",
  "web.set-interval",
  "web.set-timeout",
  "web.clear-immediate",
  "web.set-immediate",
];

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
      // Complete core-js polyfill set for the modern bundle (see list above), so
      // the WHOLE Vuetify 4 / Vue 3 runtime stack is covered on WebView 91 —
      // not just the APIs our own source references.
      modernPolyfills: MODERN_POLYFILLS,
      renderLegacyChunks: true,
    }),
    // Pure-JS (non-PostCSS) pass that closes the two gaps LightningCSS leaves:
    // `@layer` flattening and dynamic-viewport-unit fallbacks. Runs last, on the
    // emitted CSS assets.
    legacyCssCompat(),
  ],
  define: {
    // Build-time app version for the 关于 page fallback (non-Tauri contexts).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
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
  // CSS pipeline: LightningCSS replaces the former PostCSS setup.
  //   • transformer — lowers modern CSS syntax (nesting, color-mix, oklch,
  //     logical properties, media ranges, …) to the SAME browserslist floor the
  //     JS layer uses.
  //   • targets     — the shared floor, derived from `browserslist`.
  //   • customMedia — LightningCSS draft needed to keep `@custom-media` working.
  // The two things LightningCSS cannot do (@layer flattening + dynamic viewport
  // units) are handled by `legacyCssCompat()` in `plugins`.
  css: {
    transformer: "lightningcss",
    lightningcss: {
      targets: CSS_TARGETS,
      drafts: { customMedia: true },
    },
  },
  build: {
    // esbuild syntax down-levelling matches the modern baseline; the legacy
    // chunks get an even lower target from the plugin above.
    target: MODERN_TARGETS,
    // Minify CSS with LightningCSS too (replaces the default esbuild minifier),
    // which also prevents it from emitting syntax old WebViews cannot parse.
    cssMinify: "lightningcss",
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
});

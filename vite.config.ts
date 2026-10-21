import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import { readFileSync } from "node:fs";
import vue from "@vitejs/plugin-vue";
import vuetify from "vite-plugin-vuetify";
import legacy from "@vitejs/plugin-legacy";

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
 * Collaboration boundary with PostCSS (see postcss.config.js):
 *   • PostCSS  → lowers the STYLESHEET (vendor prefixes / modern CSS syntax).
 *   • legacy   → lowers the JAVASCRIPT (syntax via babel + runtime via core-js)
 *                and emits the SystemJS bundle for pre-ESM browsers.
 * Both derive from the same dependency floor so the two layers never disagree;
 * they do not overlap, so there is no double-processing conflict.
 */
const LEGACY_TARGETS = ["chrome >= 61", "safari >= 12", "firefox >= 60", "edge >= 79"];
// 现代包（modern chunks）的目标**不在这里声明**。
// @vitejs/plugin-legacy 在 renderLegacyChunks 时会强制写入 `build.target`：
//   • 传了 modernTargets → 用它换算；
//   • 没传 → 用它内置的 es2020/edge79/firefox67/chrome64/safari12。
// 内置目标已经低于 WebView 91（≈Chrome 91），覆盖足够；显式再写一份只会触发
// "plugin-legacy 'modernTargets' option overrode the builtin targets" 警告，
// 并把部分中间版本浏览器排除在覆盖之外。

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
      // 传给插件的「legacy 浏览器」清单，由它自己换算成 babel targets。
      // 不要再在外面写 `build.target` —— 插件在 genLegacy 时会**强制覆盖**
      // `build.target`，外面的值只会触发
      //   "plugin-legacy overrode 'build.target'"
      // 这条警告（同时也说明那份配置根本没生效，属于自欺欺人）。
      targets: LEGACY_TARGETS,
      // modernChunks 的目标同样交给插件决定。插件内置 modern 目标是
      //   es2020 / edge79 / firefox67 / chrome64 / safari12
      // 已经比我们的 WebView 91（≈chrome91）底线更低，覆盖足够；一旦显式
      // 传 `modernTargets` 就会触发
      //   "plugin-legacy 'modernTargets' option overrode the builtin targets"
      // 且中间的浏览器版本区间可能有缺口。这里保持默认，由 browserslist
      // （package.json 的 chrome>=90 等）与插件内置目标共同决定。
      // Complete core-js polyfill set for the modern bundle (see list above), so
      // the WHOLE Vuetify 4 / Vue 3 runtime stack is covered on WebView 91 —
      // not just the APIs our own source references.
      modernPolyfills: MODERN_POLYFILLS,
      renderLegacyChunks: true,
    }),
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
  build: {
    // 这里**故意不写 `target`**：`@vitejs/plugin-legacy` 在 renderLegacyChunks
    // 时会把 `build.target` 整个覆盖成它自己算出来的值（modernTargets 或内置
    // es2020/edge79/firefox67/chrome64/safari12）。在外面再写一遍既不会生效，
    // 还会让插件打印 "plugin-legacy overrode 'build.target'"。
    //
    // Keep CSS minification from emitting syntax old WebViews cannot parse.
    cssTarget: "chrome61",
    sourcemap: false,
    chunkSizeWarningLimit: 3000,
  },
});

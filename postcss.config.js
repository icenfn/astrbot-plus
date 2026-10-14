/**
 * PostCSS pipeline — CSS-level down-levelling for old Android WebViews.
 *
 * ── Why this layer is critical (the real WebView-91 blocker) ────────────────
 * Vuetify 4 emits almost all of its component styles inside `@layer vuetify-*`
 * blocks. Chromium below 99 (Android WebView 91 = Chromium 91) does NOT support
 * `@layer`; an unrecognised at-rule is *dropped in full*, so the entire Vuetify
 * component stylesheet would silently disappear on those WebViews. Flattening
 * the cascade layers here is therefore the essential fix — not an optional
 * nicety. `color-mix()` (Chrome 111+) is likewise lowered to static rgb().
 *
 * ── Responsibility boundary (CSS vs JS polyfills) ───────────────────────────
 * PostCSS only rewrites the STYLESHEET. JavaScript runtime polyfills and the
 * SystemJS legacy bundle are produced by @vitejs/plugin-legacy (vite.config.ts).
 * The two layers touch different asset types (CSS vs JS) and never overlap.
 *
 * ── Double-processing guard ─────────────────────────────────────────────────
 * `postcss-preset-env` bundles Autoprefixer, and its own `cascade-layers` /
 * `color-mix-function` features live at stage 2. We run preset-env at stage 3
 * (stage 2 features excluded) so those transforms do NOT run twice, and we
 * disable the bundled Autoprefixer in favour of a single explicit instance.
 * Every plugin reads the SAME `browserslist` from package.json, so the CSS
 * layer and the JS/legacy layer always target a consistent browser floor.
 */
export default {
  plugins: {
    // Flatten `@layer` (Vuetify's cascade layers) for browsers that drop it.
    // Unwraps the layers and preserves order via an old-browser-safe
    // `:not(#\#)` specificity bump (works in Chromium >= 88 / WebView 91).
    "@csstools/postcss-cascade-layers": {},
    // Lower `color-mix()` (Chrome 111+) to static rgb()/rgba() where possible.
    "@csstools/postcss-color-mix-function": {},
    // One explicit Autoprefixer instance, driven by package.json "browserslist".
    autoprefixer: {},
    "postcss-preset-env": {
      // Disable the bundled autoprefixer so it does not run a second time.
      autoprefixer: false,
      // stage 3 keeps only stable transforms; the stage-2 cascade-layers /
      // color-mix features are intentionally left to the explicit plugins above.
      stage: 3,
      features: {
        "nesting-rules": false,
        "custom-properties": false,
        "color-functional-notation": false,
      },
    },
  },
};

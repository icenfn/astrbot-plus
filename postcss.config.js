/**
 * PostCSS pipeline — CSS-level down-levelling for old Android WebViews.
 *
 * ── Scope: the WHOLE Vuetify 4 surface, not a hand-picked subset ────────────
 * Vite runs every stylesheet it resolves — including Vuetify 4's own component
 * CSS from node_modules — through this PostCSS pipeline. The preset below is
 * configured to lower the COMPLETE modern-CSS feature set (stage 2) rather than
 * enabling only a couple of transforms on demand, so nothing in Vuetify 4 is
 * left un-lowered for an aged WebView:
 *   • @layer        (cascade layers, Chrome 99+)  → flattened
 *   • color-mix() / relative colors (Chrome 111+) → static rgb()/rgba()
 *   • nesting       (Chrome 120+)                 → flattened
 *   • logical props, media-query range syntax, :is()/:where(), etc.
 *
 * ── Why this layer is critical ──────────────────────────────────────────────
 * Vuetify 4 emits almost all of its component styles inside `@layer vuetify-*`
 * blocks. Chromium below 99 (Android WebView 91 = Chromium 91) does NOT support
 * `@layer`; an unrecognised at-rule is *dropped in full*, so the entire Vuetify
 * component stylesheet would silently disappear on those WebViews. Flattening
 * the cascade layers here is therefore the essential fix — not an optional
 * nicety.
 *
 * ── Responsibility boundary (CSS vs JS polyfills) ───────────────────────────
 * PostCSS only rewrites the STYLESHEET. JavaScript runtime polyfills and the
 * SystemJS legacy bundle are produced by @vitejs/plugin-legacy (vite.config.ts).
 * The two layers touch different asset types (CSS vs JS) and never overlap.
 *
 * ── Single-instance guard ───────────────────────────────────────────────────
 * We run `postcss-preset-env` alone (stage 2) and let it own cascade-layers,
 * color-mix and Autoprefixer. Running the bundled transforms AND separate
 * `@csstools/*` plugins at the same time would double-process the CSS, so the
 * preset is the single source of truth. It reads the SAME `browserslist` as the
 * JS/legacy layer, keeping the CSS and JS floors consistent.
 */
export default {
  plugins: {
    "postcss-preset-env": {
      // Full stage-2 feature set: every Vuetify 4 style is down-levelled, not
      // just the ones we happened to enable. cascade-layers + color-mix live at
      // stage 2, so they are covered here without any extra plugin.
      stage: 2,
      // One Autoprefixer instance, driven by package.json "browserslist".
      autoprefixer: {},
      features: {
        // Keep Vuetify's runtime CSS custom properties intact — resolving var()
        // to static values would break its runtime theme switching.
        "custom-properties": false,
      },
    },
  },
};

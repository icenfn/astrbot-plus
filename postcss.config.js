/**
 * PostCSS pipeline — CSS-level down-levelling for old Android WebViews.
 *
 * ── Responsibility boundary (polyfills vs PostCSS) ──────────────────────────
 * PostCSS only rewrites the *stylesheet*: it adds vendor prefixes and lowers
 * modern CSS syntax so an old WebView can parse it. It does NOT polyfill the
 * JavaScript runtime — that is `@vitejs/plugin-legacy`'s job (see vite.config.ts),
 * which injects `core-js` + `regenerator-runtime` and serves SystemJS chunks to
 * legacy browsers.
 *
 * ── Conflict / double-processing guard ──────────────────────────────────────
 * `postcss-preset-env` already bundles Autoprefixer. Adding a separate
 * `autoprefixer` plugin here (or anywhere else in this repo) would run the
 * prefixer twice over the same declarations, which both wastes build time and
 * can reorder/duplicate prefixed rules unpredictably. So we disable the bundled
 * Autoprefixer (`autoprefixer: false`) and expose a single `autoprefixer` plugin,
 * each reading the SAME `browserslist` from package.json so the PostCSS layer and
 * the Babel/legacy layer never target inconsistent browser sets.
 */
export default {
  plugins: {
    // One explicit Autoprefixer instance, driven by package.json "browserslist".
    autoprefixer: {},
    "postcss-preset-env": {
      // Disable the bundled autoprefixer so it does not run a second time.
      autoprefixer: false,
      // Only feature-detect transforms that genuinely improve old-WebView
      // support; avoid opinionated rewrites that would churn the v0.4.10 UI.
      stage: 3,
      features: {
        "nesting-rules": false,
        "custom-properties": false,
        "color-functional-notation": false,
      },
    },
  },
};

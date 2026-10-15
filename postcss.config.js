import presetEnv from "postcss-preset-env";

/**
 * PostCSS pipeline — CSS-level down-levelling for old Android WebViews.
 *
 * Scope: the WHOLE Vuetify 4 stylesheet surface (Vuetify 4.2.x), not a hand-
 * picked subset. Vite runs every stylesheet it resolves — including Vuetify 4's
 * own component CSS from node_modules — through this pipeline.
 *
 * ── What Vuetify 4.2.x actually uses (measured in node_modules) ─────────────
 *   @layer ............ 36 occurrences   (Chrome 99+)   -> MUST be flattened
 *   color-mix() ....... 148              (Chrome 111+)  -> lowered where static
 *   :where()/:is() .... supported ≥ Chrome 88          -> already safe on 91
 *   oklch() ........... 1                (Chrome 111+)  -> converted to rgb()
 *   dvh ............... 13               (Chrome 108+)  -> needs a vh fallback
 *   :has() ............ ~45              (Chrome 105+)  -> no static lowering
 *   @property ......... 6                (Chrome 85+)   -> safe / ignorable
 *
 * ── Plugin 1: postcss-preset-env (SINGLE source of modern-CSS lowering) ─────
 * stage: 2 enables the COMPLETE stage-2 feature set (not a hand-picked subset),
 * which is what covers Vuetify 4. It owns cascade-layers (@layer flattening),
 * color-mix-function, nesting-rules, logical-properties, media-query-ranges,
 * relative-color-syntax, and Autoprefixer. Running the bundled transforms AND
 * separate @csstools/* plugins at the same time would double-process the CSS,
 * so the preset is the SINGLE source of truth (conflict-avoidance boundary). It
 * reads the same `browserslist` as the JS/legacy layer.
 *
 * `enableClientSidePolyfills` is intentionally left OFF: per its README it "does
 * not cause the browsers libraries to be included in your bundle" — enabling it
 * would emit `.js-*` fallback selectors whose polyfill JS is not shipped, i.e.
 * dead CSS, and would add a new JS dependency (exactly the kind of conflict the
 * user asked us to avoid). The dynamic-viewport gap is closed below instead.
 *
 * ── Plugin 2: local viewport-unit fallback (COMPLEMENTARY, no overlap) ──────
 * postcss-preset-env has NO feature for viewport units, so `100dvh` (used by
 * Vuetify's `v-application` wrapper and the `h-screen`-style utilities) is left
 * untouched — and Chromium 91 cannot parse `dvh`, so it drops the whole
 * declaration. This tiny plugin inserts a `vh`/`vw` fallback immediately BEFORE
 * any dynamic viewport unit, so old WebViews use the fallback while modern ones
 * keep the dynamic value (source order wins). It only clones declarations and
 * never touches @layer/color-mix/nesting, so it cannot conflict with the preset.
 */
function viewportUnitFallback() {
  const DYNAMIC = { dvh: "vh", svh: "vh", lvh: "vh", dvw: "vw", svw: "vw", lvw: "vw" };
  // Match a numeric dimension immediately followed by a dynamic viewport unit.
  // A plain word boundary (`\b`) before the unit does NOT work for the usual
  // `100dvh` form — there is no boundary between `0` and `d` — so the unit is
  // anchored to a required number prefix instead (this also covers `calc(...)`,
  // `min(...)`, and `0.5svh`). The trailing `\b` still applies so identifiers
  // such as `dvhx` are ignored.
  const re = /(\d+(?:\.\d+)?)(dvh|svh|lvh|dvw|svw|lvw)\b/gi;

  return {
    postcssPlugin: "viewport-unit-fallback",
    Declaration(decl) {
      if (!decl.value) return;
      re.lastIndex = 0;
      if (!re.test(decl.value)) return;
      const fallback = decl.value.replace(
        re,
        (_, num, unit) => num + (DYNAMIC[unit.toLowerCase()] ?? unit),
      );
      if (fallback === decl.value) return;
      // Insert the fallback BEFORE the original so the original wins where
      // supported, and old engines (which dropped the original) keep the clone.
      decl.cloneBefore({ value: fallback });
    },
  };
}
viewportUnitFallback.postcss = true;

export default {
  // Array form of PRE-INSTANTIATED plugins. Vite's array branch does not accept
  // a `[name, options]` tuple (it only filters the list), so each plugin is
  // imported and instantiated here instead.
  plugins: [
    presetEnv({
      // Complete stage-2 feature set — the whole modern-CSS surface Vuetify 4
      // relies on, not just a couple of transforms enabled on demand.
      stage: 2,
      // One Autoprefixer instance, driven by package.json "browserslist".
      autoprefixer: {},
      features: {
        // Keep Vuetify's runtime CSS custom properties intact — resolving var()
        // to static values would break its runtime theme switching.
        "custom-properties": false,
      },
    }),
    viewportUnitFallback(),
  ],
};

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

/**
 * Plugin 3: color-mix() fallback for old WebViews (COMPLEMENTARY to the preset).
 *
 * postcss-preset-env can only lower `color-mix()` when every colour argument is
 * statically resolvable. Vuetify mixes a *runtime* custom property with
 * `transparent`:
 *   color-mix(in srgb, var(--v-elevation-overlay-color) 8%, transparent)
 * The value depends on the active theme, so the preset leaves it untouched — and
 * Chromium 91 (needs Chrome 111+) drops the whole declaration. Because the overlay
 * colour resolves to an RGB triplet at runtime (`elevation-overlay-color` is a
 * `#rrggbb` value in src/plugins/vuetify.ts, so Vuetify serialises it to `r, g, b`),
 * the mix is arithmetically just `rgba(<triplet>, 0.08)`.
 *
 * Handled shapes — the themable color-mix surface of Vuetify 4.2 (i.e. the mixes
 * whose only unknown is a runtime custom property and whose other operand is
 * `transparent`):
 *   color-mix(in srgb, var(--c) N%, transparent)
 *       -> rgba(var(--c), N/100)
 *   color-mix(in srgb, rgb(var(--c)) calc(var(--o) * 100%), transparent)
 *       -> rgba(var(--c), var(--o))
 *   color-mix(in srgb, rgb(var(--c)) N%, transparent)
 *       -> rgba(var(--c), N/100)
 * Anything the plugin cannot rewrite is left alone (never silently dropped): the
 * few remaining mixes combine a runtime triplet with an *opaque* literal
 * (e.g. `rgb(var(--v-theme-surface-variant)) 20%, #888`), which has no exact
 * static lowering without knowing the active theme — those keep Vuetify's base
 * track/thumb declarations on engines that drop the declaration.
 */
function colorMixFallback() {
  const OPACITY =
    /color-mix\(\s*in\s+srgb\s*,\s*rgb\(var\((--[\w-]+)\)\)\s+calc\(var\((--[\w-]+)\)\s*\*\s*100%\)\s*,\s*transparent\s*\)/gi;
  const RGB_TRANSPARENT =
    /color-mix\(\s*in\s+srgb\s*,\s*rgb\(var\((--[\w-]+)\)\)\s+([\d.]+)%\s*,\s*transparent\s*\)/gi;
  const OVERLAY =
    /color-mix\(\s*in\s+srgb\s*,\s*var\((--[\w-]+)\)\s+([\d.]+)%\s*,\s*transparent\s*\)/gi;
  return {
    postcssPlugin: "color-mix-fallback",
    Declaration(decl) {
      if (!decl.value || decl.value.indexOf("color-mix") === -1) return;
      let value = decl.value;
      value = value.replace(
        OPACITY,
        (_m, color, opacity) => `rgba(var(${color}), var(${opacity}))`,
      );
      value = value.replace(
        RGB_TRANSPARENT,
        (_m, color, pct) => `rgba(var(${color}), ${Number(pct) / 100})`,
      );
      value = value.replace(
        OVERLAY,
        (_m, color, pct) => `rgba(var(${color}), ${Number(pct) / 100})`,
      );
      if (value !== decl.value) decl.value = value;
    },
  };
}
colorMixFallback.postcss = true;

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
    colorMixFallback(),
  ],
};

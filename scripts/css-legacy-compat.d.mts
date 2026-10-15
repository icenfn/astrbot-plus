/**
 * Types for `css-legacy-compat.mjs` — the pure-JS CSS compatibility pass that
 * replaces the former PostCSS pipeline (see the .mjs for the full rationale).
 */

/** Flatten `@layer` across a set of final CSS assets, preserving cascade order. */
export declare function flattenCascadeLayers(sheets: string[]): string[];

/** Insert `vh`/`vw` fallbacks before any dynamic-viewport-unit declaration. */
export declare function addViewportUnitFallbacks(css: string): string;

/** Full compat pass over one or more stylesheets (flatten + viewport fallback). */
export declare function transformLegacyCss(sheets: string | string[]): string[];

/** Vite plugin that applies the compat pass to emitted `.css` assets. */
export declare function legacyCssCompat(): {
  name: string;
  apply: "build";
  enforce: "post";
  generateBundle(
    options: unknown,
    bundle: Record<string, unknown>,
  ): void;
};

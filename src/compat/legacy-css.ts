/**
 * Legacy WebView CSS compatibility shim.
 *
 * Target: Android WebView 91 (Chromium 91). Chromium 91 predates CSS Cascade
 * Layers (`@layer`, Chrome 99+). Vuetify 4 injects its *runtime* theme stylesheet
 * (`#vuetify-theme-stylesheet`) wrapped entirely in
 *   @layer vuetify-utilities {
 *     @layer theme-base {…}
 *     @layer theme-background {…}
 *     @layer theme-foreground {…}
 *   }
 * An engine that cannot parse `@layer` discards the whole at-rule — and with it
 * every `--v-theme-*`, `--v-shadow-color`, `--v-elevation-overlay-color` and
 * `--v-*-opacity` custom property. That produces exactly the reported symptoms:
 * buttons falling back to a black fill, cards losing their elevation/shadow and
 * the palette never applying.
 *
 * The *static* Vuetify stylesheet is already de-layered at build time by
 * postcss-preset-env's cascade-layers transform, but Vuetify builds this runtime
 * sheet in JavaScript, so it never passes through PostCSS. This shim closes that
 * gap: on engines without `@layer` it flattens the runtime sheet in place,
 * inlining each `@layer … { … }` block's contents at its original position so the
 * declared order (theme-base → theme-background → theme-foreground) is kept.
 *
 * On engines that support `@layer` the shim is a no-op, so modern browsers keep
 * Vuetify's native cascade behaviour untouched.
 */

/** True when the engine can parse CSS Cascade Layers. */
function supportsCascadeLayers(): boolean {
  return (
    typeof (globalThis as { CSSLayerBlockRule?: unknown }).CSSLayerBlockRule !==
    "undefined"
  );
}

/**
 * Remove every `@layer` construct from a stylesheet, inlining block contents in
 * place and dropping bare `@layer a, b;` statements. Brace-aware, so nested layers
 * and nested rules survive intact.
 */
export function stripCascadeLayers(css: string): string {
  let out = "";
  let i = 0;
  const n = css.length;
  while (i < n) {
    const at = css.indexOf("@layer", i);
    if (at === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, at);
    // Scan past the layer name list up to the first `{` or `;`.
    let k = at + "@layer".length;
    while (k < n && css[k] !== "{" && css[k] !== ";") k++;
    if (k >= n) {
      // Malformed trailing `@layer` with no body — keep as-is and stop.
      out += css.slice(at);
      break;
    }
    if (css[k] === ";") {
      // `@layer a, b;` statement — drop it (layer order is irrelevant once
      // layers no longer exist).
      i = k + 1;
      continue;
    }
    // Block form — find the matching close brace and inline the stripped body.
    let depth = 0;
    let m = k;
    for (; m < n; m++) {
      const c = css[m];
      if (c === "{") depth++;
      else if (c === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = css.slice(k + 1, m < n ? m : n);
    out += stripCascadeLayers(inner);
    i = m < n ? m + 1 : n;
  }
  return out;
}

const STYLESHEET_ID = "vuetify-theme-stylesheet";

/** Flatten one `<style>` element in place if it still contains layers. */
function flattenStyleElement(el: HTMLStyleElement): void {
  const css = el.textContent;
  if (!css || css.indexOf("@layer") === -1) return;
  const flattened = stripCascadeLayers(css);
  if (flattened && flattened !== css) el.textContent = flattened;
}

/** Walk up from a node to the enclosing `<style>` element, if any. */
function enclosingStyle(node: Node | null): HTMLStyleElement | null {
  for (let cur = node; cur; cur = cur.parentNode) {
    if (cur.nodeType === 1 && (cur as Element).tagName === "STYLE") {
      return cur as HTMLStyleElement;
    }
  }
  return null;
}

/**
 * Install the runtime de-layering shim. Idempotent, and a no-op on engines with
 * native `@layer` support.
 */
export function installLegacyCssCompat(): void {
  if (typeof document === "undefined") return;
  if (supportsCascadeLayers()) return;

  const processTree = (root: ParentNode): void => {
    root
      .querySelectorAll("style")
      .forEach((node) => flattenStyleElement(node as HTMLStyleElement));
    const known = document.getElementById(STYLESHEET_ID);
    if (known) flattenStyleElement(known as HTMLStyleElement);
  };

  const start = (): void => {
    processTree(document);
    const head = document.head;
    if (!head || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        // Vuetify rewrites the theme sheet by assigning `styleSheet.innerHTML`,
        // which REPLACES the <style>'s text child node. That surfaces as a
        // `childList` mutation whose added node is a TEXT node (nodeType 3) —
        // the old code only inspected element nodes and therefore missed it,
        // so after a live theme switch the freshly injected `@layer` sheet was
        // never flattened and got dropped (components fell back to black).
        // Resolve the enclosing <style> from both the target and every added
        // node instead of assuming an element child.
        if (mutation.type === "characterData") {
          const style = enclosingStyle(mutation.target);
          if (style) flattenStyleElement(style);
          continue;
        }
        if (mutation.type === "childList") {
          const targetStyle = enclosingStyle(mutation.target);
          if (targetStyle) flattenStyleElement(targetStyle);
          mutation.addedNodes.forEach((node) => {
            const style = enclosingStyle(node);
            if (style) flattenStyleElement(style);
            else if (node.nodeType === 1) processTree(node as Element);
          });
        }
      }
    });
    // Watch <head> — that is where Vuetify creates/replaces the theme <style>,
    // setting `innerHTML` on every theme change.
    observer.observe(head, { childList: true, subtree: true, characterData: true });
  };

  if (document.head) start();
  else document.addEventListener("DOMContentLoaded", start, { once: true });
}

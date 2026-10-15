/**
 * css-legacy-compat — pure-JS, non-PostCSS CSS compatibility pass.
 *
 * Replaces the previous PostCSS pipeline (`postcss.config.js` +
 * `postcss-preset-env` + `postcss-cascade-layers` + a local viewport-unit
 * plugin) with two transforms that LightningCSS itself does NOT implement:
 *
 *   1. @layer flattening  — LightningCSS 1.33 has no `CascadeLayers` feature
 *      and never lowers `@layer` at any `targets` value (empirically verified:
 *      `@layer` survives every chrome-version target), yet Vuetify 4.2.x wraps
 *      essentially all of its stylesheet (129/129 of its CSS files, 36 layer
 *      blocks in `main.css` alone) in cascade layers. Chromium < 99 (our
 *      WebView floor) does not understand `@layer` and DROPS the entire block,
 *      so the layers must be flattened away.
 *
 *      Flattening re-encodes cascade-layer priority as SPECIFICITY using the
 *      established `:not(#\#)` technique (the same one used by
 *      `@csstools/postcss-cascade-layers`): every selector inside a layer gets
 *      `order * step` copies of `:not(#\#)` appended, where `step` is one more
 *      than the highest id-count of any selector in the sheet and `order` is
 *      the layer's position in cascade order. Unlayered rules — i.e. our own
 *      app styles — get the highest band so they keep winning over Vuetify,
 *      exactly as in a layer-aware browser.
 *
 *   2. viewport-unit fallback — LightningCSS never rewrites dynamic viewport
 *      units (`dvh`/`svh`/`lvh`/…), and Chromium < 108 cannot parse them. We
 *      prepend a `vh`/`vw` clone before any declaration that uses one, so old
 *      engines fall back while modern engines keep the dynamic value
 *      (source order wins).
 *
 * Everything else modern-CSS (color-mix, nesting, oklch, logical properties,
 * media-query ranges, vendor prefixes) is handled by LightningCSS itself via
 * `css.transformer: 'lightningcss'` + `build.cssMinify: 'lightningcss'`.
 *
 * The whole pass is a plain string transform that runs on the FINAL emitted
 * `.css` assets (after LightningCSS minify), so the output is the exact bytes
 * shipped to the device. Layer order + the `step` constant are computed GLOBALLY
 * across every CSS asset first (a layer may be declared in one chunk and used in
 * another), then each asset is rewritten with those shared values.
 *
 * It is intentionally AST-lite: it only needs block/string/comment awareness,
 * never semantic CSS knowledge, and preserves declarations verbatim.
 */

// At-rules whose body is a list of rules (not declarations) and therefore must
// be recursed into when flattening layers / measuring specificity.
const RULE_BODY_ATRULES = new Set([
  'media',
  'supports',
  'layer',
  'container',
  'document',
  '-moz-document',
  'scope',
  'starting-style',
]);

// Dynamic viewport units -> their static fallback unit.
const VIEWPORT_FALLBACK = {
  dvh: 'vh',
  svh: 'vh',
  lvh: 'vh',
  dvw: 'vw',
  svw: 'vw',
  lvw: 'vw',
};
const DYNAMIC_UNIT_RE = /(dvh|svh|lvh|dvw|svw|lvw)/gi;
const DECL_WITH_DYNAMIC_UNIT_RE =
  /(?<=[{;])([a-zA-Z-]+):([^;{}]*?(?:dvh|svh|lvh|dvw|svw|lvw)[^;{}]*)(?=[;}])/g;

// An id selector token in a (string-stripped) selector: `#` followed by an
// identifier start char or an escape. Used only to size the specificity band.
const ID_TOKEN_RE = /#(?:\\[^\n]|[-_a-zA-Z0-9\u00a0-\uffff])/g;

/**
 * Parse a CSS source string into a shallow list of top-level nodes.
 *   { type: 'rule',   prelude, body }
 *   { type: 'atrule', name, prelude, body }   // body === null for `@x ...;`
 *   { type: 'raw',    text }
 * The scanner is aware of strings, comments and parentheses.
 */
function parseNodes(src) {
  const nodes = [];
  const L = src.length;
  let i = 0;

  while (i < L) {
    const start = i;
    let j = i;
    let paren = 0;
    let inStr = false;
    let quote = '';

    for (; j < L; j++) {
      const c = src[j];
      if (inStr) {
        if (c === '\\') {
          j++;
          continue;
        }
        if (c === quote) inStr = false;
        continue;
      }
      if (c === '/' && src[j + 1] === '*') {
        const end = src.indexOf('*/', j + 2);
        j = end < 0 ? L : end + 1;
        continue;
      }
      if (c === '"' || c === "'") {
        inStr = true;
        quote = c;
        continue;
      }
      if (c === '(') {
        paren++;
        continue;
      }
      if (c === ')') {
        if (paren > 0) paren--;
        continue;
      }
      if (paren > 0) continue;
      if (c === '{' || c === ';' || c === '}') break;
    }

    if (j >= L) {
      const text = src.slice(start).trim();
      if (text) nodes.push({ type: 'raw', text });
      break;
    }

    const c = src[j];

    if (c === ';') {
      const prelude = src.slice(start, j).trim();
      if (prelude) {
        if (prelude[0] === '@') {
          const name = prelude.split(/[\s(;]/)[0].slice(1).toLowerCase();
          nodes.push({ type: 'atrule', name, prelude, body: null });
        } else {
          nodes.push({ type: 'raw', text: prelude + ';' });
        }
      }
      i = j + 1;
      continue;
    }

    if (c === '}') {
      i = j + 1; // unbalanced at this level; skip
      continue;
    }

    // c === '{' : find the matching closing brace.
    const prelude = src.slice(start, j).trim();
    const bodyStart = j + 1;
    let k = bodyStart;
    let depth = 1;
    let inStr2 = false;
    let q2 = '';

    for (; k < L; k++) {
      const c2 = src[k];
      if (inStr2) {
        if (c2 === '\\') {
          k++;
          continue;
        }
        if (c2 === q2) inStr2 = false;
        continue;
      }
      if (c2 === '/' && src[k + 1] === '*') {
        const end = src.indexOf('*/', k + 2);
        k = end < 0 ? L : end + 1;
        continue;
      }
      if (c2 === '"' || c2 === "'") {
        inStr2 = true;
        q2 = c2;
        continue;
      }
      if (c2 === '{') depth++;
      else if (c2 === '}') {
        depth--;
        if (depth === 0) break;
      }
    }

    const body = src.slice(bodyStart, k);

    if (prelude[0] === '@') {
      const name = prelude.split(/[\s(]/)[0].slice(1).toLowerCase();
      nodes.push({ type: 'atrule', name, prelude, body });
    } else {
      nodes.push({ type: 'rule', prelude, body });
    }

    i = k + 1;
  }

  return nodes;
}

/** First-seen DFS order of every cascade-layer path (cascade order). */
function collectLayerOrder(nodes, parentPath, order) {
  for (const nd of nodes) {
    if (nd.type !== 'atrule') continue;

    if (nd.name !== 'layer') {
      if (nd.body != null && RULE_BODY_ATRULES.has(nd.name)) {
        collectLayerOrder(parseNodes(nd.body), parentPath, order);
      }
      continue;
    }

    if (nd.body == null) {
      // `@layer a, b;` / `@layer a.b;` — a pure order/name declaration.
      const names = nd.prelude
        .replace(/^@layer\s*/i, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const nm of names) {
        const p = parentPath ? `${parentPath}.${nm}` : nm;
        if (!order.has(p)) order.set(p, order.size);
      }
    } else {
      const nm = nd.prelude.replace(/^@layer\s*/i, '').trim();
      const p = parentPath ? `${parentPath}.${nm}` : nm;
      if (p && !order.has(p)) order.set(p, order.size);
      collectLayerOrder(parseNodes(nd.body), p, order);
    }
  }
}

function stripStrings(selector) {
  return selector.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

/** Highest id-count seen in any selector, used to size the specificity band. */
function measureMaxIdCount(nodes) {
  let max = 0;
  for (const nd of nodes) {
    if (nd.type === 'rule') {
      const ids = (stripStrings(nd.prelude).match(ID_TOKEN_RE) || []).length;
      if (ids > max) max = ids;
    } else if (nd.type === 'atrule' && nd.body != null && RULE_BODY_ATRULES.has(nd.name)) {
      const inner = measureMaxIdCount(parseNodes(nd.body));
      if (inner > max) max = inner;
    }
  }
  return max;
}

/** Split a selector list on TOP-LEVEL commas only. */
function splitSelectors(selector) {
  const parts = [];
  let depth = 0;
  let inStr = false;
  let quote = '';
  let start = 0;

  for (let i = 0; i < selector.length; i++) {
    const c = selector[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
    else if (c === ',' && depth === 0) {
      parts.push(selector.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(selector.slice(start));
  return parts;
}

/**
 * Append `count` copies of `:not(#\#)` to each selector, inserting BEFORE any
 * top-level pseudo-ELEMENT (`::before`, …) so the selector stays valid.
 */
function bumpSelector(selector, count) {
  if (count <= 0) return selector;
  const bump = ':not(#\\#)'.repeat(count);
  return splitSelectors(selector)
    .map((raw) => {
      const sel = raw.trim();
      if (!sel) return raw;
      const pseudoEl = sel.indexOf('::');
      if (pseudoEl >= 0) return sel.slice(0, pseudoEl) + bump + sel.slice(pseudoEl);
      return sel + bump;
    })
    .join(',');
}

/** Re-emit the rule tree with layers flattened and specificity bumped. */
function emit(nodes, layerPath, order, step, unlayeredBump) {
  let out = '';

  for (const nd of nodes) {
    if (nd.type === 'raw') {
      out += nd.text;
      continue;
    }

    if (nd.type === 'rule') {
      const bump =
        layerPath === '' ? unlayeredBump : (order.get(layerPath) ?? 0) * step;
      out += `${bumpSelector(nd.prelude, bump)}{${nd.body}}`;
      continue;
    }

    // at-rule
    if (nd.name === 'layer') {
      if (nd.body == null) continue; // drop the pure order statement
      const nm = nd.prelude.replace(/^@layer\s*/i, '').trim();
      const p = layerPath && nm ? `${layerPath}.${nm}` : nm || layerPath;
      out += emit(parseNodes(nd.body), p, order, step, unlayeredBump);
      continue;
    }

    if (nd.body != null && RULE_BODY_ATRULES.has(nd.name)) {
      out += `${nd.prelude}{${emit(parseNodes(nd.body), layerPath, order, step, unlayeredBump)}}`;
      continue;
    }

    // Declaration-only at-rule (@font-face, @keyframes, @page, @property, …).
    out += nd.body == null ? `${nd.prelude};` : `${nd.prelude}{${nd.body}}`;
  }

  return out;
}

/**
 * Flatten `@layer` across a SET of stylesheets.
 * @param {string[]} sheets  final CSS assets (all emitted .css files)
 * @returns {string[]}       the same sheets with layers flattened
 */
export function flattenCascadeLayers(sheets) {
  const order = new Map();
  let maxIds = 0;

  for (const css of sheets) {
    if (!css.includes('@layer')) continue;
    collectLayerOrder(parseNodes(css), '', order);
    const m = measureMaxIdCount(parseNodes(css));
    if (m > maxIds) maxIds = m;
  }

  if (order.size === 0) return sheets;

  const step = maxIds + 1;
  const unlayeredBump = order.size * step;

  return sheets.map((css) =>
    css.includes('@layer')
      ? emit(parseNodes(css), '', order, step, unlayeredBump)
      : css,
  );
}

/** Insert static viewport-unit fallbacks before dynamic ones. */
export function addViewportUnitFallbacks(css) {
  DYNAMIC_UNIT_RE.lastIndex = 0;
  if (!DYNAMIC_UNIT_RE.test(css)) {
    DYNAMIC_UNIT_RE.lastIndex = 0;
    return css;
  }
  DYNAMIC_UNIT_RE.lastIndex = 0;

  return css.replace(DECL_WITH_DYNAMIC_UNIT_RE, (match, prop, value) => {
    const fallback = value.replace(
      DYNAMIC_UNIT_RE,
      (unit) => VIEWPORT_FALLBACK[unit.toLowerCase()] ?? unit,
    );
    return fallback === value ? match : `${prop}:${fallback};${prop}:${value}`;
  });
}

/** Full compat pass over a set of stylesheets. */
export function transformLegacyCss(sheets) {
  const list = Array.isArray(sheets) ? sheets : [sheets];
  return flattenCascadeLayers(list).map(addViewportUnitFallbacks);
}

/** Vite plugin wrapping the transforms over emitted CSS assets. */
export function legacyCssCompat() {
  return {
    name: 'astrbot-legacy-css-compat',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const assets = Object.values(bundle).filter(
        (c) => c.type === 'asset' && c.fileName.endsWith('.css'),
      );
      if (assets.length === 0) return;

      const sources = assets.map((a) =>
        typeof a.source === 'string' ? a.source : Buffer.from(a.source).toString('utf8'),
      );
      const result = transformLegacyCss(sources);

      assets.forEach((a, idx) => {
        a.source = result[idx];
      });
    },
  };
}

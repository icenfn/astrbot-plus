/**
 * Markdown rendering for chat bubbles.
 *
 * Powered by `marked` (v18) together with three official plugins:
 *   - marked-katex-extension : LaTeX math ($...$ / $$...$$) via KaTeX
 *   - marked-abc             : ABC music notation blocks
 *   - marked-highlight       : syntax highlighting via highlight.js
 *
 * The previous hand-rolled renderer has been replaced by this pipeline so the
 * bubbles support the full CommonMark + GFM surface the model can produce.
 */

import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import markedAbc from "marked-abc";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";

// Styles required by the KaTeX and highlight.js output.
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

/** Escape HTML – used only for the (rare) rendering fallback. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const marked = new Marked({
  gfm: true,
  breaks: true,
});

// --- Plugins (registered defensively so one failure never breaks the others) --
try {
  marked.use(
    markedHighlight({
      emptyLangClass: "hljs",
      langPrefix: "hljs language-",
      highlight(code: string, lang: string): string {
        const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
        try {
          return hljs.highlight(code, { language }).value;
        } catch {
          return code;
        }
      },
    }),
  );
} catch (e) {
  console.warn("marked-highlight init failed", e);
}

try {
  marked.use(markedKatex({ throwOnError: false, nonStandard: true }));
} catch (e) {
  console.warn("marked-katex-extension init failed", e);
}

try {
  marked.use(markedAbc({}));
} catch (e) {
  console.warn("marked-abc init failed", e);
}

/** Render Markdown source to a safe-to-inject HTML string. */
export function renderMarkdown(source: string): string {
  if (!source) return "";
  try {
    return marked.parse(source, { async: false }) as string;
  } catch (e) {
    console.warn("markdown render failed", e);
    return `<p>${escapeHtml(source)}</p>`;
  }
}

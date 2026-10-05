/**
 * Minimal, dependency-free and XSS-safe Markdown renderer.
 *
 * The chat bubbles previously rendered raw text only. This lightweight renderer
 * supports the subset that AstrBot replies typically use:
 *   - fenced code blocks (``` / ~~~) with optional language class
 *   - ATX headings (# .. ######)
 *   - blockquotes (>)
 *   - unordered (-, *, +) and ordered (1.) lists
 *   - thematic breaks (---, ***, ___)
 *   - inline code, bold, italic, strikethrough
 *   - links and images, plus bare-URL autolinking
 *
 * All input is HTML-escaped first, so the produced HTML is safe to inject with
 * `v-html`. Dangerous URL schemes (javascript:, data:, ...) are stripped.
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Allow only safe URL schemes / relative URLs. */
function sanitizeUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  // Relative URLs (path, fragment, query) are safe.
  if (/^(\/|#|\.|\?)/.test(trimmed)) return trimmed;
  return "";
}

const CODE_PLACEHOLDER = "\u0000MDCODE";

function renderInline(text: string): string {
  // Escape first; every later transformation operates on already-safe text.
  let s = escapeHtml(text);

  // Protect inline code spans so their contents are not further transformed.
  const codes: string[] = [];
  s = s.replace(/`([^`]+)`/g, (_m, code) => {
    codes.push(code);
    return `${CODE_PLACEHOLDER}${codes.length - 1}\u0000`;
  });

  // Images: ![alt](url)
  s = s.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_m, alt: string, url: string) => {
      const safe = sanitizeUrl(url);
      return safe ? `<img src="${safe}" alt="${alt}" class="md-img" />` : alt;
    },
  );

  // Links: [text](url)
  s = s.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,
    (_m, label: string, url: string) => {
      const safe = sanitizeUrl(url);
      if (!safe) return label;
      const external = /^https?:/i.test(safe);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${safe}"${attrs}>${label}</a>`;
    },
  );

  // Bare autolinks (avoid ones already inside href/attr by requiring a lead).
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_m, lead: string, url: string) => {
    return `${lead}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });

  // Emphases.
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  s = s.replace(/(^|[^_\w])_([^_\n]+)_/g, "$1<em>$2</em>");
  s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Restore inline code.
  s = s.replace(new RegExp(`${CODE_PLACEHOLDER}(\\d+)\\u0000`, "g"), (_m, idx: string) => {
    return `<code>${codes[Number(idx)]}</code>`;
  });

  return s;
}

const HR_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const UL_RE = /^\s*[-*+]\s+/;
const OL_RE = /^\s*\d+[.)]\s+/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^\s*(```|~~~)(.*)$/;
const QUOTE_RE = /^\s*>\s?/;

function isBlockStart(line: string): boolean {
  return (
    /^\s*$/.test(line) ||
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    QUOTE_RE.test(line) ||
    UL_RE.test(line) ||
    OL_RE.test(line) ||
    HR_RE.test(line)
  );
}

export function renderMarkdown(source: string): string {
  if (!source) return "";
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const n = lines.length;
  let html = "";
  let i = 0;

  while (i < n) {
    const line = lines[i];

    // Fenced code block.
    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2].trim();
      const buffer: string[] = [];
      i++;
      while (i < n && !lines[i].trimStart().startsWith(marker)) {
        buffer.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      const langAttr = lang ? ` data-lang="${escapeHtml(lang)}"` : "";
      html += `<pre class="md-pre"><code${langAttr}>${escapeHtml(buffer.join("\n"))}</code></pre>`;
      continue;
    }

    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      html += "<hr />";
      i++;
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      const level = heading[1].length;
      html += `<h${level}>${renderInline(heading[2].trim())}</h${level}>`;
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const buffer: string[] = [];
      while (i < n && QUOTE_RE.test(lines[i])) {
        buffer.push(lines[i].replace(QUOTE_RE, ""));
        i++;
      }
      html += `<blockquote>${renderMarkdown(buffer.join("\n"))}</blockquote>`;
      continue;
    }

    if (UL_RE.test(line)) {
      const items: string[] = [];
      while (i < n && UL_RE.test(lines[i])) {
        items.push(lines[i].replace(UL_RE, ""));
        i++;
      }
      html += `<ul>${items.map((t) => `<li>${renderInline(t)}</li>`).join("")}</ul>`;
      continue;
    }

    if (OL_RE.test(line)) {
      const startMatch = line.match(/^\s*(\d+)/);
      const start = startMatch ? Number(startMatch[1]) : 1;
      const items: string[] = [];
      while (i < n && OL_RE.test(lines[i])) {
        items.push(lines[i].replace(OL_RE, ""));
        i++;
      }
      const startAttr = start !== 1 ? ` start="${start}"` : "";
      html += `<ol${startAttr}>${items.map((t) => `<li>${renderInline(t)}</li>`).join("")}</ol>`;
      continue;
    }

    // Paragraph: merge consecutive plain lines, keep hard breaks.
    const buffer: string[] = [line];
    i++;
    while (i < n && !isBlockStart(lines[i])) {
      buffer.push(lines[i]);
      i++;
    }
    html += `<p>${buffer.map(renderInline).join("<br />")}</p>`;
  }

  return html;
}

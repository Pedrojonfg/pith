/**
 * Heading detection for Slow Mode scope picker.
 * Offsets are in normalizedTextFull coordinates.
 */

const MARKDOWN_HEADING = /^(#{1,3})\s+(.+)$/gm;

function slugify(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function headingKind(level, format) {
  if (format === "markdown") {
    if (level === 1) return "chapter";
    return "section";
  }
  if (level <= 2) return "chapter";
  return "section";
}

function parseMarkdownHeadings(normalizedText) {
  const text = String(normalizedText || "");
  const matches = [];
  let m;
  MARKDOWN_HEADING.lastIndex = 0;
  while ((m = MARKDOWN_HEADING.exec(text)) !== null) {
    const level = m[1].length;
    const label = String(m[2] || "").trim();
    if (!label) continue;
    matches.push({
      kind: headingKind(level, "markdown"),
      charStart: m.index,
      charEnd: m.index + m[0].length,
      label,
      level,
    });
  }
  return matches;
}

function parseHtmlMinHeadings(normalizedText) {
  const text = String(normalizedText || "");
  const re = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    const level = Number(m[1]) || 3;
    const label = String(m[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) continue;
    matches.push({
      kind: headingKind(level, "html_min"),
      charStart: m.index,
      charEnd: m.index + m[0].length,
      label,
      level,
    });
  }
  return matches;
}

/**
 * @param {string} normalizedText
 * @param {'html_min'|'markdown'} format
 * @returns {{ kind: 'chapter'|'section', charStart: number, charEnd: number, label: string, level?: number }[]}
 */
export function parseHeadings(normalizedText, format) {
  const fmt = String(format || "markdown").trim();
  const raw =
    fmt === "html_min"
      ? parseHtmlMinHeadings(normalizedText)
      : parseMarkdownHeadings(normalizedText);
  return raw.sort((a, b) => a.charStart - b.charStart);
}

/**
 * Build selectable scopes: full doc + heading ranges.
 * @returns {{ kind: 'full'|'chapter'|'section', charStart: number, charEnd: number, label: string, id: string }[]}
 */
export function buildScopeOptions(normalizedText, format) {
  const text = String(normalizedText || "");
  const len = text.length;
  const headings = parseHeadings(text, format);
  const options = [
    {
      id: "full",
      kind: "full",
      charStart: 0,
      charEnd: len,
      label: "Documento completo",
    },
  ];

  for (let i = 0; i < headings.length; i += 1) {
    const h = headings[i];
    const next = headings[i + 1];
    const charEnd = next ? next.charStart : len;
    options.push({
      id: slugify(h.label) || `scope-${i}`,
      kind: h.kind,
      charStart: h.charStart,
      charEnd,
      label: h.label,
    });
  }

  return options;
}

export const SCOPE_CHAR_WARN = 60000;

export function scopeCharCount(scope) {
  return Math.max(0, Number(scope?.charEnd) - Number(scope?.charStart));
}

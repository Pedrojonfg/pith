/**
 * Heading detection for Slow Mode scope picker.
 * Offsets are in normalizedTextFull coordinates.
 *
 * Markdown `#{1,6}` is the primary path for new normalized content.
 * `html_min` tag parsing is retained only for legacy sessions.
 */

import { flattenHierarchy } from "../normalization/hierarchy.js?v=20260625_02";

const DEFAULT_HEADING_FORMAT = "markdown";
const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/gm;

export const MIN_SCOPE_CHARS_PAPER = 200;
export const MIN_SCOPE_CHARS_BOOK = 500;

/**
 * @param {number} n
 */
export function formatCharCount(n) {
  const num = Math.max(0, Number(n) || 0);
  if (num >= 1_000_000) {
    const m = num / 1_000_000;
    return `~${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (num >= 1000) return `~${Math.round(num / 1000)}k`;
  return `~${num}`;
}

/**
 * @param {'paper'|'book'|'auto'} documentType
 * @param {{ charStart: number }[]} headings
 * @param {string} fullText
 */
export function resolveMinScopeChars(documentType, headings, fullText) {
  const type = String(documentType || "auto");
  if (type === "paper") return MIN_SCOPE_CHARS_PAPER;
  if (type === "book") return MIN_SCOPE_CHARS_BOOK;
  if (headings.length >= 10 || fullText.length > 200_000) return MIN_SCOPE_CHARS_BOOK;
  return MIN_SCOPE_CHARS_PAPER;
}

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

/** @deprecated Legacy sessions only; new uploads use markdown. */
function parseHtmlMinHeadings(normalizedText) {
  const text = String(normalizedText || "");
  const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
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
  const fmt = String(format || DEFAULT_HEADING_FORMAT).trim().toLowerCase();
  const raw =
    fmt === "html_min"
      ? parseHtmlMinHeadings(normalizedText)
      : parseMarkdownHeadings(normalizedText);
  return raw.sort((a, b) => a.charStart - b.charStart);
}

/**
 * @typedef {{ type: 'rename'|'remove'|'split'|'merge', headingId: string, newLabel?: string, splitAt?: number }} HeadingOverride
 */

/**
 * @param {{ charStart: number, charEnd: number, label: string, level?: number, kind?: string, id?: string }[]} headings
 * @param {HeadingOverride[]} overrides
 */
export function applyHeadingOverrides(headings, overrides) {
  if (!overrides?.length) return [...headings];

  let result = headings.map((h, i) => ({
    ...h,
    id: h.id || slugify(h.label) || `heading-${i}`,
  }));

  for (const ov of overrides) {
    const idx = result.findIndex((h) => (h.id || slugify(h.label)) === ov.headingId);
    if (idx < 0) continue;

    if (ov.type === "remove") {
      result.splice(idx, 1);
      continue;
    }

    if (ov.type === "rename" && ov.newLabel) {
      result[idx] = { ...result[idx], label: ov.newLabel };
      continue;
    }

    if (ov.type === "split" && typeof ov.splitAt === "number") {
      const h = result[idx];
      const splitAt = Math.max(h.charStart, Math.min(ov.splitAt, h.charEnd || h.charStart));
      const first = { ...h, charEnd: splitAt };
      const second = {
        ...h,
        id: `${h.id || slugify(h.label)}-b`,
        label: `${h.label} (cont.)`,
        charStart: splitAt,
        level: (h.level || 2) + 1,
        kind: "section",
      };
      result.splice(idx, 1, first, second);
      continue;
    }

    if (ov.type === "merge" && idx < result.length - 1) {
      const h = result[idx];
      const next = result[idx + 1];
      result[idx] = {
        ...h,
        label: `${h.label} / ${next.label}`,
        charEnd: next.charEnd,
      };
      result.splice(idx + 1, 1);
    }
  }

  return result;
}

/**
 * @param {string} text
 * @param {{ targetChunkSize?: number, labelPrefix?: string }} [opts]
 */
export function buildEqualLengthSections(text, opts = {}) {
  const target = opts.targetChunkSize ?? 5000;
  const prefix = opts.labelPrefix ?? "Sección";
  const raw = String(text || "");
  const len = raw.length;
  if (!len) return [];

  /** @type {{ id: string, kind: string, charStart: number, charEnd: number, label: string }[]} */
  const sections = [];
  let start = 0;
  let index = 1;

  while (start < len) {
    let end = Math.min(start + target, len);
    if (end < len) {
      const slice = raw.slice(start, end);
      const paraBreak = slice.lastIndexOf("\n\n");
      if (paraBreak > target * 0.5) {
        end = start + paraBreak;
      }
    }
    if (end <= start) end = Math.min(start + target, len);
    sections.push({
      id: `section-${index}`,
      kind: "section",
      charStart: start,
      charEnd: end,
      label: `${prefix} ${index}`,
    });
    start = end;
    index += 1;
  }

  return sections;
}

/**
 * @param {import("../normalization/types.js").HierarchyNode} node
 * @param {number} textLen
 */
function scopeOptionFromHierarchyNode(node, textLen) {
  const level = Math.min(3, Math.max(1, Number(node.level) || 1));
  return {
    kind: level === 1 ? /** @type {const} */ ("chapter") : /** @type {const} */ ("section"),
    charStart: node.startOffset,
    charEnd: node.endOffset,
    label: node.title,
    id: slugify(node.title) || `hier-${node.startOffset}`,
    level,
    displaySize: formatCharCount(node.endOffset - node.startOffset),
  };
}

/**
 * Build selectable scopes: full doc + heading ranges.
 * @param {string} normalizedText
 * @param {'html_min'|'markdown'} [format]
 * @param {{ minScopeChars?: number, documentType?: 'paper'|'book'|'auto', headingOverrides?: HeadingOverride[], fallbackSections?: { id: string, kind: string, charStart: number, charEnd: number, label: string }[], docHierarchy?: { tree?: import("../normalization/types.js").HierarchyNode[] } | null }} [options]
 * @returns {{ kind: 'full'|'chapter'|'section', charStart: number, charEnd: number, label: string, id: string, level?: number, parentLabel?: string, displaySize?: string }[]}
 */
export function buildScopeOptions(normalizedText, format = DEFAULT_HEADING_FORMAT, options = {}) {
  const text = String(normalizedText || "");
  const len = text.length;

  if (options.docHierarchy?.tree?.length) {
    const flat = flattenHierarchy(options.docHierarchy.tree, 2);
    const optionsList = [
      {
        id: "full",
        kind: /** @type {const} */ ("full"),
        charStart: 0,
        charEnd: len,
        label: "Full document",
        displaySize: formatCharCount(len),
      },
    ];

    const minChars =
      options.minScopeChars ??
      resolveMinScopeChars(options.documentType || "auto", [], text);

    for (let i = 0; i < flat.length; i += 1) {
      const node = flat[i];
      const charCount = node.endOffset - node.startOffset;
      if (charCount < minChars) continue;

      let parentLabel;
      for (let j = i - 1; j >= 0; j -= 1) {
        const prev = flat[j];
        if ((prev.level || 2) < (node.level || 2) && prev.startOffset <= node.startOffset) {
          parentLabel = prev.title;
          break;
        }
      }

      optionsList.push({
        ...scopeOptionFromHierarchyNode(node, len),
        parentLabel,
      });
    }

    return optionsList;
  }

  let headings = parseHeadings(text, format);

  if (options.headingOverrides?.length) {
    headings = applyHeadingOverrides(
      headings.map((h, i) => ({ ...h, id: slugify(h.label) || `scope-${i}` })),
      options.headingOverrides,
    );
  }

  const minChars =
    options.minScopeChars ??
    resolveMinScopeChars(options.documentType || "auto", headings, text);

  const optionsList = [
    {
      id: "full",
      kind: /** @type {const} */ ("full"),
      charStart: 0,
      charEnd: len,
      label: "Full document",
      displaySize: formatCharCount(len),
    },
  ];

  for (let i = 0; i < headings.length; i += 1) {
    const h = headings[i];
    const next = headings[i + 1];
    const charEnd = next ? next.charStart : len;
    const charCount = charEnd - h.charStart;
    if (charCount < minChars) continue;

    let parentLabel;
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = headings[j];
      if ((prev.level || 2) < (h.level || 2)) {
        parentLabel = prev.label;
        break;
      }
    }

    optionsList.push({
      id: slugify(h.label) || `scope-${i}`,
      kind: h.kind,
      charStart: h.charStart,
      charEnd,
      label: h.label,
      level: h.level,
      parentLabel,
      displaySize: formatCharCount(charCount),
    });
  }

  if (options.fallbackSections?.length && headings.length === 0) {
    for (const sec of options.fallbackSections) {
      const charCount = sec.charEnd - sec.charStart;
      optionsList.push({
        ...sec,
        kind: /** @type {'section'} */ (sec.kind || "section"),
        displaySize: formatCharCount(charCount),
      });
    }
  }

  return optionsList;
}

export const SCOPE_CHAR_WARN = 60000;

export function scopeCharCount(scope) {
  return Math.max(0, Number(scope?.charEnd) - Number(scope?.charStart));
}

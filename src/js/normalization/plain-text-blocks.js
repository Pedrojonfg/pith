/**
 * Plain-text (txt/md) block extraction helpers — Gutenberg headings, RFC sections, boilerplate.
 */

import { createTextBlock } from "./types.js";

const GUTENBERG_START_RE = /^\*{3}\s*START OF THE PROJECT GUTENBERG EBOOK \d+\s*\*{3}\s*$/i;
const GUTENBERG_END_RE = /^\*{3}\s*END OF THE PROJECT GUTENBERG EBOOK \d+\s*\*{3}\s*$/i;
const TXT_HEADING_LINE_RE = /^\s*(?:CONTENTS|Letter \d+|Chapter \d+)\s*$/i;
const RFC_SECTION_LINE_RE = /^\s*\d+(?:\.\d+)+\.\s+\S/;
const RFC_TOP_SECTION_LINE_RE = /^\s*\d+\.\s+[A-Z]/;
const RFC_TOC_LINE_RE = /^\s*TABLE OF CONTENTS\s*$/i;
const RFC_ALLCAPS_LINE_RE = /^[A-Z0-9][A-Z0-9\s./\-]+$/;

/**
 * @param {string} line
 */
function isRfcSectionHeaderLine(line) {
  const t = String(line || "").trim();
  if (/\.{3,}/.test(t)) return false;
  return RFC_SECTION_LINE_RE.test(t) || RFC_TOP_SECTION_LINE_RE.test(t);
}

/**
 * @param {string} line
 */
function isStandaloneAllCapsHeadingLine(line) {
  const t = String(line || "").trim();
  if (t.length < 4 || t.length > 120) return false;
  if (!RFC_ALLCAPS_LINE_RE.test(t)) return false;
  return t === t.toUpperCase() && /[A-Z]/.test(t);
}

/**
 * Strip Gutenberg packaging lines and expand standalone heading lines into blocks.
 * @param {string} text
 */
export function preprocessPlainText(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");

  const filtered = lines.filter((ln) => {
    const trim = ln.trim();
    return trim && !GUTENBERG_START_RE.test(trim) && !GUTENBERG_END_RE.test(trim);
  });

  /** @type {string[]} */
  const out = [];
  for (const ln of filtered) {
    if (TXT_HEADING_LINE_RE.test(ln) && out.length && out[out.length - 1] !== "") {
      out.push("");
    }
    out.push(ln);
    if (TXT_HEADING_LINE_RE.test(ln)) {
      out.push("");
    }
  }

  return out.join("\n").trim();
}

/**
 * Split plain text into logical blocks (RFC sections, all-caps headings, paragraphs).
 * @param {string} text
 */
function splitPlainTextLines(text) {
  const lines = String(text || "").split(/\n/);
  /** @type {string[]} */
  const parts = [];
  /** @type {string[]} */
  let buf = [];

  const flush = () => {
    const chunk = buf.join("\n").trim();
    if (chunk) parts.push(chunk);
    buf = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (
      RFC_TOC_LINE_RE.test(trimmed) ||
      isRfcSectionHeaderLine(trimmed) ||
      isStandaloneAllCapsHeadingLine(trimmed)
    ) {
      flush();
      parts.push(trimmed);
      continue;
    }
    buf.push(line);
  }
  flush();
  return parts;
}

/**
 * @param {string} text
 * @param {"txt"|"md"} source
 * @returns {import("./types.js").TextBlock[]}
 */
export function extractPlainBlocks(text, source) {
  const raw = preprocessPlainText(text);
  if (!raw) return [];

  /** @type {import("./types.js").TextBlock[]} */
  const blocks = [];
  let lineIndex = 0;

  for (const part of splitPlainTextLines(raw)) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n");
    if (lines.length > 1) {
      const firstLine = lines[0].trim();
      const rest = lines.slice(1).join("\n").trim();
      const firstWords = firstLine.split(/\s+/).filter(Boolean);
      const isAllCapsTitle =
        firstWords.length >= 3 &&
        firstWords.length <= 20 &&
        firstLine === firstLine.toUpperCase() &&
        /[A-Z]/.test(firstLine);

      if (isAllCapsTitle && rest) {
        blocks.push(
          createTextBlock({
            text: firstLine,
            fontSize: 0,
            source,
            lineIndex: lineIndex++,
            kind: "paragraph",
          }),
        );
        blocks.push(
          createTextBlock({
            text: rest,
            fontSize: 0,
            source,
            lineIndex: lineIndex++,
            kind: "paragraph",
          }),
        );
        continue;
      }
    }

    blocks.push(
      createTextBlock({
        text: trimmed,
        fontSize: 0,
        source,
        lineIndex: lineIndex++,
        kind: "paragraph",
      }),
    );
  }

  return blocks.filter((b) => b.text);
}

/**
 * Merge pre-CONTENTS title blocks into one document title (Gutenberg novels).
 * @param {import("./types.js").TextBlock[]} blocks
 */
export function mergeGutenbergTitleBlocks(blocks) {
  if (!blocks?.length) return blocks;

  const contentsIdx = blocks.findIndex((b) => /^contents$/i.test(String(b.text || "").trim()));
  if (contentsIdx <= 0) return blocks;

  /** @type {string[]} */
  const titleParts = [];
  for (let i = 0; i < contentsIdx; i++) {
    const raw = String(blocks[i].text || "").trim();
    if (!raw || /^\*{3}/.test(raw)) continue;
    if (/^by\s+/i.test(raw)) continue;
    titleParts.push(raw.replace(/\s*\n\s*/g, " "));
  }
  if (!titleParts.length) return blocks;

  /** @type {string[]} */
  const titleOnlyParts = [];
  for (const part of titleParts) {
    const p = part.replace(/\s+by\s+.+$/i, "").trim();
    if (p && !/^by\s+/i.test(p)) titleOnlyParts.push(p);
  }
  const title = titleOnlyParts.join(" ").replace(/;\s+/, "; ").trim();

  const merged = createTextBlock({
    ...blocks[0],
    text: title,
    kind: "heading",
    lineIndex: 1,
    source: blocks[0].source || "txt",
  });

  return [merged, ...blocks.slice(contentsIdx)];
}

/**
 * Merge RFC title-page all-caps lines before TABLE OF CONTENTS into one L1 title.
 * @param {import("./types.js").TextBlock[]} blocks
 */
export function mergeRfcTitleBlocks(blocks) {
  if (!blocks?.length) return blocks;

  const tocIdx = blocks.findIndex((b) => RFC_TOC_LINE_RE.test(String(b.text || "").trim()));
  if (tocIdx <= 0) return blocks;

  /** @type {string[]} */
  const titleParts = [];
  for (let i = 0; i < tocIdx; i++) {
    const raw = String(blocks[i].text || "").trim();
    if (!raw) continue;
    if (/^RFC:/i.test(raw)) continue;
    if (/^September \d{4}$/i.test(raw)) continue;
    if (/^prepared for$/i.test(raw) || /^by$/i.test(raw)) continue;
    if (/^\d{4,}/.test(raw) && raw.length < 80) continue;
    if (isStandaloneAllCapsHeadingLine(raw)) {
      titleParts.push(raw);
    }
  }
  if (titleParts.length < 2) return blocks;

  const title = titleParts.join(" / ");
  const merged = createTextBlock({
    ...blocks[0],
    text: title,
    kind: "heading",
    lineIndex: 1,
    source: blocks[0].source || "txt",
  });

  return [merged, ...blocks.slice(tocIdx)];
}

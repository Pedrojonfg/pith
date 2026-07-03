/**
 * HTML block extraction with heading inference before style strip (research R8).
 */

import { createTextBlock } from "./types.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */

function escapeMarkdownTableCell(text) {
  return String(text || "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/**
 * Minimal HTML table → markdown table.
 * @param {Element} tableEl
 * @returns {string|null}
 */
function tableElementToMarkdown(tableEl) {
  const rows = Array.from(tableEl.querySelectorAll("tr"));
  if (!rows.length) return null;

  const grid = rows.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("th,td"));
    return cells.map((c) => escapeMarkdownTableCell(c.textContent || ""));
  }).filter((r) => r.length > 0);

  if (!grid.length) return null;

  const headerRow =
    Array.from(rows[0].querySelectorAll("th")).length > 0
      ? grid[0]
      : grid[0];
  const colCount = Math.max(1, ...grid.map((r) => r.length));
  const header = Array.from({ length: colCount }, (_, i) => headerRow[i] || "");
  const sep = Array.from({ length: colCount }, () => "---");
  const body = grid.slice(1).map((r) => Array.from({ length: colCount }, (_, i) => r[i] || ""));

  const lines = [];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${sep.join(" | ")} |`);
  for (const r of body) {
    lines.push(`| ${r.join(" | ")} |`);
  }
  return lines.join("\n");
}

/** [debug-enrich] instrumentation-only */
function dppNormDbg() {
  return globalThis.__dppNormalizationDebug;
}

const HEADING_CLASS_PATTERNS = [
  { re: /heading\s*1|h1|title/i, level: 1 },
  { re: /heading\s*2|h2|chapter/i, level: 2 },
  { re: /heading\s*3|h3|section/i, level: 3 },
  { re: /heading\s*4|h4/i, level: 4 },
  { re: /heading\s*5|h5/i, level: 5 },
  { re: /heading\s*6|h6/i, level: 6 },
];

/**
 * @param {string} style
 */
function parseInlineFontSize(style) {
  const m = String(style || "").match(/font-size\s*:\s*([\d.]+)(pt|px|em)?/i);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  if (m[2]?.toLowerCase() === "em") return val * 12;
  return val;
}

/**
 * @param {string} style
 */
function parseInlineFontWeight(style) {
  const m = String(style || "").match(/font-weight\s*:\s*(\w+|\d+)/i);
  if (!m) return "normal";
  const v = m[1].toLowerCase();
  if (v === "bold" || v === "bolder") return "bold";
  const num = parseInt(v, 10);
  if (num >= 600) return "bold";
  return "normal";
}

/**
 * @param {Element} el
 */
export function inferLevelFromElement(el) {
  const tag = String(el.tagName || "").toLowerCase();
  const hMatch = /^h([1-6])$/.exec(tag);
  if (hMatch) return parseInt(hMatch[1], 10);

  const role = el.getAttribute("role");
  const ariaLevel = el.getAttribute("aria-level");
  if (role === "heading" && ariaLevel) {
    return Math.min(6, Math.max(1, parseInt(ariaLevel, 10) || 2));
  }

  const className = String(el.className || "");
  for (const { re, level } of HEADING_CLASS_PATTERNS) {
    if (re.test(className)) return level;
  }

  const style = el.getAttribute("style") || "";
  const fs = parseInlineFontSize(style);
  const fw = parseInlineFontWeight(style);
  if (fs >= 18 || fw === "bold") {
    if (fs >= 24) return 1;
    if (fs >= 18) return 2;
    return 3;
  }

  return 0;
}

/**
 * @param {string} html
 * @returns {TextBlock[]}
 */
export function extractHtmlBlocks(html) {
  const raw = String(html || "").trim();
  if (!raw) return [];

  if (typeof DOMParser === "undefined") {
    return fallbackHtmlBlocks(raw);
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(raw, "text/html");
  const body = doc.body || doc.documentElement;
  /** @type {TextBlock[]} */
  const blocks = [];
  let lineIndex = 0;

  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = /** @type {Element} */ (node);
    const tag = String(el.tagName || "").toLowerCase();

    if (tag === "script" || tag === "style" || tag === "noscript") return;

    if (tag === "table") {
      const md = tableElementToMarkdown(el);
      if (md) {
        blocks.push(
          createTextBlock({
            text: md,
            fontSize: 0,
            fontWeight: "normal",
            pageIndex: 0,
            lineIndex,
            source: "html",
            kind: "paragraph",
          }),
        );
        lineIndex += 1;
      }
      return;
    }

    const blockTags = new Set([
      "p", "div", "h1", "h2", "h3", "h4", "h5", "h6",
      "li", "blockquote", "pre",
    ]);

    if (blockTags.has(tag)) {
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (text) {
        const level = inferLevelFromElement(el);
        const mdText = level > 0 ? `${"#".repeat(level)} ${text}` : text;
        const style = el.getAttribute("style") || "";
        const fontSize = parseInlineFontSize(style) || (level ? 18 - level : 0);
        const fontWeight = parseInlineFontWeight(style);
        blocks.push(
          createTextBlock({
            text: mdText,
            fontSize,
            fontWeight,
            pageIndex: 0,
            lineIndex: level > 0 ? level : lineIndex,
            source: "html",
            kind: level > 0 ? "heading" : "paragraph",
          }),
        );
        lineIndex += 1;
      }
      return;
    }

    for (const child of Array.from(el.children || [])) walk(child);
  };

  for (const child of Array.from(body.children || [])) walk(child);

  const tableCount = (raw.match(/<table\b/gi) || []).length; // [debug-enrich]
  console.info("[extract-html-blocks.extractHtmlBlocks] Done:", {
    blockCount: blocks.length,
    htmlTablesInSource: tableCount,
  }); // [debug-enrich]
  const bag = dppNormDbg();
  if (bag && tableCount > 0) {
    bag.tablesDetected = tableCount;
    bag.tablesEmittedOk = 0; // updated by downstream emit step in later tasks
  }

  if (!blocks.length) {
    const text = (body.innerText || body.textContent || "").trim();
    if (text) {
      blocks.push(
        createTextBlock({
          text,
          fontSize: 0,
          source: "html",
          kind: "paragraph",
        }),
      );
    }
  }

  return blocks;
}

/**
 * @param {string} html
 * @returns {TextBlock[]}
 */
function fallbackHtmlBlocks(html) {
  const blocks = [];
  const headingRe = /<p[^>]*class=["'][^"']*Heading1[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  let lineIndex = 0;
  while ((m = headingRe.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (text) {
      blocks.push(
        createTextBlock({
          text,
          fontSize: 24,
          fontWeight: "bold",
          lineIndex: 1,
          source: "html",
          kind: "heading",
        }),
      );
      lineIndex += 1;
    }
  }
  if (!blocks.length) {
    const plain = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (plain) {
      blocks.push(createTextBlock({ text: plain, source: "html", kind: "paragraph" }));
    }
  }
  return blocks;
}

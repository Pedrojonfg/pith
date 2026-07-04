/**
 * HTML block extraction with heading inference before style strip (research R8).
 */

import { createTextBlock } from "./types.js";
import { htmlTableToMarkdown } from "./table-markdown.js";
import { extractHeadingTextFromElement, normalizeHeadingLabel, resolveHtmlContentRoot, isHtmlBoilerplateElement } from "./heading-text.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */

/** [debug-enrich] instrumentation-only */
function dppNormDbg() {
  return globalThis.__dppNormalizationDebug;
}

/** [debug-enrich] */
function sampleBlockTexts(blocks, limit = 5, maxLen = 80) {
  return (blocks || []).slice(0, limit).map((b, i) => ({
    index: i,
    kind: b?.kind || "unknown",
    textPreview: String(b?.text || "").replace(/\s+/g, " ").trim().slice(0, maxLen),
    charLen: String(b?.text || "").length,
  }));
}

/** [debug-enrich] */
function domStructureDiagnostics(body) {
  const directChildren = Array.from(body?.children || []);
  const blockTagRe = /^(p|div|h[1-6]|li|blockquote|pre|section|table|article|main)$/i;
  const directChildTags = directChildren.map((el) => String(el.tagName || "").toLowerCase());
  const nestedBlockCount = body?.querySelectorAll
    ? body.querySelectorAll("p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre, section, table").length
    : 0;
  return {
    bodyDirectChildCount: directChildren.length,
    bodyDirectChildTags: directChildTags.slice(0, 12),
    bodyDirectBlockTagCount: directChildTags.filter((t) => blockTagRe.test(t)).length,
    nestedBlockElementCount: nestedBlockCount,
  };
}

const HEADING_CLASS_PATTERNS = [
  { re: /heading\s*1|h1|title/i, level: 1 },
  { re: /heading\s*2|h2|chapter/i, level: 2 },
  { re: /heading\s*3|h3|section/i, level: 3 },
  { re: /heading\s*4|h4/i, level: 4 },
  { re: /heading\s*5|h5/i, level: 5 },
  { re: /heading\s*6|h6/i, level: 6 },
  { re: /\bmw-heading\b/i, level: 2 },
];

/**
 * @param {string} style
 */
export function parseInlineFontSize(style) {
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
 * @returns {{ level: number, heuristic: boolean }}
 */
export function inferLevelFromElement(el) {
  const tag = String(el.tagName || "").toLowerCase();
  const hMatch = /^h([1-6])$/.exec(tag);
  if (hMatch) return { level: parseInt(hMatch[1], 10), heuristic: false };

  if (tag === "span" && /\bmw-headline\b/i.test(String(el.className || ""))) {
    const parentTag = String(el.parentElement?.tagName || "").toLowerCase();
    const parentH = /^h([1-6])$/.exec(parentTag);
    if (parentH) return { level: parseInt(parentH[1], 10), heuristic: false };
    return { level: 2, heuristic: true };
  }

  const role = el.getAttribute("role");
  const ariaLevel = el.getAttribute("aria-level");
  if (role === "heading" && ariaLevel) {
    return {
      level: Math.min(6, Math.max(1, parseInt(ariaLevel, 10) || 2)),
      heuristic: false,
    };
  }

  const className = String(el.className || "");
  for (const { re, level } of HEADING_CLASS_PATTERNS) {
    if (re.test(className)) {
      return { level, heuristic: /\bmw-heading\b/i.test(className) };
    }
  }

  const mwChild = el.querySelector?.(".mw-headline");
  if (mwChild) {
    const parentTag = String(el.tagName || "").toLowerCase();
    const parentH = /^h([1-6])$/.exec(parentTag);
    if (parentH) return { level: parseInt(parentH[1], 10), heuristic: false };
    return { level: 2, heuristic: true };
  }

  const style = el.getAttribute("style") || "";
  const fs = parseInlineFontSize(style);
  const fw = parseInlineFontWeight(style);
  if (fs >= 18 || fw === "bold") {
    if (fs >= 24) return { level: 1, heuristic: true };
    if (fs >= 18) return { level: 2, heuristic: true };
    return { level: 3, heuristic: true };
  }

  return { level: 0, heuristic: false };
}

/**
 * @param {Element} el
 * @param {number} lineIndex
 * @returns {TextBlock|null}
 */
function blockFromHeadingElement(el, lineIndex) {
  const { level, heuristic } = inferLevelFromElement(el);
  if (level <= 0) return null;

  const mw = el.querySelector?.(".mw-headline");
  const text = mw ? extractHeadingTextFromElement(mw) : extractHeadingTextFromElement(el);
  if (!text) return null;

  const mdText = `${"#".repeat(level)} ${text}`;
  const style = el.getAttribute("style") || "";
  const fontSize = parseInlineFontSize(style) || (level ? 18 - level : 0);
  const fontWeight = heuristic ? "heuristic" : parseInlineFontWeight(style);

  return createTextBlock({
    text: mdText,
    fontSize,
    fontWeight,
    pageIndex: 0,
    lineIndex: level,
    source: "html",
    kind: "heading",
  });
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
  const contentRoot = resolveHtmlContentRoot(body);
  const domDiag = domStructureDiagnostics(contentRoot); // [debug-enrich]
  console.debug("[extract-html-blocks.extractHtmlBlocks] DOM parsed (pre-traversal):", {
    htmlCharLen: raw.length,
    ...domDiag,
  }); // [debug-enrich]
  /** @type {TextBlock[]} */
  const blocks = [];
  let lineIndex = 0;

  const walk = (node) => {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) return;
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = /** @type {Element} */ (node);
    const tag = String(el.tagName || "").toLowerCase();

    if (isHtmlBoilerplateElement(el)) return;

    if (tag === "script" || tag === "style" || tag === "noscript") return;

    if (tag === "table") {
      const md = htmlTableToMarkdown(el);
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

    if (tag === "span" && /\bmw-headline\b/i.test(String(el.className || ""))) {
      const parentTag = String(el.parentElement?.tagName || "").toLowerCase();
      if (/^h[1-6]$/.test(parentTag)) return;
      const text = extractHeadingTextFromElement(el);
      if (text) {
        const level = 2;
        blocks.push(
          createTextBlock({
            text: `${"#".repeat(level)} ${text}`,
            fontSize: 0,
            fontWeight: "heuristic",
            pageIndex: 0,
            lineIndex: level,
            source: "html",
            kind: "heading",
          }),
        );
        lineIndex += 1;
      }
      return;
    }

    const containerTags = new Set([
      "div", "section", "article", "main", "header", "footer", "aside", "nav", "figure",
    ]);
    const leafBlockTags = new Set([
      "p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "pre",
    ]);

    if (containerTags.has(tag)) {
      const elementChildren = Array.from(el.children || []);
      if (!elementChildren.length) {
        const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
        if (text) {
          blocks.push(
            createTextBlock({
              text,
              fontSize: 0,
              fontWeight: "normal",
              pageIndex: 0,
              lineIndex: lineIndex++,
              source: "html",
              kind: "paragraph",
            }),
          );
        }
      } else {
        for (const child of elementChildren) walk(child);
      }
      return;
    }

    if (leafBlockTags.has(tag)) {
      const headingBlock = /^h[1-6]$/.test(tag) ? blockFromHeadingElement(el, lineIndex) : null;
      if (headingBlock) {
        blocks.push(headingBlock);
        lineIndex += 1;
        return;
      }

      const { level, heuristic } = inferLevelFromElement(el);
      const text = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
      if (text) {
        const mdText = level > 0 ? `${"#".repeat(level)} ${text}` : text;
        const style = el.getAttribute("style") || "";
        const fontSize = parseInlineFontSize(style) || (level ? 18 - level : 0);
        const fontWeight = heuristic ? "heuristic" : parseInlineFontWeight(style);
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

  for (const child of Array.from(contentRoot.children || [])) walk(child);

  const tableCount = (raw.match(/<table\b/gi) || []).length;
  const preFallbackBlockCount = blocks.length; // [debug-enrich]
  const preFallbackHeadingCount = blocks.filter((b) => b.kind === "heading").length; // [debug-enrich]
  console.info("[extract-html-blocks.extractHtmlBlocks] Post-traversal (pre-fallback):", {
    blockCount: preFallbackBlockCount,
    headingBlocks: preFallbackHeadingCount,
    htmlTablesInSource: tableCount,
    ...domDiag,
    blockSamples: sampleBlockTexts(blocks),
  }); // [debug-enrich]
  const bag = dppNormDbg();
  if (bag && tableCount > 0) {
    bag.tablesDetected = tableCount;
    bag.tablesEmittedOk = 0;
  }

  if (!blocks.length) {
    const text = (body.innerText || body.textContent || "").trim();
    console.warn("[extract-html-blocks.extractHtmlBlocks] Empty-block fallback:", {
      reason: "no_block_tags_emitted_during_traversal",
      blocksIn: 0,
      blocksOut: text ? 1 : 0,
      mergeRule: "single_body_text_fallback",
      bodyTextCharLen: text.length,
      ...domDiag,
    }); // [debug-enrich]
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

  console.info("[extract-html-blocks.extractHtmlBlocks] Done:", {
    blockCount: blocks.length,
    preFallbackBlockCount,
    htmlTablesInSource: tableCount,
    headingBlocks: blocks.filter((b) => b.kind === "heading").length,
    blockSamples: sampleBlockTexts(blocks),
  }); // [debug-enrich]
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

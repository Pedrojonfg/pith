/**
 * PDF block extraction via pdf.js getTextContent (research R4).
 */

import { createTextBlock } from "./types.js";
import { loadPdfJs } from "./pdf-loader.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */

const Y_TOLERANCE = 2;

/** [debug-enrich] placeholder — calibrate against known-good PDFs; aligns with scanned_pdf_no_text (~50 chars) */
const LOW_EXTRACTION_PAGE_CHARS = 50;

/** [debug-enrich] instrumentation-only */
function dppNormDbg() {
  return globalThis.__dppNormalizationDebug;
}

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

/** [debug-enrich] math-notation diagnostics (PDF text-layer extraction can garble/drop symbols) */
const MATH_INDICATOR_CHARS = new Set(
  [
    "α",
    "β",
    "γ",
    "δ",
    "ε",
    "θ",
    "λ",
    "μ",
    "π",
    "ρ",
    "σ",
    "τ",
    "φ",
    "ω",
    "Δ",
    "Θ",
    "Λ",
    "Π",
    "Σ",
    "Φ",
    "Ω",
    "√",
    "∫",
    "±",
    "≤",
    "≥",
    "∂",
    "∇",
  ],
); // [debug-enrich]

/** [debug-enrich] */
function scanMathDiagnostics(text) {
  const s = String(text || "");
  let replacement = 0;
  let suspiciousUnicode = 0;
  let mathIndicators = 0;

  // Count code points to avoid splitting surrogate pairs.
  for (const ch of s) {
    const cp = ch.codePointAt(0) || 0;
    if (cp === 0xfffd) replacement += 1;
    if (MATH_INDICATOR_CHARS.has(ch)) mathIndicators += 1;

    // Private Use Areas + Specials are strong "custom font mapping" signals.
    const isPrivateUse =
      (cp >= 0xe000 && cp <= 0xf8ff) ||
      (cp >= 0xf0000 && cp <= 0xffffd) ||
      (cp >= 0x100000 && cp <= 0x10fffd);
    const isSpecials = cp >= 0xfff0 && cp <= 0xffff;
    if (isPrivateUse || isSpecials) suspiciousUnicode += 1;
  }

  // LaTeX-like remnants that sometimes survive OCR/extraction.
  const latexHits =
    (s.match(/\\(frac|sum|int|sqrt|alpha|beta|gamma|theta|sigma|Sigma)\b/g) || []).length +
    (s.match(/\^\{|\_\{/g) || []).length;
  mathIndicators += latexHits;

  return { replacement, suspiciousUnicode, mathIndicators };
}

/**
 * @param {number[]} transform
 */
export function fontHeightFromTransform(transform) {
  const c = transform?.[2] ?? 0;
  const d = transform?.[3] ?? 0;
  return Math.hypot(c, d);
}

/**
 * Detect bicolumn layout from glyph x positions in central zone.
 * @param {{ x: number }[]} glyphs
 * @param {number} pageWidth
 */
export function detectColumnLayout(glyphs, pageWidth) {
  if (!glyphs?.length || pageWidth <= 0) return null;

  const xs = [...glyphs.map((g) => g.x)].sort((a, b) => a - b);
  const gapMin = pageWidth * 0.3;
  const gapMax = pageWidth * 0.7;
  let maxGap = 0;
  let splitX = 0;

  for (let i = 1; i < xs.length; i += 1) {
    const gap = xs[i] - xs[i - 1];
    const gapCenter = (xs[i] + xs[i - 1]) / 2;
    if (gapCenter >= gapMin && gapCenter <= gapMax && gap > maxGap) {
      maxGap = gap;
      splitX = gapCenter;
    }
  }

  if (maxGap > pageWidth * 0.08) {
    return { splitX, maxGap };
  }
  return null;
}

/**
 * @param {{ y: number, x: number, text: string, fontSize: number, fontWeight: number|"bold"|"normal", height: number }[]} glyphs
 * @param {number} pageIndex
 * @param {number} [pageHeight]
 * @returns {TextBlock[]}
 */
function glyphsToBlocks(glyphs, pageIndex, pageHeight = 792) {
  if (!glyphs.length) return [];

  glyphs.sort((a, b) => b.y - a.y || a.x - b.x);

  /** @type {{ y: number, parts: typeof glyphs }[]} */
  const lines = [];

  for (const g of glyphs) {
    let line = lines.find((ln) => Math.abs(ln.y - g.y) <= Y_TOLERANCE);
    if (!line) {
      line = { y: g.y, parts: [] };
      lines.push(line);
    }
    line.parts.push(g);
  }

  lines.sort((a, b) => b.y - a.y);

  return lines
    .map((line, lineIndex) => {
      line.parts.sort((a, b) => a.x - b.x);
      const text = line.parts
        .map((p) => p.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      const maxFont = Math.max(...line.parts.map((p) => p.fontSize));
      const hasBold = line.parts.some((p) => p.fontWeight === "bold");
      const minX = Math.min(...line.parts.map((p) => p.x));
      const maxX = Math.max(
        ...line.parts.map((p) => p.x + p.text.length * maxFont * 0.5),
      );
      return createTextBlock({
        text,
        fontSize: maxFont,
        fontWeight: hasBold ? "bold" : "normal",
        bbox: {
          x: minX,
          y: line.y,
          width: Math.max(0, maxX - minX),
          height: line.parts[0]?.height || maxFont,
        },
        pageIndex,
        lineIndex,
        source: "pdf",
        kind: "paragraph",
      });
    })
    .filter((b) => b.text.trim());
}

/**
 * @param {{ str?: string, transform?: number[], height?: number, fontName?: string, width?: number }[]} items
 * @param {number} pageIndex
 * @param {number} [pageHeight]
 * @param {number} [pageWidth]
 * @returns {TextBlock[]}
 */
export function clusterTextItemsToBlocks(items, pageIndex, pageHeight = 792, pageWidth = 612) {
  if (!items?.length) return [];

  /** @type {{ y: number, x: number, text: string, fontSize: number, fontWeight: number|"bold"|"normal", height: number }[]} */
  const glyphs = [];

  for (const item of items) {
    const str = String(item?.str || "");
    if (!str) continue;
    const t = item.transform || [1, 0, 0, 1, 0, 0];
    const x = t[4] ?? 0;
    const y = t[5] ?? 0;
    const fontSize = fontHeightFromTransform(t) || Number(item.height) || 0;
    const fontName = String(item.fontName || "");
    const fontWeight = /bold/i.test(fontName) ? "bold" : "normal";
    glyphs.push({ y, x, text: str, fontSize, fontWeight, height: item.height || fontSize });
  }

  const layout = detectColumnLayout(glyphs, pageWidth);
  if (!layout) {
    return glyphsToBlocks(glyphs, pageIndex, pageHeight);
  }

  const leftGlyphs = glyphs.filter((g) => g.x < layout.splitX);
  const rightGlyphs = glyphs.filter((g) => g.x >= layout.splitX);
  const leftBlocks = glyphsToBlocks(leftGlyphs, pageIndex, pageHeight);
  const rightBlocks = glyphsToBlocks(rightGlyphs, pageIndex, pageHeight);
  return [...leftBlocks, ...rightBlocks];
}

/**
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{ blocks: TextBlock[], pageHeights: number[], doc: object }>}
 */
export async function extractPdfBlocks(buffer) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const doc = await loadingTask.promise;
  /** @type {TextBlock[]} */
  const blocks = [];
  /** @type {number[]} */
  const pageHeights = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    pageHeights.push(viewport.height);
    const content = await page.getTextContent();

    /** [debug-enrich] detect extraction path without altering block clustering */
    let extractionPath = "text-native";
    const layoutGlyphs = [];
    for (const item of content.items || []) {
      const str = String(item?.str || "");
      if (!str) continue;
      const t = item.transform || [1, 0, 0, 1, 0, 0];
      layoutGlyphs.push({ x: t[4] ?? 0 });
    }
    if (detectColumnLayout(layoutGlyphs, viewport.width)) {
      extractionPath = "bicolumn-split";
    }

    const pageBlocks = clusterTextItemsToBlocks(
      content.items,
      pageNum - 1,
      viewport.height,
      viewport.width,
    );
    blocks.push(...pageBlocks);

    const pageText = pageBlocks.map((b) => b.text).join(" ");
    const pageChars = pageText.length;
    const pageWords = countWords(pageText);
    console.debug("[extract-pdf-blocks.extractPdfBlocks] Page extracted:", {
      pageNum,
      charCount: pageChars,
      wordCount: pageWords,
      blockCount: pageBlocks.length,
      extractionPath,
    }); // [debug-enrich]
    if (pageChars < LOW_EXTRACTION_PAGE_CHARS) {
      console.warn("[extract-pdf-blocks.extractPdfBlocks] Low extraction page:", {
        pageNum,
        charCount: pageChars,
        threshold: LOW_EXTRACTION_PAGE_CHARS,
        extractionPath,
        note: "placeholder threshold — calibrate against known-good PDFs",
      }); // [debug-enrich]
    }

    // [debug-enrich] math-notation integrity scan (counts only; no text dump)
    const mathDiag = scanMathDiagnostics(pageText); // [debug-enrich]
    const suspiciousDensity = pageChars > 0 ? mathDiag.suspiciousUnicode / pageChars : 0; // [debug-enrich]
    if (mathDiag.replacement > 0 || (mathDiag.suspiciousUnicode >= 5 && suspiciousDensity >= 0.005)) {
      console.warn("[extract-pdf-blocks.extractPdfBlocks] Suspicious math unicode on page:", {
        pageNum,
        charCount: pageChars,
        replacementChars: mathDiag.replacement,
        suspiciousUnicodeChars: mathDiag.suspiciousUnicode,
        suspiciousUnicodeDensity: Number(suspiciousDensity.toFixed(4)),
        mathIndicators: mathDiag.mathIndicators,
        extractionPath,
      }); // [debug-enrich]
    } else if (mathDiag.mathIndicators > 0) {
      console.debug("[extract-pdf-blocks.extractPdfBlocks] Math indicators on page:", {
        pageNum,
        mathIndicators: mathDiag.mathIndicators,
        replacementChars: mathDiag.replacement,
        suspiciousUnicodeChars: mathDiag.suspiciousUnicode,
      }); // [debug-enrich]
    }

    const bag = dppNormDbg();
    if (bag) {
      bag.totalPages = doc.numPages;
      if (pageChars < LOW_EXTRACTION_PAGE_CHARS) {
        bag.lowExtractionPages.push(pageNum);
      }

      // [debug-enrich] aggregate for end-of-pipeline summary
      bag.replacementCharsFound = (bag.replacementCharsFound || 0) + mathDiag.replacement;
      bag.mathIndicatorsFound = (bag.mathIndicatorsFound || 0) + mathDiag.mathIndicators;
      bag.suspiciousUnicodeCharsFound =
        (bag.suspiciousUnicodeCharsFound || 0) + mathDiag.suspiciousUnicode;
      bag.pagesWithReplacementChars =
        (bag.pagesWithReplacementChars || 0) + (mathDiag.replacement > 0 ? 1 : 0);
      bag.pagesWithSuspiciousUnicode =
        (bag.pagesWithSuspiciousUnicode || 0) +
        (mathDiag.suspiciousUnicode >= 5 && suspiciousDensity >= 0.005 ? 1 : 0);
    }
  }

  console.info("[extract-pdf-blocks.extractPdfBlocks] Document extraction summary:", {
    totalPages: doc.numPages,
    totalBlocks: blocks.length,
    lowExtractionPages: dppNormDbg()?.lowExtractionPages?.length ?? 0,
  }); // [debug-enrich]

  return { blocks, pageHeights, doc };
}

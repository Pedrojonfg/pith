/**
 * PDF block extraction via pdf.js getTextContent (research R4).
 */

import { createTextBlock } from "./types.js";
import { loadPdfJs } from "./pdf-loader.js";
import { renderPageFallback } from "../document-images/extract-pdf.js";
import { extractPageTextWithVision } from "../document-images/vision.js";
import { hasPlatformLlmAccess } from "../llm.js?v=20260625_02";
import { gridToMarkdownTable } from "./table-markdown.js";
import {
  PDF_TABLE_MIN_COLUMNS,
  PDF_TABLE_MIN_ROWS,
  PDF_TABLE_X_TOLERANCE,
  PDF_TABLE_CELL_GAP,
  mergeLinePartsIntoCells,
  deriveColumnAnchors,
  assignCellsToAnchors,
  validateTableGrid,
  blockMatchesTableAnchors,
  rowMatchesColumnAnchors,
} from "./pdf-table-constants.js";
import {
  detectTablesFromRulingLines,
  rulingTableOverlapsAlignment,
  lineIndicesInYRange,
} from "./pdf-ruling-lines.js";

export {
  mergeLinePartsIntoCells,
  deriveColumnAnchors,
  assignCellsToAnchors,
  validateTableGrid,
  blockMatchesTableAnchors,
  rowMatchesColumnAnchors,
} from "./pdf-table-constants.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {'lines'|'alignment'|'both'} PdfTableDetectionMethod */

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

const TABLE_CAPTION_RE = /^Table\s+(\d+)\.\s/i;
const TABLE_CONTINUED_RE = /^Table\s+(\d+)\.\s.+-\s*Continued/i;

/** @param {TextBlock} block */
function isMarkdownTableBlock(block) {
  return /^\| .+\|/m.test(String(block?.text || "").trim());
}

/**
 * @param {string} base
 * @param {string} addition
 * @param {boolean} [dropHeader]
 */
function appendMarkdownTables(base, addition, dropHeader = true) {
  const baseLines = String(base || "")
    .trim()
    .split(/\n/)
    .filter((line) => line.trim().startsWith("|"));
  const addLines = String(addition || "")
    .trim()
    .split(/\n/)
    .filter((line) => line.trim().startsWith("|"));
  let addStart = 0;
  if (dropHeader && addLines.length >= 2 && /^\|\s*[-: |]+\|/.test(addLines[1])) {
    addStart = 2;
  }
  return [...baseLines, ...addLines.slice(addStart)].join("\n");
}

/**
 * Merge PDF tables whose caption repeats with "- Continued" on subsequent pages.
 * @param {TextBlock[]} blocks
 */
function mergeCrossPageContinuationTables(blocks) {
  if (!blocks?.length) return blocks;

  /** @type {TextBlock[]} */
  const result = [];
  let i = 0;

  while (i < blocks.length) {
    const block = blocks[i];
    const captionMatch = TABLE_CAPTION_RE.exec(String(block.text || "").trim());

    if (captionMatch) {
      const tableNum = captionMatch[1];
      let tableIdx = -1;
      for (let j = i + 1; j < blocks.length; j += 1) {
        const between = String(blocks[j].text || "").trim();
        if (TABLE_CAPTION_RE.test(between) && j !== i + 1 && !isMarkdownTableBlock(blocks[j])) {
          break;
        }
        if (isMarkdownTableBlock(blocks[j])) {
          tableIdx = j;
          break;
        }
        if (blocks[j].pageIndex > block.pageIndex + 1) break;
      }

      if (tableIdx >= 0) {
        let mergedText = blocks[tableIdx].text;
        const mergedBlock = { ...blocks[tableIdx], text: mergedText };
        i = tableIdx + 1;

        while (i < blocks.length) {
          const nextText = String(blocks[i].text || "").trim();
          const contMatch = TABLE_CONTINUED_RE.exec(nextText);
          if (!contMatch || contMatch[1] !== tableNum) break;

          i += 1;
          let nextTableIdx = -1;
          const contPage = blocks[i - 1]?.pageIndex ?? -1;
          for (let j = i; j < blocks.length; j += 1) {
            if (blocks[j].pageIndex > contPage + 1) break;
            if (isMarkdownTableBlock(blocks[j])) {
              nextTableIdx = j;
              break;
            }
            if (TABLE_CAPTION_RE.test(String(blocks[j].text || "").trim()) && j > i) break;
          }
          if (nextTableIdx < 0) break;

          mergedText = appendMarkdownTables(mergedText, blocks[nextTableIdx].text, true);
          mergedBlock.text = mergedText;
          i = nextTableIdx + 1;
        }

        result.push(mergedBlock);
        continue;
      }
    }

    result.push(block);
    i += 1;
  }

  return result;
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

/** Count data rows in a markdown table (excludes header and separator). */
function countMarkdownTableDataRows(markdown) {
  const lines = String(markdown || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^\|\s*[-: ]+\|/.test(line));
  return Math.max(0, lines.length - 1);
}

/**
 * @param {{ type: "table", lineStart: number, lineEnd: number, markdown: string }[]} alignmentTables
 * @param {import("./pdf-ruling-lines.js").RulingLineTable[]} rulingTables
 * @param {{ y: number }[]} lines
 * @returns {Array<{ lineStart: number, lineEnd: number, markdown: string, detectionMethod: PdfTableDetectionMethod }>}
 */
function mergeTableDetections(alignmentTables, rulingTables, lines) {
  /** @type {Array<{ lineStart: number, lineEnd: number, markdown: string, detectionMethod: PdfTableDetectionMethod }>} */
  const merged = [];
  const usedAlignment = new Set();
  const usedRuling = new Set();

  for (let ri = 0; ri < rulingTables.length; ri += 1) {
    const ruling = rulingTables[ri];
    let matchedAi = -1;
    for (let ai = 0; ai < alignmentTables.length; ai += 1) {
      if (usedAlignment.has(ai)) continue;
      if (rulingTableOverlapsAlignment(ruling, alignmentTables[ai], lines)) {
        matchedAi = ai;
        break;
      }
    }
    if (matchedAi >= 0) {
      usedAlignment.add(matchedAi);
      usedRuling.add(ri);
      const seg = alignmentTables[matchedAi];
      const alignRows = countMarkdownTableDataRows(seg.markdown);
      const rulingRows = countMarkdownTableDataRows(ruling.markdown);
      const preferRuling =
        rulingRows >= alignRows ||
        (alignRows > 0 && rulingRows / alignRows >= 0.85);
      merged.push({
        lineStart: seg.lineStart,
        lineEnd: seg.lineEnd,
        markdown: preferRuling ? ruling.markdown : seg.markdown,
        detectionMethod: "both",
      });
    }
  }

  for (let ai = 0; ai < alignmentTables.length; ai += 1) {
    if (usedAlignment.has(ai)) continue;
    const seg = alignmentTables[ai];
    merged.push({
      lineStart: seg.lineStart,
      lineEnd: seg.lineEnd,
      markdown: seg.markdown,
      detectionMethod: "alignment",
    });
  }

  for (let ri = 0; ri < rulingTables.length; ri += 1) {
    if (usedRuling.has(ri)) continue;
    const ruling = rulingTables[ri];
    const indices = lineIndicesInYRange(lines, ruling.yTop, ruling.yBottom);
    merged.push({
      lineStart: indices.length ? Math.min(...indices) : 0,
      lineEnd: indices.length ? Math.max(...indices) + 1 : 0,
      markdown: ruling.markdown,
      detectionMethod: "lines",
    });
  }

  merged.sort((a, b) => a.lineStart - b.lineStart);
  return merged;
}

/**
 * @param {{ str?: string, transform?: number[], height?: number, fontName?: string, width?: number }[]} items
 * @returns {{ y: number, x: number, text: string, fontSize: number, fontWeight: number|"bold"|"normal", height: number }[]}
 */
function itemsToGlyphs(items) {
  /** @type {{ y: number, x: number, text: string, fontSize: number, fontWeight: number|"bold"|"normal", height: number }[]} */
  const glyphs = [];
  for (const item of items || []) {
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
  return glyphs;
}

function isLikelyPdfFooterLine(cells, pageWidth) {
  if (!cells?.length) return true;
  const texts = cells.map((c) => String(c.text || "").trim()).filter(Boolean);
  if (!texts.length) return true;
  if (texts.length <= 2 && texts.every((t) => /^\d{1,3}$/.test(t))) return true;
  if (
    texts.length <= 2 &&
    cells.every((c) => c.startX > pageWidth * 0.62) &&
    texts.every((t) => /^\d/.test(t))
  ) {
    return true;
  }
  return false;
}

/**
 * Detect consecutive aligned rows and return markdown table segments.
 * @param {{ y: number, parts: { x: number, text: string, fontSize: number }[] }[]} lines
 * @param {number} [pageWidth]
 * @returns {{ type: "line", lineIndex: number } | { type: "table", lineStart: number, lineEnd: number, markdown: string }}[]}
 */
export function segmentLinesForTables(lines, pageWidth = 612) {
  if (!lines?.length) return [];

  /** @type {Array<{ type: "line", lineIndex: number } | { type: "table", lineStart: number, lineEnd: number, markdown: string }>} */
  const segments = [];
  let i = 0;

  while (i < lines.length) {
    const seedCells = mergeLinePartsIntoCells(lines[i].parts);
    if (seedCells.length < PDF_TABLE_MIN_COLUMNS) {
      segments.push({ type: "line", lineIndex: i });
      i += 1;
      continue;
    }

    let j = i + 1;
    /** @type {PdfTableCell[][]} */
    let cellsList = [seedCells];

    while (j < lines.length) {
      const nextCells = mergeLinePartsIntoCells(lines[j].parts);
      if (isLikelyPdfFooterLine(nextCells, pageWidth)) {
        j += 1;
        continue;
      }
      const anchors = deriveColumnAnchors(cellsList);
      if (!rowMatchesColumnAnchors(nextCells, anchors)) break;
      cellsList.push(nextCells);
      j += 1;
    }

    if (cellsList.length >= PDF_TABLE_MIN_ROWS) {
      const anchors = deriveColumnAnchors(cellsList);
      const grid = cellsList.map((cells) => assignCellsToAnchors(cells, anchors));
      if (
        blockMatchesTableAnchors(cellsList, anchors) &&
        validateTableGrid(grid, anchors, pageWidth)
      ) {
        const markdown = gridToMarkdownTable(grid);
        if (markdown) {
          segments.push({ type: "table", lineStart: i, lineEnd: j, markdown });
          i = j;
          continue;
        }
      }
    }

    segments.push({ type: "line", lineIndex: i });
    i += 1;
  }

  return segments;
}

/**
 * Cluster glyphs into lines without converting to blocks.
 * @param {{ y: number, x: number, text: string, fontSize: number, fontWeight: number|"bold"|"normal", height: number }[]} glyphs
 */
function clusterGlyphsIntoLines(glyphs) {
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
  for (const line of lines) {
    line.parts.sort((a, b) => a.x - b.x);
  }
  return lines;
}

/**
 * @param {{ y: number, x: number, text: string, fontSize: number, fontWeight: number|"bold"|"normal", height: number }[]} glyphs
 * @param {number} pageIndex
 * @param {number} [pageHeight]
 * @param {number} [pageWidth]
 * @param {import("./pdf-ruling-lines.js").RulingLineTable[]} [rulingTables]
 * @param {number} [pageNum]
 * @param {Array<{ page: number, method: PdfTableDetectionMethod, preview: string }>} [detectionLog]
 * @returns {{ blocks: TextBlock[], tablesDetected: number }}
 */
function buildBlocksFromGlyphs(
  glyphs,
  pageIndex,
  pageHeight = 792,
  pageWidth = 612,
  rulingTables = [],
  pageNum = 0,
  detectionLog = null,
) {
  if (!glyphs.length) return { blocks: [], tablesDetected: 0 };

  const lines = clusterGlyphsIntoLines(glyphs);
  const rawSegments = segmentLinesForTables(lines, pageWidth);
  const alignmentTables = rawSegments.filter((s) => s.type === "table");
  const mergedTables = mergeTableDetections(alignmentTables, rulingTables, lines);

  const consumedLines = new Set();
  for (const table of mergedTables) {
    for (let i = table.lineStart; i < table.lineEnd; i += 1) consumedLines.add(i);
    if (detectionLog) {
      detectionLog.push({
        page: pageNum,
        method: table.detectionMethod,
        preview: table.markdown.split("\n")[0]?.slice(0, 80) || "",
      });
    }
  }

  /** @type {Array<{ type: "table", lineStart: number, lineEnd: number, markdown: string } | { type: "line", lineIndex: number }>} */
  const segments = mergedTables.map((t) => ({
    type: /** @type {const} */ ("table"),
    lineStart: t.lineStart,
    lineEnd: t.lineEnd,
    markdown: t.markdown,
  }));
  for (const seg of rawSegments) {
    if (seg.type === "line" && !consumedLines.has(seg.lineIndex)) {
      segments.push(seg);
    }
  }
  segments.sort((a, b) => {
    const ai = a.type === "table" ? a.lineStart : a.lineIndex;
    const bi = b.type === "table" ? b.lineStart : b.lineIndex;
    return ai - bi;
  });

  /** @type {TextBlock[]} */
  const blocks = [];
  let tablesDetected = 0;
  let lineCounter = 0;

  for (const segment of segments) {
    if (segment.type === "table") {
      tablesDetected += 1;
      blocks.push(
        createTextBlock({
          text: segment.markdown,
          fontSize: 0,
          fontWeight: "normal",
          pageIndex,
          lineIndex: lineCounter,
          source: "pdf",
          kind: "paragraph",
        }),
      );
      lineCounter += 1;
      continue;
    }

    const line = lines[segment.lineIndex];
    const text = line.parts
      .map((p) => p.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const maxFont = Math.max(...line.parts.map((p) => p.fontSize));
    const hasBold = line.parts.some((p) => p.fontWeight === "bold");
    const minX = Math.min(...line.parts.map((p) => p.x));
    const maxX = Math.max(
      ...line.parts.map((p) => p.x + p.text.length * maxFont * 0.5),
    );
    blocks.push(
      createTextBlock({
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
        lineIndex: lineCounter,
        source: "pdf",
        kind: "paragraph",
      }),
    );
    lineCounter += 1;
  }

  void pageHeight;
  return { blocks, tablesDetected };
}

/**
 * @param {{ str?: string, transform?: number[], height?: number, fontName?: string, width?: number }[]} items
 * @param {number} pageIndex
 * @param {number} [pageHeight]
 * @param {number} [pageWidth]
 * @returns {{ blocks: TextBlock[], tablesDetected: number }}
 */
export function clusterTextItemsToBlocks(items, pageIndex, pageHeight = 792, pageWidth = 612) {
  const glyphs = itemsToGlyphs(items);
  return buildBlocksFromGlyphs(glyphs, pageIndex, pageHeight, pageWidth);
}

/**
 * @param {object} content pdf.js getTextContent result
 * @param {object} page pdf.js page
 * @param {object} pdfjs
 * @param {number} pageIndex
 * @param {{ width: number, height: number }} viewport
 * @param {number} pageNum 1-based page number for logging
 */
async function buildPageBlocksFromContent(content, page, pdfjs, pageIndex, viewport, pageNum) {
  const glyphs = itemsToGlyphs(content.items);
  const layout = detectColumnLayout(glyphs, viewport.width);
  /** @type {typeof glyphs[]} */
  const groups = layout
    ? [glyphs.filter((g) => g.x < layout.splitX), glyphs.filter((g) => g.x >= layout.splitX)]
    : [glyphs];

  /** @type {TextBlock[]} */
  const blocks = [];
  let tablesDetected = 0;
  /** @type {Array<{ page: number, method: PdfTableDetectionMethod, preview: string }>} */
  const detectionLog = [];

  for (const groupGlyphs of groups) {
    const rulingTables = await detectTablesFromRulingLines(page, pdfjs, groupGlyphs, viewport);
    const built = buildBlocksFromGlyphs(
      groupGlyphs,
      pageIndex,
      viewport.height,
      viewport.width,
      rulingTables,
      pageNum,
      detectionLog,
    );
    blocks.push(...built.blocks);
    tablesDetected += built.tablesDetected;
  }

  return { blocks, tablesDetected, detectionLog };
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

    const clustered = await buildPageBlocksFromContent(
      content,
      page,
      pdfjs,
      pageNum - 1,
      viewport,
      pageNum,
    );
    let pageBlocks = clustered.blocks;
    const pageTablesDetected = clustered.tablesDetected;

    if (pageTablesDetected > 0) {
      const bagTables = dppNormDbg();
      if (bagTables) {
        bagTables.tablesDetected = (bagTables.tablesDetected || 0) + pageTablesDetected;
        bagTables.tablesEmittedOk = 0;
        if (!Array.isArray(bagTables.pdfTableDetectionLog)) {
          bagTables.pdfTableDetectionLog = [];
        }
        bagTables.pdfTableDetectionLog.push(...clustered.detectionLog);
      }
    }

    let pageText = pageBlocks.map((b) => b.text).join(" ");
    let pageChars = pageText.length;

    if (pageChars < LOW_EXTRACTION_PAGE_CHARS && hasPlatformLlmAccess()) {
      try {
        const rendered = await renderPageFallback(page);
        if (rendered?.bytes) {
          const visionText = await extractPageTextWithVision(
            rendered.bytes,
            rendered.mimeType || "image/png",
            { pageNum },
          );
          if (visionText && visionText.length >= LOW_EXTRACTION_PAGE_CHARS) {
            pageBlocks = [
              createTextBlock({
                text: visionText,
                fontSize: 0,
                fontWeight: "normal",
                pageIndex: pageNum - 1,
                lineIndex: 0,
                source: "pdf",
                kind: "paragraph",
              }),
            ];
            extractionPath = "vision-fallback";
            pageText = visionText;
            pageChars = visionText.length;
            const bagVision = dppNormDbg();
            if (bagVision) {
              bagVision.visionFallbackPages = Array.isArray(bagVision.visionFallbackPages)
                ? bagVision.visionFallbackPages
                : [];
              bagVision.visionFallbackPages.push(pageNum);
            }
          }
        }
      } catch (err) {
        console.debug("[extract-pdf-blocks.extractPdfBlocks] Vision fallback failed:", {
          pageNum,
          message: err?.message || String(err),
        });
      }
    }

    blocks.push(...pageBlocks);

    const pageWords = countWords(pageText);
    console.debug("[extract-pdf-blocks.extractPdfBlocks] Page extracted:", {
      pageNum,
      charCount: pageChars,
      wordCount: pageWords,
      blockCount: pageBlocks.length,
      extractionPath,
    });
    if (pageChars < LOW_EXTRACTION_PAGE_CHARS) {
      console.debug("[extract-pdf-blocks.extractPdfBlocks] Low extraction page:", {
        pageNum,
        charCount: pageChars,
        threshold: LOW_EXTRACTION_PAGE_CHARS,
        extractionPath,
      });
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

  /** @type {Map<number, number>} */
  const pageCharTotals = new Map();
  for (const block of blocks) {
    const pageIndex = Number(block.pageIndex) || 0;
    pageCharTotals.set(
      pageIndex,
      (pageCharTotals.get(pageIndex) || 0) + String(block.text || "").length,
    );
  }
  /** @type {number[]} */
  const lowExtractionPagesAfterVision = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const chars = pageCharTotals.get(pageNum - 1) || 0;
    if (chars < LOW_EXTRACTION_PAGE_CHARS) lowExtractionPagesAfterVision.push(pageNum);
  }

  const bagFinal = dppNormDbg();
  if (bagFinal) {
    bagFinal.lowExtractionPagesAfterVision = lowExtractionPagesAfterVision;
  }

  console.info("[extract-pdf-blocks.extractPdfBlocks] Document extraction summary:", {
    totalPages: doc.numPages,
    totalBlocks: blocks.length,
    lowExtractionPages: dppNormDbg()?.lowExtractionPages?.length ?? 0,
    lowExtractionPagesAfterVision: lowExtractionPagesAfterVision.length,
    visionFallbackPages: dppNormDbg()?.visionFallbackPages?.length ?? 0,
  });

  const mergedBlocks = mergeCrossPageContinuationTables(blocks);
  if (mergedBlocks.length !== blocks.length) {
    console.debug("[extract-pdf-blocks.extractPdfBlocks] Cross-page table merge:", {
      blocksBefore: blocks.length,
      blocksAfter: mergedBlocks.length,
    });
  }

  return { blocks: mergedBlocks, pageHeights, doc };
}

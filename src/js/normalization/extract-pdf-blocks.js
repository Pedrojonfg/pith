/**
 * PDF block extraction via pdf.js getTextContent (research R4).
 */

import { createTextBlock } from "./types.js";
import { loadPdfJs } from "./pdf-loader.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */

const Y_TOLERANCE = 2;

/**
 * @param {number[]} transform
 */
export function fontHeightFromTransform(transform) {
  const c = transform?.[2] ?? 0;
  const d = transform?.[3] ?? 0;
  return Math.hypot(c, d);
}

/**
 * @param {{ str?: string, transform?: number[], height?: number, fontName?: string, width?: number }[]} items
 * @param {number} pageIndex
 * @param {number} [pageHeight]
 * @returns {TextBlock[]}
 */
export function clusterTextItemsToBlocks(items, pageIndex, pageHeight = 792) {
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

  return lines.map((line, lineIndex) => {
    line.parts.sort((a, b) => a.x - b.x);
    const text = line.parts.map((p) => p.text).join(" ").replace(/\s+/g, " ").trim();
    const maxFont = Math.max(...line.parts.map((p) => p.fontSize));
    const hasBold = line.parts.some((p) => p.fontWeight === "bold");
    const minX = Math.min(...line.parts.map((p) => p.x));
    const maxX = Math.max(...line.parts.map((p) => p.x + (p.text.length * maxFont * 0.5)));
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
  }).filter((b) => b.text.trim());
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
    const pageBlocks = clusterTextItemsToBlocks(content.items, pageNum - 1, viewport.height);
    blocks.push(...pageBlocks);
  }

  return { blocks, pageHeights, doc };
}

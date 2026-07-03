/**
 * PDF ruling-line extraction and lattice/h-rule table detection (R1.2b).
 * Complements column-alignment detection in extract-pdf-blocks.js.
 */

import { gridToMarkdownTable } from "./table-markdown.js";
import {
  PDF_TABLE_MIN_COLUMNS,
  PDF_TABLE_MIN_ROWS,
  PDF_TABLE_X_TOLERANCE,
  mergeLinePartsIntoCells,
  deriveColumnAnchors,
  assignCellsToAnchors,
  validateTableGrid,
  blockMatchesTableAnchors,
  PDF_TABLE_MAX_COLUMNS_RULING,
} from "./pdf-table-constants.js";

/** @typedef {'lines'|'alignment'|'both'} PdfTableDetectionMethod */

/** [placeholder — calibrate] max drift when clustering parallel ruling lines */
const PDF_RULE_X_CLUSTER_TOLERANCE = 15;

/** [placeholder — calibrate] min width of a ruling-line cluster as fraction of page width */
const PDF_RULE_MIN_CLUSTER_WIDTH_RATIO = 0.35;

/** [placeholder — calibrate] min horizontal ruling lines in one table cluster */
const PDF_RULE_MIN_HORIZONTAL_LINES = 3;

/** [placeholder — calibrate] min vertical ruling lines for strict lattice mode */
const PDF_RULE_MIN_VERTICAL_LINES = 2;

/** [placeholder — calibrate] min average chars per row band (excludes diagram labels) */
const PDF_RULE_MIN_AVG_BAND_CHARS = 12;

/**
 * @typedef {{ type: 'h'|'v', y?: number, x?: number, x1?: number, x2?: number, y1?: number, y2?: number }} RulingSegment
 */

/**
 * @typedef {Object} RulingLineTable
 * @property {string} markdown
 * @property {PdfTableDetectionMethod} detectionMethod
 * @property {number} yTop
 * @property {number} yBottom
 * @property {number} xLeft
 * @property {number} xRight
 */

function mulCtm(m, x, y) {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/**
 * @param {object} page
 * @param {object} pdfjs
 * @returns {Promise<RulingSegment[]>}
 */
export async function extractStrokedRulingSegments(page, pdfjs) {
  const ops = await page.getOperatorList();
  const OPS = pdfjs.OPS || {};
  const fnArray = ops?.fnArray || [];
  const argsArray = ops?.argsArray || [];
  /** @type {number[][]} */
  const stack = [[1, 0, 0, 1, 0, 0]];
  let ctm = stack[stack.length - 1];
  /** @type {RulingSegment[]} */
  const segments = [];

  const emit = (x1, y1, x2, y2) => {
    const p1 = mulCtm(ctm, x1, y1);
    const p2 = mulCtm(ctm, x2, y2);
    const dx = Math.abs(p1.x - p2.x);
    const dy = Math.abs(p1.y - p2.y);
    if (dx < 1 && dy < 1) return;
    if (dy <= 1.5 && dx > 20) {
      segments.push({
        type: "h",
        y: (p1.y + p2.y) / 2,
        x1: Math.min(p1.x, p2.x),
        x2: Math.max(p1.x, p2.x),
      });
    } else if (dx <= 1.5 && dy > 20) {
      segments.push({
        type: "v",
        x: (p1.x + p2.x) / 2,
        y1: Math.min(p1.y, p2.y),
        y2: Math.max(p1.y, p2.y),
      });
    }
  };

  for (let i = 0; i < fnArray.length; i += 1) {
    const fn = fnArray[i];
    const args = argsArray[i];
    if (fn === OPS.save) {
      stack.push([...ctm]);
    } else if (fn === OPS.restore) {
      stack.pop();
      ctm = stack[stack.length - 1] || [1, 0, 0, 1, 0, 0];
    } else if (fn === OPS.transform) {
      const [a, b, c, d, e, f] = args;
      const [m0, m1, m2, m3, m4, m5] = ctm;
      ctm = [
        m0 * a + m2 * b,
        m1 * a + m3 * b,
        m0 * c + m2 * d,
        m1 * c + m3 * d,
        m0 * e + m2 * f + m4,
        m1 * e + m3 * f + m5,
      ];
      stack[stack.length - 1] = ctm;
    } else if (fn === OPS.constructPath) {
      const [pathOps, coords] = args;
      let ci = 0;
      let mx = 0;
      let my = 0;
      let sx = 0;
      let sy = 0;
      for (const op of pathOps) {
        if (op === OPS.rect) {
          const x = coords[ci++];
          const y = coords[ci++];
          const w = coords[ci++];
          const h = coords[ci++];
          emit(x, y, x + w, y);
          emit(x, y + h, x + w, y + h);
          emit(x, y, x, y + h);
          emit(x + w, y, x + w, y + h);
        } else if (op === OPS.moveTo) {
          mx = coords[ci++];
          my = coords[ci++];
          sx = mx;
          sy = my;
        } else if (op === OPS.lineTo) {
          const lx = coords[ci++];
          const ly = coords[ci++];
          emit(mx, my, lx, ly);
          mx = lx;
          my = ly;
        } else if (op === OPS.closePath) {
          emit(mx, my, sx, sy);
          mx = sx;
          my = sy;
        }
      }
    }
  }

  return segments;
}

/**
 * @param {RulingSegment[]} segments
 * @param {number} pageWidth
 */
function clusterHorizontalRulingLines(segments, pageWidth) {
  const hLines = segments.filter((s) => s.type === "h" && s.x1 != null && s.x2 != null);
  /** @type {{ x1: number, x2: number, lines: { y: number, x1: number, x2: number }[] }[]} */
  const clusters = [];

  for (const seg of hLines) {
    const span = (seg.x2 ?? 0) - (seg.x1 ?? 0);
    if (pageWidth > 0 && span / pageWidth < PDF_RULE_MIN_CLUSTER_WIDTH_RATIO) continue;

    let cluster = clusters.find(
      (c) =>
        Math.abs(c.x1 - (seg.x1 ?? 0)) <= PDF_RULE_X_CLUSTER_TOLERANCE &&
        Math.abs(c.x2 - (seg.x2 ?? 0)) <= PDF_RULE_X_CLUSTER_TOLERANCE,
    );
    if (!cluster) {
      cluster = { x1: seg.x1 ?? 0, x2: seg.x2 ?? 0, lines: [] };
      clusters.push(cluster);
    }
    cluster.lines.push({ y: seg.y ?? 0, x1: seg.x1 ?? 0, x2: seg.x2 ?? 0 });
  }

  return clusters.filter((c) => c.lines.length >= PDF_RULE_MIN_HORIZONTAL_LINES);
}

/**
 * @param {RulingSegment[]} segments
 * @param {number} yTop
 * @param {number} yBottom
 * @param {number} xLeft
 * @param {number} xRight
 */
function verticalLinesInRegion(segments, yTop, yBottom, xLeft, xRight) {
  const yMin = Math.min(yTop, yBottom);
  const yMax = Math.max(yTop, yBottom);
  /** @type {number[]} */
  const xs = [];
  for (const seg of segments) {
    if (seg.type !== "v") continue;
    const x = seg.x ?? 0;
    const y1 = seg.y1 ?? 0;
    const y2 = seg.y2 ?? 0;
    if (x < xLeft - 5 || x > xRight + 5) continue;
    if (y2 < yMin || y1 > yMax) continue;
    if (!xs.some((existing) => Math.abs(existing - x) <= PDF_TABLE_X_TOLERANCE)) {
      xs.push(x);
    }
  }
  xs.sort((a, b) => a - b);
  return xs;
}

/**
 * @param {{ y: number, x: number, text: string, fontSize: number }[]} glyphs
 * @param {number} yTop
 * @param {number} yBottom
 */
function glyphsInBand(glyphs, yTop, yBottom) {
  const yHi = Math.max(yTop, yBottom);
  const yLo = Math.min(yTop, yBottom);
  return glyphs.filter((g) => g.y <= yHi && g.y >= yLo);
}

/**
 * @param {{ y: number, x: number, text: string, fontSize: number }[]} bandGlyphs
 */
function bandGlyphsToRowCells(bandGlyphs) {
  if (!bandGlyphs.length) return [];
  const byLine = new Map();
  for (const g of bandGlyphs) {
    const key = Math.round(g.y / 2) * 2;
    if (!byLine.has(key)) byLine.set(key, []);
    byLine.get(key).push(g);
  }
  /** @type {import("./pdf-table-constants.js").PdfTableCell[]} */
  let best = [];
  for (const parts of byLine.values()) {
    const cells = mergeLinePartsIntoCells(parts);
    if (cells.length > best.length) best = cells;
  }
  return best;
}

/**
 * @param {string[][]} grid
 */
function isLikelyDiagramGrid(grid) {
  const nonEmpty = grid.flat().filter((c) => String(c || "").trim());
  if (!nonEmpty.length) return true;
  const lengths = nonEmpty.map((c) => String(c).trim().length);
  const maxLen = Math.max(...lengths);
  if (maxLen >= 20) return false;

  const avgLen = lengths.reduce((s, n) => s + n, 0) / lengths.length;
  const shortCells = lengths.filter((n) => n <= 3).length;
  if (avgLen < PDF_RULE_MIN_AVG_BAND_CHARS && shortCells / nonEmpty.length > 0.75) {
    return true;
  }
  return false;
}

function dedupeHorizontalLines(lines) {
  const sorted = [...lines].sort((a, b) => b.y - a.y);
  /** @type {{ y: number, x1?: number, x2?: number }[]} */
  const out = [];
  for (const line of sorted) {
    if (out.length && Math.abs(out[out.length - 1].y - line.y) <= 2) continue;
    out.push(line);
  }
  return out;
}

/**
 * @param {{ lines: { y: number }[], x1: number, x2: number }} cluster
 * @param {RulingSegment[]} segments
 * @param {{ y: number, x: number, text: string, fontSize: number }[]} glyphs
 * @param {number} pageWidth
 * @returns {RulingLineTable|null}
 */
function tableFromHorizontalCluster(cluster, segments, glyphs, pageWidth) {
  const sorted = dedupeHorizontalLines(cluster.lines);
  if (sorted.length < PDF_RULE_MIN_HORIZONTAL_LINES) return null;
  const yTop = sorted[0].y;
  const yBottom = sorted[sorted.length - 1].y;
  const xLeft = cluster.x1;
  const xRight = cluster.x2;

  const vAnchors = verticalLinesInRegion(segments, yTop, yBottom, xLeft, xRight);
  const hasLattice = vAnchors.length >= PDF_RULE_MIN_VERTICAL_LINES;

  /** @type {import("./pdf-table-constants.js").PdfTableCell[][]} */
  const cellsList = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const bandGlyphs = glyphsInBand(glyphs, sorted[i].y, sorted[i + 1].y).filter(
      (g) => g.x >= xLeft - 10 && g.x <= xRight + 10,
    );
    const rowCells = bandGlyphsToRowCells(bandGlyphs);
    if (rowCells.length) cellsList.push(rowCells);
  }

  if (cellsList.length < PDF_TABLE_MIN_ROWS) return null;

  const anchors = hasLattice ? vAnchors : deriveColumnAnchors(cellsList);
  if (anchors.length < PDF_TABLE_MIN_COLUMNS) return null;
  if (!blockMatchesTableAnchors(cellsList, anchors)) return null;

  const grid = cellsList.map((cells) => assignCellsToAnchors(cells, anchors));
  if (!validateTableGrid(grid, anchors, pageWidth, { maxColumns: PDF_TABLE_MAX_COLUMNS_RULING })) {
    return null;
  }
  if (isLikelyDiagramGrid(grid)) return null;

  const markdown = gridToMarkdownTable(grid);
  if (!markdown) return null;

  return {
    markdown,
    detectionMethod: /** @type {PdfTableDetectionMethod} */ ("lines"),
    yTop,
    yBottom,
    xLeft,
    xRight,
  };
}

/**
 * @param {object} page
 * @param {object} pdfjs
 * @param {{ y: number, x: number, text: string, fontSize: number }[]} glyphs
 * @param {{ width: number, height: number }} viewport
 * @returns {Promise<RulingLineTable[]>}
 */
export async function detectTablesFromRulingLines(page, pdfjs, glyphs, viewport) {
  const segments = await extractStrokedRulingSegments(page, pdfjs);
  const clusters = clusterHorizontalRulingLines(segments, viewport.width);
  /** @type {RulingLineTable[]} */
  const tables = [];

  for (const cluster of clusters) {
    const table = tableFromHorizontalCluster(cluster, segments, glyphs, viewport.width);
    if (table) tables.push(table);
  }

  return tables;
}

/** @internal test helper */
export function debugRulingClusters(segments, pageWidth) {
  return clusterHorizontalRulingLines(segments, pageWidth);
}

/**
 * @param {{ y: number, parts: unknown[] }[]} lines
 * @param {number} yTop
 * @param {number} yBottom
 */
export function lineIndicesInYRange(lines, yTop, yBottom) {
  const yHi = Math.max(yTop, yBottom);
  const yLo = Math.min(yTop, yBottom);
  /** @type {number[]} */
  const indices = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].y <= yHi && lines[i].y >= yLo) indices.push(i);
  }
  return indices;
}

/**
 * @param {RulingLineTable} ruling
 * @param {{ lineStart: number, lineEnd: number }} alignment
 * @param {{ y: number }[]} lines
 */
export function rulingTableOverlapsAlignment(ruling, alignment, lines) {
  const rulingIndices = new Set(lineIndicesInYRange(lines, ruling.yTop, ruling.yBottom));
  for (let i = alignment.lineStart; i < alignment.lineEnd; i += 1) {
    if (rulingIndices.has(i)) return true;
  }
  return false;
}

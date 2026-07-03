/**
 * Shared PDF table detection thresholds and validators (T02b + T02c).
 */

/** [placeholder — calibrate] max start-x drift between aligned columns */
export const PDF_TABLE_X_TOLERANCE = 8;

/** [placeholder — calibrate] minimum columns for a table candidate */
export const PDF_TABLE_MIN_COLUMNS = 3;

/** [placeholder — calibrate] minimum consecutive aligned rows */
export const PDF_TABLE_MIN_ROWS = 3;

/** [placeholder — calibrate] merge text runs within this gap into one cell */
export const PDF_TABLE_CELL_GAP = 6;

/** [placeholder — calibrate] reject tables whose longest cell is shorter than this */
export const PDF_TABLE_MIN_MAX_CELL_CHARS = 8;

/** [placeholder — calibrate] minimum non-empty cell ratio in the grid */
export const PDF_TABLE_MIN_FILL_RATIO = 0.45;

/** [placeholder — calibrate] max column anchors per table */
export const PDF_TABLE_MAX_COLUMNS = 8;

/** [placeholder — calibrate] max columns for ruling-line tables (wide LaTeX tables) */
export const PDF_TABLE_MAX_COLUMNS_RULING = 14;

/** [placeholder — calibrate] max x-span of column anchors as fraction of page width */
export const PDF_TABLE_MAX_ANCHOR_SPAN_RATIO = 0.72;

/** [placeholder — calibrate] max words in any single table cell */
export const PDF_TABLE_MAX_CELL_WORDS = 8;

/** @typedef {{ startX: number, endX: number, text: string }} PdfTableCell */

/**
 * @param {{ x: number, text: string, fontSize: number }[]} parts
 * @returns {PdfTableCell[]}
 */
export function mergeLinePartsIntoCells(parts) {
  if (!parts?.length) return [];
  const sorted = [...parts].sort((a, b) => a.x - b.x);
  /** @type {PdfTableCell[]} */
  const cells = [];

  for (const part of sorted) {
    const text = String(part.text || "").trim();
    if (!text) continue;
    const fontSize = Number(part.fontSize) || 10;
    const approxEnd = part.x + Math.max(text.length * fontSize * 0.45, fontSize);

    const last = cells[cells.length - 1];
    if (last && part.x - last.endX <= PDF_TABLE_CELL_GAP) {
      last.text = `${last.text} ${text}`.replace(/\s+/g, " ").trim();
      last.endX = Math.max(last.endX, approxEnd);
      continue;
    }

    cells.push({ startX: part.x, endX: approxEnd, text });
  }

  return cells;
}

/**
 * @param {PdfTableCell[][]} cellsList
 * @param {number} [tolerance]
 * @returns {number[]}
 */
export function deriveColumnAnchors(cellsList, tolerance = PDF_TABLE_X_TOLERANCE) {
  if (!cellsList?.length) return [];
  if (cellsList.length === 1) {
    return cellsList[0].map((cell) => cell.startX);
  }

  /** @type {number[]} */
  const anchors = [];
  for (const cells of cellsList) {
    for (const cell of cells) {
      const near = anchors.find((a) => Math.abs(a - cell.startX) <= tolerance);
      if (near !== undefined) {
        const idx = anchors.indexOf(near);
        anchors[idx] = (anchors[idx] + cell.startX) / 2;
      } else {
        anchors.push(cell.startX);
      }
    }
  }

  anchors.sort((a, b) => a - b);
  const minHits = Math.max(2, Math.min(PDF_TABLE_MIN_ROWS, cellsList.length));
  return anchors.filter((anchor) => {
    let hits = 0;
    for (const cells of cellsList) {
      if (cells.some((c) => Math.abs(c.startX - anchor) <= tolerance)) hits += 1;
    }
    return hits >= minHits;
  });
}

/**
 * @param {PdfTableCell[]} cells
 * @param {number[]} anchors
 * @param {number} [tolerance]
 */
export function assignCellsToAnchors(cells, anchors, tolerance = PDF_TABLE_X_TOLERANCE) {
  const row = Array.from({ length: anchors.length }, () => "");
  const used = new Set();

  for (let j = 0; j < anchors.length; j += 1) {
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < cells.length; i += 1) {
      if (used.has(i)) continue;
      const dist = Math.abs(cells[i].startX - anchors[j]);
      if (dist <= tolerance && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      used.add(bestIdx);
      row[j] = cells[bestIdx].text;
    }
  }

  return row;
}

/**
 * @param {PdfTableCell[][]} cellsList
 * @param {number[]} anchors
 * @param {number} [tolerance]
 */
export function blockMatchesTableAnchors(cellsList, anchors, tolerance = PDF_TABLE_X_TOLERANCE) {
  if (!anchors?.length || cellsList.length < PDF_TABLE_MIN_ROWS) return false;

  let alignedRows = 0;
  for (const cells of cellsList) {
    let matched = 0;
    for (const anchor of anchors) {
      if (cells.some((c) => Math.abs(c.startX - anchor) <= tolerance)) matched += 1;
    }
    if (matched >= PDF_TABLE_MIN_COLUMNS) alignedRows += 1;
  }

  if (alignedRows < PDF_TABLE_MIN_ROWS) return false;

  const texts = cellsList.flatMap((cells) => cells.map((c) => c.text));
  const maxCellLen = texts.reduce((max, t) => Math.max(max, t.length), 0);
  return maxCellLen >= PDF_TABLE_MIN_MAX_CELL_CHARS;
}

/**
 * @param {string[][]} grid
 * @param {number[]} anchors
 * @param {number} [pageWidth]
 * @param {{ maxColumns?: number }} [opts]
 */
export function validateTableGrid(grid, anchors, pageWidth = 612, opts = {}) {
  const maxColumns = opts.maxColumns ?? PDF_TABLE_MAX_COLUMNS;
  if (!grid?.length || anchors.length < PDF_TABLE_MIN_COLUMNS) return false;
  if (anchors.length > maxColumns) return false;

  const span = Math.max(...anchors) - Math.min(...anchors);
  if (pageWidth > 0 && span / pageWidth > PDF_TABLE_MAX_ANCHOR_SPAN_RATIO) return false;

  const totalCells = grid.length * anchors.length;
  const filled = grid.reduce((n, row) => n + row.filter((c) => String(c || "").trim()).length, 0);
  if (totalCells > 0 && filled / totalCells < PDF_TABLE_MIN_FILL_RATIO) return false;

  const maxWords = grid.reduce((max, row) => {
    for (const cell of row) {
      const words = String(cell || "").trim().split(/\s+/).filter(Boolean).length;
      if (words > max) max = words;
    }
    return max;
  }, 0);
  if (maxWords > PDF_TABLE_MAX_CELL_WORDS) return false;

  const maxCellLen = grid
    .flat()
    .reduce((max, cell) => Math.max(max, String(cell || "").trim().length), 0);
  if (maxCellLen < PDF_TABLE_MIN_MAX_CELL_CHARS) return false;

  return true;
}

/**
 * @param {PdfTableCell[]} cells
 * @param {number[]} anchors
 * @param {number} [tolerance]
 */
export function rowMatchesColumnAnchors(cells, anchors, tolerance = PDF_TABLE_X_TOLERANCE) {
  if (!anchors?.length || cells.length < 1) return false;
  let matched = 0;
  for (const anchor of anchors) {
    if (cells.some((c) => Math.abs(c.startX - anchor) <= tolerance)) matched += 1;
  }
  return matched >= PDF_TABLE_MIN_COLUMNS;
}

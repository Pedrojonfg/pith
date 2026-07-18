/**
 * Shared markdown table formatting for HTML and PDF extraction paths.
 */

import { elementTextPreservingSubSup, flattenCitationSupMarkers } from "./heading-text.js";

/**
 * @param {string} text
 * @returns {string}
 */
export function escapeMarkdownTableCell(text) {
  return String(text || "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

/**
 * @param {string[][]} grid — first row treated as header
 * @returns {string|null}
 */
export function gridToMarkdownTable(grid) {
  if (!Array.isArray(grid) || !grid.length) return null;

  const rows = grid
    .map((row) => (Array.isArray(row) ? row.map((c) => escapeMarkdownTableCell(c)) : []))
    .filter((row) => row.length > 0);
  if (!rows.length) return null;

  // Empty cells must not be space/nbsp-only: scanners treat `|  |` / `|   |` as GFM
  // separator rows because `\s` eats NBSP and `[-: ]` still matches surrounding spaces.
  // Use ZWNJ (not whitespace) so empty body rows stay data rows.
  const cellOrPlaceholder = (value) => {
    const t = String(value || "");
    return t.trim().length ? t : "\u200c";
  };

  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const header = Array.from({ length: colCount }, (_, i) => cellOrPlaceholder(rows[0][i]));
  const sep = Array.from({ length: colCount }, () => "---");
  const body = rows
    .slice(1)
    .map((r) => Array.from({ length: colCount }, (_, i) => cellOrPlaceholder(r[i])));

  const lines = [];
  lines.push(`| ${header.join(" | ")} |`);
  lines.push(`| ${sep.join(" | ")} |`);
  for (const r of body) {
    lines.push(`| ${r.join(" | ")} |`);
  }
  return lines.join("\n");
}

/**
 * @param {number} rows
 * @param {number} cols
 * @returns {string}
 */
export function tableConversionFallbackLabel(rows, cols) {
  return `[Table: could not convert — ${rows} rows, ${cols} cols]`;
}

/**
 * @param {Element} tableEl
 * @returns {boolean}
 */
export function isPresentationTable(tableEl) {
  if (!tableEl || tableEl.nodeType !== 1) return false;
  if (String(tableEl.getAttribute("role") || "").toLowerCase() === "presentation") return true;
  const cls = String(tableEl.className || "");
  if (
    /\b(navbox|vertical-navbox|sistersitebox|infobox|mbox-small|navbox-inner|metadata|ambox|sidebar)\b/i.test(
      cls,
    )
  ) {
    return true;
  }
  if (tableEl.closest?.(".navbox, .vertical-navbox, .sistersitebox, .infobox")) return true;
  const summary = String(tableEl.getAttribute("summary") || "");
  if (/layout|navigation|presentation/i.test(summary)) return true;
  return false;
}

/**
 * @param {Element} tableEl
 * @returns {string|null}
 */
export function htmlTableToMarkdown(tableEl) {
  if (isPresentationTable(tableEl)) return null;
  const nested = tableEl.querySelector("table");
  if (nested && nested !== tableEl) {
    const rows = tableEl.querySelectorAll("tr").length;
    const cols = Math.max(
      0,
      ...Array.from(tableEl.querySelectorAll("tr")).map((tr) => tr.querySelectorAll("th,td").length),
    );
    console.warn("[table-markdown.htmlTableToMarkdown] nested table — using fallback label");
    return tableConversionFallbackLabel(rows, cols);
  }

  const rows = Array.from(
    tableEl.querySelectorAll(":scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr"),
  );
  if (!rows.length) return null;

  /** @type {string[][]} */
  const grid = [];
  for (const tr of rows) {
    /** @type {string[]} */
    const cells = [];
    for (const cell of Array.from(tr.querySelectorAll("th,td"))) {
      const text = escapeMarkdownTableCell(
        elementTextPreservingSubSup(flattenCitationSupMarkers(cell)),
      );
      const colspan = Math.max(1, parseInt(cell.getAttribute("colspan") || "1", 10) || 1);
      const rowspan = Math.max(1, parseInt(cell.getAttribute("rowspan") || "1", 10) || 1);
      if (rowspan > 1) {
        console.warn("[table-markdown.htmlTableToMarkdown] rowspan simplified:", { rowspan, colspan });
      }
      if (colspan > 1) {
        console.warn("[table-markdown.htmlTableToMarkdown] colspan duplicated:", { rowspan, colspan });
      }
      for (let i = 0; i < colspan; i += 1) cells.push(text);
    }
    if (cells.length) grid.push(cells);
  }

  return gridToMarkdownTable(grid);
}

/**
 * Shared markdown table formatting for HTML and PDF extraction paths.
 */

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

  const colCount = Math.max(1, ...rows.map((r) => r.length));
  const header = Array.from({ length: colCount }, (_, i) => rows[0][i] || "");
  const sep = Array.from({ length: colCount }, () => "---");
  const body = rows.slice(1).map((r) => Array.from({ length: colCount }, (_, i) => r[i] || ""));

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
 * @returns {string|null}
 */
export function htmlTableToMarkdown(tableEl) {
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
      const text = escapeMarkdownTableCell(cell.textContent || "");
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

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

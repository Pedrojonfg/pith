/**
 * Emit html_min with <h1>–<h6> headings.
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * @param {TextBlock[]} blocks
 * @param {HeadingCandidate[]} headings
 * @returns {{ htmlMin: string, headings: HeadingCandidate[] }}
 */
export function emitHtmlMin(blocks, headings) {
  const headingByBlock = new Map(headings.map((h) => [h.blockId, h]));
  const parts = [];
  /** @type {HeadingCandidate[]} */
  const withOffsets = [];
  let offset = 0;

  const activeBlocks = blocks.filter((b) => b.kind !== "artifact" && b.text.trim());

  for (const block of activeBlocks) {
    const heading = headingByBlock.get(block.id);
    if (heading) {
      const tag = `h${heading.level}`;
      const inner = escapeHtml(heading.label);
      const chunk = `<${tag}>${inner}</${tag}>`;
      const start = offset;
      parts.push(chunk);
      offset += chunk.length;
      withOffsets.push({ ...heading, charStart: start, charEnd: offset });
    } else {
      const inner = escapeHtml(block.text.trim());
      const chunk = `<p>${inner}</p>`;
      parts.push(chunk);
      offset += chunk.length;
    }
  }

  const htmlMin = parts.join("");
  return { htmlMin, headings: withOffsets };
}

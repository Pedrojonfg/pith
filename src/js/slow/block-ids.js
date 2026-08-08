/**
 * Deterministic block splitting for scroll viewer + annotation migration.
 * Ids are positional (b0, b1, …), not content hashes — R-SCR-4.
 */

/** Block-level elements that receive data-block-id in the scroll viewer DOM. */
export const SCROLL_BLOCK_SELECTOR =
  "p, li, h1, h2, h3, h4, h5, h6, blockquote, table, pre, figure, hr";

/**
 * Assign deterministic data-block-id (b0, b1, …) to block-level descendants.
 * If none match, wraps existing content in a single b0 container.
 * @param {Element | null | undefined} root
 * @returns {{ blockId: string, el: Element }[]}
 */
export function assignBlockIdsToElement(root) {
  if (!root || typeof root.querySelectorAll !== "function") return [];

  const nodes = Array.from(root.querySelectorAll(SCROLL_BLOCK_SELECTOR));
  if (!nodes.length) {
    const hasContent = Boolean((root.textContent || "").trim() || root.childNodes.length);
    if (!hasContent) return [];
    const wrap = root.ownerDocument.createElement("div");
    while (root.firstChild) wrap.appendChild(root.firstChild);
    wrap.setAttribute("data-block-id", "b0");
    root.appendChild(wrap);
    return [{ blockId: "b0", el: wrap }];
  }

  const assigned = [];
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    const blockId = `b${i}`;
    el.setAttribute("data-block-id", blockId);
    assigned.push({ blockId, el });
  }
  return assigned;
}

/**
 * @param {string} text
 * @returns {{ blockId: string, text: string, charStart: number, charEnd: number }[]}
 */
export function splitTextIntoBlocks(text) {
  const raw = String(text ?? "");
  if (!raw.length) return [];

  const chunks = raw.split(/\n\n+/);
  const blocks = [];
  let offset = 0;
  let i = 0;

  for (let c = 0; c < chunks.length; c++) {
    const chunk = chunks[c];
    let full = chunk;
    if (c < chunks.length - 1) {
      const after = offset + chunk.length;
      const sep = raw.slice(after).match(/^\n\n+/)?.[0] || "";
      full = chunk + sep;
    }
    blocks.push({
      blockId: `b${i++}`,
      text: full,
      charStart: offset,
      charEnd: offset + full.length,
    });
    offset += full.length;
  }

  return blocks;
}

/**
 * @param {{ blockId: string, charStart: number, charEnd: number }[]} blocks
 * @param {number} charStart
 * @param {number} charEnd
 * @returns {{ blockId: string, charStart: number, charEnd: number } | null}
 */
export function resolveBlockOffset(blocks, charStart, charEnd) {
  const start = Math.max(0, Math.floor(Number(charStart) || 0));
  const end = Math.max(start, Math.floor(Number(charEnd) || start));
  const list = Array.isArray(blocks) ? blocks : [];
  const block = list.find((b) => start >= b.charStart && start < b.charEnd);
  if (!block) return null;
  if (end > block.charEnd) return null; // spans block boundary → unresolvable
  return {
    blockId: block.blockId,
    charStart: start - block.charStart,
    charEnd: end - block.charStart,
  };
}

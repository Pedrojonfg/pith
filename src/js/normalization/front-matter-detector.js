/**
 * Front matter page detection (FIX-02).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */

const SKIP_TITLES = /cubierta|portada|datos|sumario|contracubierta/i;

/**
 * @param {{ title: string, pageIndex: number }[]} outline
 */
export function getFrontMatterPageRange(outline) {
  const filtered = (outline || []).filter((e) => !SKIP_TITLES.test(String(e.title || "")));
  const sorted = [...filtered].sort((a, b) => a.pageIndex - b.pageIndex);
  const firstContentPage = sorted[0]?.pageIndex ?? 0;
  return { skip: Math.max(0, firstContentPage - 1), source: /** @type {const} */ ("outline") };
}

/**
 * @param {TextBlock[]} blocks
 * @param {number} totalPages
 */
export function detectFrontMatterPages(blocks, totalPages) {
  const pageCount = Math.max(1, totalPages);
  const maxScan = Math.min(14, pageCount - 1);
  let lastFrontMatterPage = -1;

  for (let page = 0; page <= maxScan; page += 1) {
    const pageBlocks = blocks.filter((b) => b.pageIndex === page && b.kind !== "artifact");
    const totalChars = pageBlocks.reduce((sum, b) => sum + String(b.text || "").length, 0);
    const shortBlocks = pageBlocks.filter((b) => String(b.text || "").trim().length < 20);
    const shortBlockRatio = pageBlocks.length ? shortBlocks.length / pageBlocks.length : 0;

    if (totalChars < 300 || shortBlockRatio > 0.6) {
      lastFrontMatterPage = page;
    } else {
      break;
    }
  }

  return Math.max(0, lastFrontMatterPage);
}

/**
 * PDF outline extraction and block matching (research R5).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

/**
 * @param {object} doc pdf.js document
 * @returns {Promise<{ title: string, pageIndex: number, level: number, children: object[] }[]>}
 */
export async function extractPdfOutline(doc) {
  let outline = null;
  try {
    outline = await doc.getOutline();
  } catch {
    return [];
  }
  if (!outline?.length) return [];

  /**
   * @param {object[]} items
   * @param {number} level
   */
  async function walk(items, level = 1) {
    /** @type {{ title: string, pageIndex: number, level: number, children: object[] }[]} */
    const result = [];
    for (const item of items) {
      const title = String(item?.title || "").trim();
      let pageIndex = 0;
      if (item?.dest) {
        pageIndex = await resolveDestPageIndex(doc, item.dest);
      }
      const children = item?.items?.length ? await walk(item.items, level + 1) : [];
      if (title) {
        result.push({ title, pageIndex, level: Math.min(level, 6), children });
      }
      result.push(...children);
    }
    return result;
  }

  return walk(outline, 1);
}

/**
 * @param {object} doc
 * @param {string|Array} dest
 */
async function resolveDestPageIndex(doc, dest) {
  try {
    let destRef = dest;
    if (typeof dest === "string") {
      destRef = await doc.getDestination(dest);
    }
    if (!destRef) return 0;
    const ref = Array.isArray(destRef) ? destRef[0] : destRef;
    const pageIndex = await doc.getPageIndex(ref);
    return Math.max(0, pageIndex);
  } catch {
    return 0;
  }
}

/**
 * @param {{ title: string, pageIndex: number, level: number }[]} outline
 * @param {TextBlock[]} blocks
 * @returns {HeadingCandidate[]}
 */
export function matchOutlineToBlocks(outline, blocks) {
  /** @type {HeadingCandidate[]} */
  const headings = [];

  for (const entry of outline) {
    const title = entry.title.trim();
    if (!title) continue;

    const pageBlocks = blocks.filter(
      (b) => b.pageIndex === entry.pageIndex && b.kind !== "artifact",
    );

    let best = null;
    let bestScore = 0;

    for (const block of pageBlocks) {
      const blockText = block.text.trim().toLowerCase();
      const target = title.toLowerCase();
      let score = 0;
      if (blockText === target) score = 100;
      else if (blockText.includes(target) || target.includes(blockText)) score = 80;
      else {
        const words = target.split(/\s+/).filter(Boolean);
        const matched = words.filter((w) => blockText.includes(w)).length;
        score = words.length ? Math.round((matched / words.length) * 60) : 0;
      }
      if (score > bestScore) {
        bestScore = score;
        best = block;
      }
    }

    if (best && bestScore >= 50) {
      headings.push({
        label: title,
        level: /** @type {1|2|3|4|5|6} */ (entry.level),
        score: 100,
        source: "outline",
        blockId: best.id,
        charStart: 0,
        charEnd: 0,
      });
    }
  }

  return headings;
}

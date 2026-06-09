/**
 * PDF outline extraction and block matching (research R5).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

/**
 * @param {string} str
 */
export function normalizeForComparison(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Encoding fixups for PDF custom font corruption (comparison only).
 * @param {string} str
 */
export function applyEncodingFixups(str) {
  return String(str || "")
    .replace(/(?<=\w)6(?=\w)/g, "o")
    .replace(/(?<=\w)0(?=\w)/g, "o")
    .replace(/(?<=\w)1(?=\w)/g, "i");
}

/**
 * @param {string} a
 * @param {string} b
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (a.includes(b) || b.includes(a)) return 80;
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = new Set(b.split(/\s+/).filter(Boolean));
  if (!wordsA.length) return 0;
  const matched = wordsA.filter((w) => wordsB.has(w)).length;
  return Math.round((matched / wordsA.length) * 60);
}

/**
 * @param {string} outlineTitle
 * @param {string} blockText
 */
export function matchScore(outlineTitle, blockText) {
  const normOutline = normalizeForComparison(outlineTitle);
  const normBlock = normalizeForComparison(applyEncodingFixups(blockText));
  return similarity(normOutline, normBlock);
}

/**
 * @param {string} outlineTitle
 * @param {string} blockText
 */
export function matchScoreFallback(outlineTitle, blockText) {
  const prefix = normalizeForComparison(outlineTitle).slice(0, 15);
  if (!prefix) return 0;
  const normBlock = normalizeForComparison(applyEncodingFixups(blockText));
  return normBlock.startsWith(prefix) ? 60 : 0;
}

/**
 * @param {HeadingCandidate[]} matches
 * @param {{ title: string }[]} outline
 */
export function computeOutlineCoverage(matches, outline) {
  const total = outline?.length || 0;
  if (!total) return 0;
  return matches.length / total;
}

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
      const blockText = block.text.trim();
      let score = matchScore(title, blockText);
      if (score < 50) {
        score = matchScoreFallback(title, blockText);
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
        score: bestScore,
        source: "outline",
        blockId: best.id,
        charStart: 0,
        charEnd: 0,
      });
    }
  }

  return headings;
}

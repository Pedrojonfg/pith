/**
 * PDF outline extraction and block matching (research R5).
 */

import { normalizeHeadingLabel, isValidPdfTopLevelLabel } from "./heading-text.js";
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
 * Prefer numbered block text over outline bookmark titles when they match.
 * @param {string} outlineTitle
 * @param {string} blockText
 */
export function resolveOutlineLabel(outlineTitle, blockText) {
  const block = String(blockText || "").trim();
  const title = String(outlineTitle || "").trim();
  if (/^\d+(\.\d+)*\.?\s+\S/.test(block)) return normalizeHeadingLabel(block);
  if (/^abstract$/i.test(block)) return normalizeHeadingLabel(block);
  const blockWords = block.split(/\s+/).filter(Boolean).length;
  const titleWords = title.split(/\s+/).filter(Boolean).length;
  if (
    block.length >= title.length + 2 &&
    matchScore(title, block) >= 50 &&
    blockWords <= titleWords + 2
  ) {
    return normalizeHeadingLabel(block);
  }
  return normalizeHeadingLabel(title);
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

/** Skip deep outline noise common in Word-exported style guides (100+ bookmark entries). */
const OUTLINE_L3_NOISE_PREFIX =
  /^(General Guidelines|Editing |Online |Printing |Binding |Legal |Trade |Journal |Book$|Chapter |Paper |Working |Report$|Online Sources|Author-Date|Official Names|Commonly Used|Body of the Report|End Matter|Report Finalizing|Appendix|Professional Versus|Abbreviations|Agency Address|Bulleted and Numbered|Compounding and Unit|Hyphens and Dashes)/i;

const OUTLINE_STRUCTURAL_L3 = new Set([
  "Disclaimer",
  "Title Page",
  "Acknowledgments",
  "Foreword",
  "Table of Contents",
  "List of Exhibits",
  "Headings",
  "Footnotes",
  "Fonts",
]);

const OUTLINE_L2_UNDER_GPO = new Set(["Capitalization", "Italics", "Numbers", "Punctuation"]);
const OUTLINE_L2_UNDER_CITATIONS = new Set(["References", "Authors"]);

/**
 * @param {{ title: string, pageIndex: number, level: number }[]} outline
 */
export function filterOutlineHeadings(outline) {
  if (!outline?.length || outline.length <= 40) return outline || [];

  /** @type {{ title: string, pageIndex: number, level: number }[]} */
  const filtered = [];
  for (const entry of outline) {
    const title = String(entry.title || "").trim();
    if (!title) continue;
    if (entry.level === 1) continue;
    if (entry.level === 4 && OUTLINE_STRUCTURAL_L3.has(title)) {
      filtered.push({ ...entry, level: 3 });
      continue;
    }
    if (entry.level >= 4) continue;
    if (entry.level === 2) {
      if (/^Appendix/i.test(title)) continue;
      filtered.push({
        ...entry,
        level:
          title === "Introduction" || /^[IVXLC]+\./.test(title)
            ? 1
            : Math.min(entry.level, 6),
      });
      continue;
    }
    if (entry.level === 3) {
      if (OUTLINE_STRUCTURAL_L3.has(title)) {
        filtered.push({ ...entry, level: 3 });
        continue;
      }
      if (OUTLINE_L2_UNDER_GPO.has(title) || OUTLINE_L2_UNDER_CITATIONS.has(title)) {
        filtered.push({ ...entry, level: 2 });
        continue;
      }
      if (!OUTLINE_L3_NOISE_PREFIX.test(title) && title.length <= 40) {
        const level =
          title === "Covers" || title === "Front Matter" || title === "Guidelines" ? 2 : entry.level;
        filtered.push({ ...entry, level });
      }
    }
  }
  return filtered;
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
 * @param {string} title
 */
function escapeRegex(title) {
  return String(title || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * @param {string} outlineTitle
 * @param {string} blockText
 */
function scoreOutlineBlockMatch(outlineTitle, blockText) {
  const title = String(outlineTitle || "").trim();
  const block = String(blockText || "").trim();
  if (!title || !block) return 0;

  const numbered = new RegExp(`^\\d+(?:\\.\\d+)*\\.?\\s+${escapeRegex(title)}$`, "i");
  if (numbered.test(block)) return 100;
  if (block.toLowerCase() === title.toLowerCase()) return 95;

  const numberedPrefix = block.match(/^(\d+(?:\.\d+)*\.?)\s+(.+)$/);
  if (numberedPrefix && numberedPrefix[2].toLowerCase() === title.toLowerCase()) return 100;

  let score = matchScore(title, block);
  if (score < 50) score = matchScoreFallback(title, block);
  return score;
}

/**
 * @param {{ title: string, pageIndex: number, level: number }} entry
 * @param {TextBlock[]} blocks
 */
function findBestOutlineBlock(entry, blocks) {
  const title = entry.title.trim();
  const active = blocks.filter((b) => b.kind !== "artifact");
  const pageBlocks = active.filter((b) => b.pageIndex === entry.pageIndex);
  const nearPageBlocks = active.filter(
    (b) => Math.abs(b.pageIndex - entry.pageIndex) <= 1,
  );

  /** @type {{ block: TextBlock, score: number } | null} */
  let best = null;

  const consider = (block, score) => {
    const blockText = block.text.trim();
    if (/\.{4,}\s*\d*\s*$/.test(blockText)) return;
    const pageDist = Math.abs((block.pageIndex ?? 0) - entry.pageIndex);
    if (pageDist > 10) return;
    if (pageDist > 5 && score < 100) return;
    const blockWords = blockText.split(/\s+/).filter(Boolean).length;
    if (blockWords < 2 && title.split(/\s+/).filter(Boolean).length >= 2) return;
    if (blockText.length < 4 && title.length >= 8) return;
    const titleNorm = title.toLowerCase();
    const blockNorm = blockText.toLowerCase();
    const titleAligned =
      blockNorm === titleNorm ||
      blockNorm.startsWith(`${titleNorm} `) ||
      blockNorm.startsWith(titleNorm) ||
      /^\d+(\.\d+)*\.?\s+/i.test(blockText);
    if (blockWords > 6 && score < 80 && !titleAligned) return;
    if (
      blockWords > 12 &&
      !/^\d+(\.\d+)*\.?\s+\S/.test(blockText) &&
      !/^abstract$/i.test(blockText) &&
      score < 80
    ) {
      return;
    }
    if (!best || score > best.score) best = { block, score };
  };

  for (const pool of [pageBlocks, nearPageBlocks, active]) {
    const prefix = title.match(/^(\d+(?:\.\d+)*)/);
    if (prefix) {
      const topNum = prefix[1].includes(".") ? null : prefix[1];
      const numbered = pool.filter((block) => {
        const t = block.text.trim();
        if (topNum) {
          return (
            new RegExp(`^${topNum}\\.\\s+[A-Z\\p{Lu}]`, "u").test(t) &&
            !/^\d+\.\d+/.test(t) &&
            isValidPdfTopLevelLabel(t)
          );
        }
        return t.startsWith(`${prefix[1]} `) || t.startsWith(`${prefix[1]}.`);
      });
      if (numbered.length) {
        const exact = numbered.find((b) => b.text.trim().toLowerCase() === title.toLowerCase());
        const pick = exact || [...numbered].sort((a, b) => a.text.length - b.text.length)[0];
        consider(pick, 100);
        if (best?.score >= 100) break;
      }
    }

    for (const block of pool) {
      const score = scoreOutlineBlockMatch(title, block.text);
      if (score >= 50) consider(block, score);
    }
    if (best?.score >= 95) break;
  }

  return best;
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

    const match = findBestOutlineBlock(entry, blocks);
    if (!match || match.score < 50) continue;

    const blockText = match.block.text.trim();
    let level = /** @type {1|2|3|4|5|6} */ (entry.level);
    if (/^abstract$/i.test(blockText) || /^broader impact$/i.test(blockText)) {
      level = 1;
    }
    if (/^\d+\.\d+\.\d+/.test(blockText)) continue;

    headings.push({
      label: resolveOutlineLabel(title, blockText),
      level,
      score: match.score,
      source: "outline",
      blockId: match.block.id,
      charStart: 0,
      charEnd: 0,
    });
  }

  return headings;
}

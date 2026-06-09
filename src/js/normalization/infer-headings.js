/**
 * Heading inference: scoring, patterns, hierarchy validation (heading-detection.md).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

const SECTION_KEYWORDS = [
  "introduction",
  "introducción",
  "abstract",
  "resumen",
  "conclusion",
  "conclusiones",
  "methods",
  "método",
  "methodology",
  "metodología",
  "results",
  "resultados",
  "discussion",
  "discusión",
  "background",
  "antecedentes",
  "related work",
  "trabajo relacionado",
  "appendix",
  "apéndice",
  "references",
  "bibliografía",
  "acknowledgments",
  "agradecimientos",
];

const NUMBERED_HEADING =
  /^(\d+(\.\d+)*\.?)\s+([A-ZÁÉÍÓÚÑÜ][\wáéíóúñü\s\-–—:,]+)$/u;
const ROMAN_HEADING = /^([IVXLC]+)\.\s+([A-ZÁÉÍÓÚÑÜ])/u;
const MD_HEADING = /^(#{1,6})\s+(.+)$/;

/**
 * @param {TextBlock[]} blocks
 * @param {number} [minWords]
 */
export function computeBodyFontSize(blocks, minWords = 20) {
  /** @type {Map<number, number>} */
  const charCounts = new Map();
  for (const block of blocks) {
    if (block.kind === "artifact" || block.kind === "heading") continue;
    const words = block.text.trim().split(/\s+/).filter(Boolean);
    if (words.length < minWords) continue;
    if (block.fontSize <= 0) continue;
    const size = Math.round(block.fontSize * 10) / 10;
    charCounts.set(size, (charCounts.get(size) || 0) + block.text.length);
  }
  if (!charCounts.size) {
    const fallback = blocks
      .filter((b) => b.fontSize > 0 && b.kind !== "artifact")
      .map((b) => b.fontSize);
    if (!fallback.length) return 0;
    return fallback.sort((a, b) => a - b)[Math.floor(fallback.length / 2)];
  }
  let best = 0;
  let bestChars = 0;
  for (const [size, chars] of charCounts) {
    if (chars > bestChars) {
      bestChars = chars;
      best = size;
    }
  }
  return best;
}

/**
 * @param {number[]} fontSizes descending unique sizes
 */
export function assignLevelsFromFontSizes(fontSizes) {
  const sorted = [...new Set(fontSizes.filter((s) => s > 0))].sort((a, b) => b - a);
  /** @type {Map<number, number>} */
  const map = new Map();
  sorted.forEach((size, i) => {
    map.set(size, Math.min(i + 1, 6));
  });
  return map;
}

/**
 * @param {TextBlock} block
 * @param {number} bodyFontSize
 * @param {number} pageHeight
 */
function scoreBlock(block, bodyFontSize, pageHeight) {
  if (block.kind === "artifact") return -1;

  const text = block.text.trim();
  if (!text) return -1;

  const mdMatch = MD_HEADING.exec(text);
  if (mdMatch) {
    return 100;
  }

  if (block.kind === "heading" && block.source === "html") {
    return 90;
  }

  let score = 0;
  const words = text.split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (bodyFontSize > 0 && block.fontSize > 0) {
    const ratio = block.fontSize / bodyFontSize;
    if (ratio >= 1.15) {
      score += Math.min(30, Math.max(0, Math.round((ratio - 1) * 100)));
    }
  }

  const fw = block.fontWeight;
  if (fw === "bold" || (typeof fw === "number" && fw >= 600)) {
    score += 15;
  }

  if (wordCount <= 12) score += 10;
  if (!/[.,;]$/.test(text)) score += 10;

  if (NUMBERED_HEADING.test(text) || ROMAN_HEADING.test(text)) {
    score += 20;
  }

  if (wordCount >= 2 && wordCount <= 10 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    score += 10;
  }

  const lower = text.toLowerCase();
  const keywordHit = SECTION_KEYWORDS.find((kw) => lower === kw || lower.startsWith(`${kw} `));
  if (keywordHit) {
    score += lower === keywordHit ? 15 : 10;
  }

  if (block.bbox && pageHeight > 0) {
    const y = block.bbox.y / pageHeight;
    if (y < 0.1 || y > 0.9) score -= 50;
  }

  return score;
}

/**
 * @param {TextBlock} block
 */
function labelFromBlock(block) {
  const text = block.text.trim();
  const md = MD_HEADING.exec(text);
  if (md) return md[2].trim();
  const num = NUMBERED_HEADING.exec(text);
  if (num) return text.replace(/^\d+(\.\d+)*\.?\s+/, "").trim() || text;
  return text;
}

/**
 * @param {HeadingCandidate[]} headings
 */
export function validateHeadingHierarchy(headings) {
  const sorted = [...headings].sort((a, b) => {
    const blockCmp = a.blockId.localeCompare(b.blockId);
    return blockCmp;
  });

  const byBlock = [...headings].sort((a, b) => a.charStart - b.charStart || a.blockId.localeCompare(b.blockId));
  let lastLevel = 0;
  const out = [];

  for (const h of byBlock) {
    let level = h.level;
    if (lastLevel > 0 && level === 1 && h.level === 1) {
      level = 2;
    }
    if (lastLevel > 0 && level > lastLevel + 1) {
      level = lastLevel + 1;
    }
    if (level > 6) level = 6;
    if (level < 1) level = 1;
    out.push({ ...h, level });
    lastLevel = level;
  }

  return out;
}

/**
 * @param {TextBlock[]} blocks
 * @param {{ format?: string, outline?: HeadingCandidate[], pageHeights?: number[], outlineCoverage?: number }} [opts]
 * @returns {{ headings: HeadingCandidate[], bodyFontSize: number }}
 */
export function inferHeadings(blocks, opts = {}) {
  const pageHeights = opts.pageHeights || [];
  const defaultPageHeight = pageHeights[0] || 792;
  const bodyFontSize = computeBodyFontSize(blocks);
  const threshold = 35;

  /** @type {HeadingCandidate[]} */
  const candidates = [];

  const outlineByBlock = new Map();
  if (opts.outline) {
    for (const oh of opts.outline) {
      outlineByBlock.set(oh.blockId, oh);
    }
  }

  if ((opts.outlineCoverage ?? 0) >= 0.8 && opts.outline?.length) {
    for (const oh of opts.outline) {
      candidates.push({
        label: oh.label,
        level: oh.level,
        score: oh.score ?? 100,
        source: "outline",
        blockId: oh.blockId,
        charStart: 0,
        charEnd: 0,
      });
    }
    const deduped = dedupeHeadings(candidates);
    const validated = validateHeadingHierarchy(deduped);
    return { headings: validated, bodyFontSize };
  }

  /** @type {TextBlock[]} */
  const acceptedBlocks = [];

  for (const block of blocks) {
    if (block.kind === "artifact") continue;

    const outlineMatch = outlineByBlock.get(block.id);
    if (outlineMatch) {
      candidates.push({
        label: outlineMatch.label,
        level: outlineMatch.level,
        score: 100,
        source: "outline",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    const pageHeight = pageHeights[block.pageIndex] || defaultPageHeight;
    const score = scoreBlock(block, bodyFontSize, pageHeight);

    if (block.kind === "heading") {
      const levelFromTag = block.fontSize > 0 ? undefined : undefined;
      void levelFromTag;
      const htmlLevel = block.lineIndex >= 1 && block.lineIndex <= 6 ? block.lineIndex : 2;
      candidates.push({
        label: labelFromBlock(block),
        level: htmlLevel,
        score: Math.max(score, 80),
        source: block.source === "html" ? "html-tag" : "html-inferred",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    if (score >= threshold) {
      acceptedBlocks.push(block);
      candidates.push({
        label: labelFromBlock(block),
        level: 2,
        score,
        source: bodyFontSize > 0 && block.fontSize >= bodyFontSize * 1.15 ? "font-size" : "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
    }
  }

  const fontSizes = candidates
    .filter((c) => c.source !== "outline" && c.source !== "html-tag")
    .map((c) => {
      const block = blocks.find((b) => b.id === c.blockId);
      return block?.fontSize || 0;
    })
    .filter((s) => s > 0);

  const levelMap = assignLevelsFromFontSizes(fontSizes);

  for (const c of candidates) {
    if (c.source === "outline" || c.source === "html-tag") continue;
    const block = blocks.find((b) => b.id === c.blockId);
    if (block?.fontSize && levelMap.has(block.fontSize)) {
      c.level = /** @type {1|2|3|4|5|6} */ (levelMap.get(block.fontSize));
      if (c.source === "pattern" && block.fontSize >= bodyFontSize * 1.15) {
        c.source = "font-size";
      }
    } else if (NUMBERED_HEADING.test(block?.text || "")) {
      const depth = (block.text.match(/^\d+(\.\d+)*/)?.[0].split(".").length || 1);
      c.level = /** @type {1|2|3|4|5|6} */ (Math.min(depth, 6));
    }
  }

  const deduped = dedupeHeadings(candidates);
  const validated = validateHeadingHierarchy(deduped);

  return { headings: validated, bodyFontSize };
}

/**
 * @param {HeadingCandidate[]} headings
 */
function dedupeHeadings(headings) {
  /** @type {Map<string, HeadingCandidate>} */
  const byBlock = new Map();
  for (const h of headings) {
    const existing = byBlock.get(h.blockId);
    if (!existing || h.score > existing.score || (h.score === existing.score && h.source === "outline")) {
      byBlock.set(h.blockId, h);
    }
  }
  return [...byBlock.values()];
}

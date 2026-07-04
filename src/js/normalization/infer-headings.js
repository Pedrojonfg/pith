/**
 * Heading inference: scoring, patterns, hierarchy validation (heading-detection.md).
 */

import { normalizeHeadingLabel, isPdfHeadingNoise, compareHeadingLabels, collapsePdfSpacedTitle } from "./heading-text.js";
import { resolveOutlineLabel } from "./pdf-outline.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */
/** @typedef {import("./types.js").HeadingCandidate} HeadingCandidate */

/** [debug-enrich] instrumentation-only */
function dppNormDbg() {
  return globalThis.__dppNormalizationDebug;
}

function countHeadingsBySource(headings) {
  /** @type {Record<string, number>} */
  const bySource = {};
  for (const h of headings || []) {
    const src = String(h.source || "unknown");
    bySource[src] = (bySource[src] || 0) + 1;
  }
  return bySource;
}

const SECTION_KEYWORDS = [
  "introduction",
  "abstract",
  "conclusion",
  "methods",
  "methodology",
  "results",
  "discussion",
  "background",
  "related work",
  "appendix",
  "references",
  "acknowledgments",
  "for more information",
];

const NUMBERED_HEADING =
  /^(\d+(\.\d+)*\.?)\s+([A-Z\p{Lu}][\p{L}\w\s\-–—:,]+)$/u;
const ROMAN_HEADING = /^([IVXLC]+)\.\s+([A-Z])/u;
const MD_HEADING = /^(#{1,6})\s+(.+)$/;
const GUTENBERG_SECTION_RE = /^(?:letter|chapter) \d+$/i;
const GUTENBERG_CONTENTS_RE = /^contents$/i;
const RFC_TOC_RE = /^TABLE OF CONTENTS$/i;
const RFC_SECTION_RE = /^\d+(?:\.\d+)+\.\s+\S/;
const RFC_TOP_SECTION_RE = /^\d+\.\s+[A-Z]/;

const DEFAULT_BODY_FONT_SIZE = 12;

/**
 * @param {TextBlock} block
 * @returns {boolean}
 */
function hasStrongHeadingPattern(block) {
  const text = String(block?.text || "").trim();
  if (!text) return false;
  if (/\.{4,}/.test(text)) return false;
  if (MD_HEADING.test(text)) return true;
  if (NUMBERED_HEADING.test(text) || ROMAN_HEADING.test(text)) return true;
  const lower = text.toLowerCase();
  if (SECTION_KEYWORDS.some((kw) => lower === kw || lower.startsWith(`${kw} `))) return true;
  if (GUTENBERG_CONTENTS_RE.test(text)) return true;
  if (GUTENBERG_SECTION_RE.test(text)) return true;
  if (RFC_TOC_RE.test(text)) return true;
  if (RFC_SECTION_RE.test(text) || RFC_TOP_SECTION_RE.test(text)) return true;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && words.length <= 20 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return true;
  }
  return false;
}

/** Top-level numbered section labels keep L1 (e.g. "1 Introduction", not "3.1 Foo"). */
function isTopLevelNumberedSection(label) {
  const t = String(label || "").trim();
  if (/^\d+\s+\S/.test(t) && !/^\d+\.\d+/.test(t)) return true;
  return /^\d+\.\s+\S/.test(t) && !/^\d+\.\d+/.test(t);
}

function isPreservedTopLevelSection(label) {
  const t = String(label || "").trim();
  if (isTopLevelNumberedSection(t)) return true;
  if (/^table of contents$/i.test(t)) return true;
  if (/^(abstract|references|acknowledgments?|broader impact)$/i.test(t)) return true;
  if (/^[IVXLC]+\.\s/i.test(t)) return true;
  if (/^[A-Z]\s+\S/.test(t)) return true;
  return false;
}

/**
 * @param {HeadingCandidate[]} headings
 * @param {TextBlock[]} [blocks]
 */
function sortHeadingsForOutput(headings, blocks) {
  const byBlock = sortHeadingsByBlockOrder(headings, blocks);
  return [...byBlock].sort((a, b) => compareHeadingLabels(a.label, b.label));
}

/** Gutenberg ToC lists sections that may not exist in truncated excerpts — require body follow-up. */
function isGutenbergBodySectionHeading(blocks, blockIndex) {
  const text = String(blocks[blockIndex]?.text || "").trim();
  if (!GUTENBERG_SECTION_RE.test(text)) return false;
  for (let j = blockIndex + 1; j < blocks.length; j++) {
    const next = String(blocks[j]?.text || "").trim();
    if (!next) continue;
    if (GUTENBERG_SECTION_RE.test(next) || GUTENBERG_CONTENTS_RE.test(next)) return false;
    return next.length > 40 || /^[_*<]/.test(next) || next.split(/\s+/).filter(Boolean).length > 8;
  }
  return false;
}

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
  if (isPdfHeadingNoise(text)) return -1;

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
  if (md) return normalizeHeadingLabel(md[2]);
  return normalizeHeadingLabel(collapsePdfSpacedTitle(text));
}

/**
 * @param {TextBlock} block
 * @returns {1|2|3|4|5|6}
 */
function levelFromBlock(block) {
  const text = block.text.trim();
  const md = MD_HEADING.exec(text);
  if (md) return /** @type {1|2|3|4|5|6} */ (Math.min(6, md[1].length));
  if (block.kind === "heading" && block.lineIndex >= 1 && block.lineIndex <= 6) {
    return /** @type {1|2|3|4|5|6} */ (block.lineIndex);
  }
  const num = NUMBERED_HEADING.exec(text);
  if (num) {
    const depth = (num[1].match(/\./g) || []).length + 1;
    return /** @type {1|2|3|4|5|6} */ (Math.min(depth, 6));
  }
  if (ROMAN_HEADING.test(text)) return 1;
  if (GUTENBERG_CONTENTS_RE.test(text)) return 2;
  if (GUTENBERG_SECTION_RE.test(text)) return 2;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 3 && words.length <= 20 && text === text.toUpperCase() && /[A-Z]/.test(text)) {
    return 1;
  }
  return 2;
}

/**
 * @param {HeadingCandidate[]} headings
 * @param {TextBlock[]} [blocks]
 */
function sortHeadingsByBlockOrder(headings, blocks) {
  if (!blocks?.length) {
    return [...headings].sort((a, b) => a.charStart - b.charStart || a.blockId.localeCompare(b.blockId));
  }
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  return [...headings].sort(
    (a, b) => (order.get(a.blockId) ?? 0) - (order.get(b.blockId) ?? 0) || a.blockId.localeCompare(b.blockId),
  );
}

/**
 * @param {HeadingCandidate[]} headings
 * @param {{ blocks?: TextBlock[] }} [opts]
 */
export function validateHeadingHierarchy(headings, opts = {}) {
  const byBlock = sortHeadingsByBlockOrder(headings, opts.blocks);
  let lastLevel = 0;
  let seenFirstHeading = false;
  /** @type {HeadingCandidate[]} */
  const out = [];

  for (const h of byBlock) {
    let level = h.level;
    const preserveLevel =
      h.source === "html-tag" ||
      h.source === "html-heuristic" ||
      h.source === "outline" ||
      (h.source === "pattern" && h.score >= 90);

    if (!preserveLevel) {
      if (seenFirstHeading && level === 1 && h.level === 1 && !isPreservedTopLevelSection(h.label)) {
        level = 2;
      }
      if (lastLevel > 0 && level > lastLevel + 1 && !isPreservedTopLevelSection(h.label)) {
        level = lastLevel + 1;
      }
    }

    if (level > 6) level = 6;
    if (level < 1) level = 1;
    out.push({ ...h, level });
    lastLevel = level;
    seenFirstHeading = true;
  }

  return out;
}

/**
 * @param {TextBlock[]} blocks
 * @param {{ format?: string, outline?: HeadingCandidate[], pageHeights?: number[], outlineCoverage?: number }} [opts]
 * @returns {{ headings: HeadingCandidate[], bodyFontSize: number, diagnostics: { candidateCount: number, acceptedCount: number, rejectionReasons: Record<string, number>, bySource: Record<string, number> } }}
 */
export function inferHeadings(blocks, opts = {}) {
  const pageHeights = opts.pageHeights || [];
  const defaultPageHeight = pageHeights[0] || 792;
  const rawBodyFontSize = computeBodyFontSize(blocks);
  const bodyFontSizeUnavailable = rawBodyFontSize <= 0;
  const bodyFontSize = bodyFontSizeUnavailable ? DEFAULT_BODY_FONT_SIZE : rawBodyFontSize;
  const threshold = 35;
  const patternOnlyThreshold = 25;

  /** @type {Record<string, number>} */
  const rejectionReasons = {};
  const bumpRejection = (code) => {
    rejectionReasons[code] = (rejectionReasons[code] || 0) + 1;
  };

  /** @type {HeadingCandidate[]} */
  const candidates = [];

  const outlineByBlock = new Map();
  if (opts.outline) {
    for (const oh of opts.outline) {
      outlineByBlock.set(oh.blockId, oh);
    }
  }

  /** @type {TextBlock[]} */
  const acceptedBlocks = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (block.kind === "artifact") {
      bumpRejection("artifact");
      continue;
    }

    const text = block.text.trim();
    if (!text) {
      bumpRejection("empty_text");
      continue;
    }

    const plainFmt = opts.format === "txt" || opts.format === "md";
    if (plainFmt && GUTENBERG_CONTENTS_RE.test(text)) {
      candidates.push({
        label: normalizeHeadingLabel(text),
        level: 2,
        score: 90,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    if (plainFmt && /\.{4,}/.test(text)) {
      bumpRejection("txt_dot_leader_toc");
      continue;
    }

    if (plainFmt && RFC_TOC_RE.test(text)) {
      candidates.push({
        label: normalizeHeadingLabel(text),
        level: 1,
        score: 92,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    if (plainFmt && RFC_SECTION_RE.test(text) && !/\.{3,}/.test(text)) {
      const nums = text.trim().match(/^(\d+(?:\.\d+)*)/)?.[1].split(".").filter(Boolean) || [];
      candidates.push({
        label: normalizeHeadingLabel(text.trim()),
        level: /** @type {1|2|3|4|5|6} */ (Math.min(Math.max(nums.length, 1), 6)),
        score: 90,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    if (plainFmt && RFC_TOP_SECTION_RE.test(text) && !/\.{3,}/.test(text)) {
      candidates.push({
        label: normalizeHeadingLabel(text.trim()),
        level: 1,
        score: 90,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    if (plainFmt && /^\d{3}\s+-\s+/.test(text)) {
      bumpRejection("rfc_precedence_list_item");
      continue;
    }

    if (plainFmt && GUTENBERG_SECTION_RE.test(text) && !isGutenbergBodySectionHeading(blocks, bi)) {
      bumpRejection("gutenberg_toc_only");
      continue;
    }

    const outlineMatch = outlineByBlock.get(block.id);
    if (outlineMatch && block.source === "pdf" && /\.{4,}\s*\d*\s*$/.test(text)) {
      bumpRejection("pdf_dot_leader_toc");
    } else if (outlineMatch) {
      const resolvedLabel = resolveOutlineLabel(outlineMatch.label, text);
      const resolvedLevel =
        /^\d+(\.\d+)+/.test(text.trim()) || /^\d+\s+\S/.test(text.trim())
          ? levelFromBlock(block)
          : outlineMatch.level;
      const outlineWords = text.split(/\s+/).filter(Boolean).length;
      const outlineOk =
        outlineWords <= 12 ||
        /^\d+(\.\d+)*\.?\s+\S/.test(text) ||
        /^abstract$/i.test(text) ||
        outlineMatch.score >= 80;
      if (outlineOk) {
        candidates.push({
          label: resolvedLabel,
          level: resolvedLevel,
          score: 100,
          source: "outline",
          blockId: block.id,
          charStart: 0,
          charEnd: 0,
        });
        acceptedBlocks.push(block);
        continue;
      }
      bumpRejection("outline_prose_mismatch");
    }

    const pageHeight = pageHeights[block.pageIndex] || defaultPageHeight;
    const score = scoreBlock(block, bodyFontSizeUnavailable ? 0 : bodyFontSize, pageHeight);
    const acceptThreshold =
      bodyFontSizeUnavailable && hasStrongHeadingPattern(block) ? patternOnlyThreshold : threshold;

    const blockIndex = bi;
    const earlyLetterhead =
      block.pageIndex === 0 &&
      blockIndex >= 0 &&
      blockIndex < 6 &&
      text.length <= 60 &&
      !text.includes(":") &&
      !isPdfHeadingNoise(text);

    if (earlyLetterhead && /school/i.test(text)) {
      candidates.push({
        label: labelFromBlock(block),
        level: 1,
        score: 75,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }
    if (earlyLetterhead && /(mathematics|course \d|grade)/i.test(text)) {
      candidates.push({
        label: labelFromBlock(block),
        level: 2,
        score: 70,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    const collapsedTitle = collapsePdfSpacedTitle(text);
    if (
      block.pageIndex === 0 &&
      blockIndex >= 0 &&
      blockIndex < 10 &&
      collapsedTitle !== text &&
      collapsedTitle.length >= 20 &&
      collapsedTitle.length <= 120 &&
      /(employment|wages|quarter|release|report)/i.test(collapsedTitle)
    ) {
      candidates.push({
        label: normalizeHeadingLabel(collapsedTitle),
        level: 1,
        score: 92,
        source: "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    if (block.kind === "heading") {
      if (isPdfHeadingNoise(labelFromBlock(block))) {
        bumpRejection("pdf_letterhead_noise");
        continue;
      }
      const htmlLevel = levelFromBlock(block);
      const isHeuristic = block.fontWeight === "heuristic";
      candidates.push({
        label: labelFromBlock(block),
        level: htmlLevel,
        score: Math.max(score, 80),
        source:
          block.source === "html"
            ? isHeuristic
              ? "html-heuristic"
              : "html-tag"
            : "html-inferred",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
      acceptedBlocks.push(block);
      continue;
    }

    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (block.source === "pdf" && /^\d+\.\s+[A-Za-z]/.test(text) && !/^\d+\.\d+/.test(text)) {
      bumpRejection("pdf_numbered_list_item");
      continue;
    }
    if (block.source === "pdf" && /Input-Input|Layer\d+\b/i.test(text)) {
      bumpRejection("pdf_table_caption_noise");
      continue;
    }
    if (block.source === "pdf" && /^Table\s+\d+\./i.test(text)) {
      bumpRejection("pdf_table_caption");
      continue;
    }
    if (block.source === "pdf" && /\.{4,}\s*\d+\s*$/.test(text)) {
      bumpRejection("pdf_dot_leader_toc");
      continue;
    }
    if (block.source === "pdf" && isPdfHeadingNoise(text)) {
      bumpRejection("pdf_prose_fragment");
      continue;
    }
    if (
      block.source === "pdf" &&
      block.pageIndex <= 1 &&
      !NUMBERED_HEADING.test(text) &&
      !/^abstract$/i.test(text) &&
      !/^references$/i.test(text)
    ) {
      const lower = text.toLowerCase();
      const isSection = SECTION_KEYWORDS.some((kw) => lower === kw || lower.startsWith(`${kw} `));
      if (!isSection && wordCount >= 3 && wordCount <= 14) {
        bumpRejection("pdf_title_line");
        continue;
      }
    }
    if (
      block.source === "pdf" &&
      wordCount > 12 &&
      !NUMBERED_HEADING.test(text) &&
      !ROMAN_HEADING.test(text) &&
      !SECTION_KEYWORDS.some((kw) => text.toLowerCase() === kw)
    ) {
      bumpRejection("pdf_prose_too_long");
      continue;
    }

    if (score >= acceptThreshold || (bodyFontSizeUnavailable && hasStrongHeadingPattern(block))) {
      acceptedBlocks.push(block);
      candidates.push({
        label: labelFromBlock(block),
        level: levelFromBlock(block),
        score,
        source:
          !bodyFontSizeUnavailable && block.fontSize >= bodyFontSize * 1.15
            ? "font-size"
            : "pattern",
        blockId: block.id,
        charStart: 0,
        charEnd: 0,
      });
    } else {
      bumpRejection(bodyFontSizeUnavailable ? "below_threshold_no_baseline" : "below_threshold");
    }
  }

  const fontSizes = candidates
    .filter((c) => c.source !== "outline" && c.source !== "html-tag" && c.source !== "html-heuristic")
    .map((c) => {
      const block = blocks.find((b) => b.id === c.blockId);
      return block?.fontSize || 0;
    })
    .filter((s) => s > 0);

  const levelMap = assignLevelsFromFontSizes(fontSizes);

  for (const c of candidates) {
    if (c.source === "outline" || c.source === "html-tag" || c.source === "html-heuristic" || c.source === "pattern") {
      continue;
    }
    const block = blocks.find((b) => b.id === c.blockId);
    const blockText = block?.text?.trim() || "";
    if (/^abstract$/i.test(blockText) || /^references$/i.test(blockText) || /^broader impact$/i.test(blockText)) {
      c.level = 1;
      continue;
    }
    if (NUMBERED_HEADING.test(blockText) || ROMAN_HEADING.test(blockText)) {
      c.level = levelFromBlock(block);
      continue;
    }
    if (block?.pageIndex === 0 && /school/i.test(c.label) && c.label.length < 80) {
      c.level = 1;
    }
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

  /** @type {HeadingCandidate[]} */
  let workingCandidates = candidates;
  const outlineCandidateCount = candidates.filter((c) => c.source === "outline").length;
  if (
    outlineCandidateCount >= 15 &&
    (opts.outlineCoverage ?? 0) >= 0.25 &&
    opts.format === "pdf"
  ) {
    workingCandidates = candidates.filter(
      (c) => c.source === "outline" || (c.source === "pattern" && c.score >= 90),
    );
  }

  const deduped = dedupeHeadings(workingCandidates, blocks);
  const merged = mergeLetterheadHeadings(deduped, blocks);
  const outlineHeavyPdf =
    outlineCandidateCount >= 15 &&
    (opts.outlineCoverage ?? 0) >= 0.25 &&
    opts.format === "pdf";
  const sorted =
    opts.format === "txt" || opts.format === "md" || outlineHeavyPdf
      ? sortHeadingsByBlockOrder(merged, blocks)
      : sortHeadingsForOutput(merged, blocks);
  const validated = validateHeadingHierarchy(sorted, { blocks });

  const bySource = countHeadingsBySource(validated); // [debug-enrich]
  const primaryMethod =
    bySource.outline > 0
      ? "outline-partial"
      : bySource["font-size"] > 0
        ? "font-size"
        : bySource["html-tag"] > 0 || bySource["html-heuristic"] > 0
          ? "html-tag"
          : validated.length > 0
            ? "pattern"
            : "none";
  const diagnostics = buildDiagnostics(validated, candidates.length, rejectionReasons, {
    bodyFontSizeUnavailable,
    bodyFontSizeFallback: bodyFontSizeUnavailable ? bodyFontSize : undefined,
  });
  console.info("[infer-headings.inferHeadings] Done:", {
    headingCount: validated.length,
    bodyFontSize: rawBodyFontSize,
    bodyFontSizeUnavailable,
    bySource,
    primaryMethod,
    outlineCoverage: opts.outlineCoverage ?? 0,
    diagnostics,
  });
  if (validated.length === 0) {
    console.warn("[infer-headings.inferHeadings] No headings inferred:", {
      blockCount: blocks.length,
      bodyFontSize: rawBodyFontSize,
      bodyFontSizeUnavailable,
      format: opts.format || "unknown",
      candidateCount: diagnostics.candidateCount,
      rejectionReasons: diagnostics.rejectionReasons,
    });
  }

  const bag = dppNormDbg();
  if (bag) {
    bag.headingsInferred = validated.length;
    bag.headingsBySource = bySource;
    bag.headingInferenceDiagnostics = diagnostics;
  }

  return { headings: validated, bodyFontSize: rawBodyFontSize, diagnostics };
}

/**
 * @param {HeadingCandidate[]} validated
 * @param {number} candidateCount
 * @param {Record<string, number>} rejectionReasons
 * @param {{ bodyFontSizeUnavailable?: boolean, bodyFontSizeFallback?: number }} [extra]
 */
function buildDiagnostics(validated, candidateCount, rejectionReasons, extra = {}) {
  return {
    candidateCount,
    acceptedCount: validated.length,
    rejectionReasons,
    bySource: countHeadingsBySource(validated),
    ...(extra.bodyFontSizeUnavailable ? { bodyFontSizeUnavailable: true } : {}),
    ...(extra.bodyFontSizeFallback != null ? { bodyFontSizeFallback: extra.bodyFontSizeFallback } : {}),
  };
}

/**
 * @param {HeadingCandidate[]} headings
 * @param {TextBlock[]} [blocks]
 */
function dedupeHeadings(headings, blocks = []) {
  /** @type {Map<string, HeadingCandidate>} */
  const byBlock = new Map();
  for (const h of headings) {
    const existing = byBlock.get(h.blockId);
    if (!existing || h.score > existing.score || (h.score === existing.score && h.source === "outline")) {
      byBlock.set(h.blockId, h);
    }
  }
  /** @type {Map<string, HeadingCandidate>} */
  const byLabel = new Map();
  for (const h of byBlock.values()) {
    const section = h.label.match(/^(\d+(?:\.\d+)*)/);
    const roman = h.label.match(/^([IVXLC]+)\./i);
    const key = section ? section[1] : roman ? roman[1].toUpperCase() : h.label.toLowerCase();
    const existing = byLabel.get(key);
    const block = blocks.find((b) => b.id === h.blockId);
    const blockText = block?.text?.trim() || h.label;
    const hasDotLeaders = /\.{4,}/.test(blockText);
    const quality = hasDotLeaders
      ? -1
      : /^\d+\s+\S/.test(blockText)
        ? 3
        : /^\d+\.\d+/.test(blockText)
          ? 2
          : /^\d+\.\s+/.test(blockText)
            ? 0
            : /^[IVXLC]+\./i.test(blockText)
              ? 3
              : 1;
    const existingBlock = existing ? blocks.find((b) => b.id === existing.blockId) : null;
    const existingText = existingBlock?.text?.trim() || existing?.label || "";
    const existingHasDotLeaders = /\.{4,}/.test(existingText);
    const existingQuality = existingHasDotLeaders
      ? -1
      : /^\d+\s+\S/.test(existingText)
        ? 3
        : /^\d+\.\d+/.test(existingText)
          ? 2
          : /^\d+\.\s+/.test(existingText)
            ? 0
            : /^[IVXLC]+\./i.test(existingText)
              ? 3
              : 1;
    if (
      !existing ||
      quality > existingQuality ||
      (quality === existingQuality &&
        (h.source === "outline" || h.label.length > existing.label.length))
    ) {
      byLabel.set(key, h);
    }
  }
  return [...byLabel.values()];
}

/**
 * Merge consecutive short letterhead lines (e.g. course title split across two PDF text blocks).
 * @param {HeadingCandidate[]} headings
 * @param {TextBlock[]} blocks
 */
function mergeLetterheadHeadings(headings, blocks) {
  const order = new Map(blocks.map((b, i) => [b.id, i]));
  const sorted = [...headings].sort(
    (a, b) => (order.get(a.blockId) ?? 0) - (order.get(b.blockId) ?? 0),
  );
  /** @type {HeadingCandidate[]} */
  const out = [];
  for (const h of sorted) {
    const prev = out[out.length - 1];
    const block = blocks.find((b) => b.id === h.blockId);
    const prevBlock = prev ? blocks.find((b) => b.id === prev.blockId) : null;
    const pdfPlain =
      block?.source === "pdf" && !/^#{1,6}\s/.test(String(block?.text || ""));
    const prevPdfPlain =
      prevBlock?.source === "pdf" && !/^#{1,6}\s/.test(String(prevBlock?.text || ""));
    const onFirstPage = (block?.pageIndex ?? 0) === 0 && (prevBlock?.pageIndex ?? 0) === 0;
    const short = h.label.length <= 45;
    if (
      prev &&
      onFirstPage &&
      pdfPlain &&
      prevPdfPlain &&
      short &&
      prev.level === h.level &&
      (order.get(h.blockId) ?? 0) - (order.get(prev.blockId) ?? 0) <= 2 &&
      !/[.:]/.test(h.label)
    ) {
      prev.label = `${prev.label} / ${h.label}`;
      continue;
    }
    out.push({ ...h });
  }
  return out;
}

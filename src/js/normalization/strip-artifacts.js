/**
 * Artifact removal: page numbers, running headers/footers (artifact-removal.md).
 */

import { isPdfHeadingNoise } from "./heading-text.js";

/** @typedef {import("./types.js").TextBlock} TextBlock */

/** [debug-enrich] warn when artifact stripping removes more than this % of characters */
const STRIP_OVER_REMOVAL_WARN_PCT = 30;

/** [debug-enrich] instrumentation-only */
function dppNormDbg() {
  return globalThis.__dppNormalizationDebug;
}

function blockCharCount(blocks) {
  return (blocks || []).reduce((sum, b) => sum + String(b?.text || "").length, 0);
}

/** [debug-enrich] math-notation diagnostics: avoid stripping formula-like content silently */
const MATH_INDICATOR_CHARS = new Set(
  [
    "α",
    "β",
    "γ",
    "δ",
    "ε",
    "θ",
    "λ",
    "μ",
    "π",
    "ρ",
    "σ",
    "τ",
    "φ",
    "ω",
    "Δ",
    "Θ",
    "Λ",
    "Π",
    "Σ",
    "Φ",
    "Ω",
    "√",
    "∫",
    "±",
    "≤",
    "≥",
    "∂",
    "∇",
  ],
); // [debug-enrich]

/** [debug-enrich] */
function countMathIndicators(text) {
  const s = String(text || "");
  let hits = 0;
  for (const ch of s) {
    if (MATH_INDICATOR_CHARS.has(ch)) hits += 1;
  }
  hits += (s.match(/\\(frac|sum|int|sqrt|alpha|beta|gamma|theta|sigma|Sigma)\b/g) || []).length;
  hits += (s.match(/\^\{|\_\{/g) || []).length;
  return hits;
}

/** [debug-enrich] */
function sampleForLog(text, maxLen) {
  const s = String(text || "").replace(/\s+/g, " ").trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 3))}...`;
}

const DEFAULT_HEADER_RATIO = 0.1;
const DEFAULT_FOOTER_RATIO = 0.1;

const PAGE_NUMBER_PATTERNS = [
  { re: /^\d{1,4}$/, code: "page_number" },
  { re: /^[-–—]\s*\d{1,4}\s*[-–—]$/, code: "page_number_decorated" },
  { re: /^page\s+\d+(\s+of\s+\d+)?$/i, code: "page_number_labeled" },
  { re: /^p\.?\s*\d+$/i, code: "page_number_short" },
  { re: /^\d+\s*\/\s*\d+$/, code: "page_fraction" },
  { re: /^[ivxlcdm]+$/i, code: "page_number_roman" },
  { re: /^\[Page\s+[ivxlcdm\d]+\]$/i, code: "page_marker_bracket" },
];

const EDITORIAL_PATTERNS = [
  /doi\.org/i,
  /\bdoi:\s*\S+/i,
  /©|copyright/i,
  /downloaded by \[/i,
  /\bspringer\b/i,
  /\belsevier\b/i,
  /cambridge university press/i,
  /arXiv:\S+/i,
];

export const ORNAMENT_PATTERN = /^[\s\W]{1,20}$/u;
export const ROMAN_ORNAMENT = /^~[IVXLC]+~$/i;
export const ISOLATED_ALLCAPS = /^[A-Z]{3,15}$/;

/**
 * @param {TextBlock} block
 * @param {number} [frontMatterEnd]
 */
export function isArtifact(block, frontMatterEnd = -1) {
  const text = String(block.text || "");
  const trim = text.trim();
  if (ORNAMENT_PATTERN.test(text)) return true;
  if (ROMAN_ORNAMENT.test(trim)) return true;
  if (/^contents$/i.test(trim) || /^abstract$/i.test(trim)) return false;
  if (/^\d+(\.\d+)*\.?\s+[A-Za-z]/.test(trim)) return false;
  if (block.pageIndex <= frontMatterEnd && ISOLATED_ALLCAPS.test(trim)) return true;
  return false;
}

/**
 * @param {string} text
 */
function normalizeForRepetition(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * @param {string} a
 * @param {string} b
 */
function textSimilarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length < b.length ? a : b;
  if (!longer.includes(shorter) && shorter.length / longer.length < 0.9) return 0;
  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i += 1) {
    if (a[i] === b[i]) matches += 1;
  }
  return matches / Math.max(a.length, b.length);
}

/**
 * @param {TextBlock} block
 * @param {number} pageHeight
 * @param {number} headerRatio
 * @param {number} footerRatio
 */
function isInHeaderFooterZone(block, pageHeight, headerRatio, footerRatio) {
  const bbox = block.bbox;
  if (!bbox || pageHeight <= 0) return false;
  const y = bbox.y;
  const bottom = bbox.y + (bbox.height || 0);
  if (y < pageHeight * headerRatio) return true;
  if (bottom > pageHeight * (1 - footerRatio)) return true;
  return false;
}

/**
 * @param {TextBlock} block
 * @param {number} pageHeight
 */
function isInCentralZone(block, pageHeight) {
  const bbox = block.bbox;
  if (!bbox || pageHeight <= 0) return true;
  const yRatio = bbox.y / pageHeight;
  return yRatio > 0.15 && yRatio < 0.85;
}

/**
 * @param {string} line
 */
function isNumberedSection(line) {
  const trimmed = String(line || "").trim();
  if (/^\d+\s+\S/.test(trimmed)) return true;
  if (!/^\d+(\.\d+)+\s+\S/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length >= 2;
}

/**
 * @param {string} line
 */
function matchPageNumberRegex(line) {
  const trimmed = String(line || "").trim();
  for (const { re, code } of PAGE_NUMBER_PATTERNS) {
    if (re.test(trimmed)) {
      if (code === "page_number_roman" && trimmed.length > 6) continue;
      return code;
    }
  }
  return null;
}

/**
 * @param {string} line
 */
function matchEditorial(line) {
  const trimmed = String(line || "").trim();
  return EDITORIAL_PATTERNS.some((re) => re.test(trimmed));
}

/** Keep real section headings that PDF layout places in the header/footer margin zone. */
function isProtectedSectionHeading(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 120) return false;
  if (/^[IVXLC]+\.\s+[A-Za-z]/.test(t)) return true;
  if (/^\d+(\.\d+)+\.\s+\S/.test(t)) return true;
  if (/^\d+\.\s+[A-Z]/.test(t)) return true;
  if (/^(introduction|abstract|references|acknowledgments?|foreword|table of contents)$/i.test(t)) {
    return true;
  }
  if (/^TABLE OF CONTENTS$/i.test(t)) return true;
  return false;
}

/** RFC / IETF running header lines repeated on page breaks. */
function isRfcRunningHeaderLine(line) {
  const t = String(line || "").trim();
  if (!t) return false;
  if (/^RFC:\s*\d+$/i.test(t)) return true;
  if (/^September \d{4}$/i.test(t)) return true;
  if (/^Internet Protocol$/i.test(t)) return true;
  if (/^Specification$/i.test(t)) return true;
  if (/^Overview$/i.test(t)) return true;
  if (/^\[\.\.\. document continues/i.test(t)) return true;
  return false;
}

/** Keep single-page letterhead titles out of header-zone stripping. */
function isLikelyLetterheadTitle(block) {
  const t = String(block?.text || "").trim();
  if ((block?.pageIndex ?? 0) !== 0) return false;
  if (t.length < 10 || t.length > 90) return false;
  if (isPdfHeadingNoise(t)) return false;
  if (/middle school|high school|elementary|university|college|syllabus|department/i.test(t)) {
    return true;
  }
  if (/^[A-Z][\w\s.'-]+$/.test(t) && t.split(/\s+/).length >= 3 && !/[,:]/.test(t)) {
    return true;
  }
  return false;
}

/**
 * @param {TextBlock[]} blocks
 * @param {{ format?: string, pageHeights?: number[], headerZoneRatio?: number, footerZoneRatio?: number, headingBlockIds?: Set<string>, frontMatterEnd?: number }} [opts]
 */
export function stripArtifacts(blocks, opts = {}) {
  const headerRatio = opts.headerZoneRatio ?? DEFAULT_HEADER_RATIO;
  const footerRatio = opts.footerZoneRatio ?? DEFAULT_FOOTER_RATIO;
  const pageHeights = opts.pageHeights || [];
  const headingIds = opts.headingBlockIds || new Set();
  const frontMatterEnd = opts.frontMatterEnd ?? -1;
  const warnings = [];
  let artifactsRemoved = 0;
  let bodyZoneRejections = 0;

  const charsBeforeStrip = blockCharCount(blocks); // [debug-enrich]
  console.debug("[strip-artifacts.stripArtifacts] Start:", {
    blockCount: blocks.length,
    charsBeforeStrip,
    format: opts.format || "unknown",
  }); // [debug-enrich]

  const pageCount = Math.max(
    1,
    ...blocks.map((b) => b.pageIndex + 1),
    pageHeights.length,
  );

  const defaultPageHeight = pageHeights[0] || 792;

  /** @type {Map<string, { pages: Set<number>, zone: string }>} */
  const repetitionMap = new Map();

  for (const block of blocks) {
    if (block.kind === "artifact") continue;
    const pageHeight = pageHeights[block.pageIndex] || defaultPageHeight;
    if (!block.bbox) continue;
    if (!isInHeaderFooterZone(block, pageHeight, headerRatio, footerRatio)) continue;
    const norm = normalizeForRepetition(block.text);
    if (!norm || norm.length < 2) continue;
    const key = norm;
    if (!repetitionMap.has(key)) {
      repetitionMap.set(key, { pages: new Set(), zone: "header" });
    }
    repetitionMap.get(key).pages.add(block.pageIndex);
  }

  const repetitionThreshold = Math.ceil(pageCount * 0.7);
  /** @type {Set<string>} */
  const repeatedTexts = new Set();
  for (const [text, { pages }] of repetitionMap) {
    if (pages.size >= repetitionThreshold) repeatedTexts.add(text);
  }

  const result = blocks.map((block) => {
    if (block.kind === "artifact") return block;
    if (block.kind === "heading") return block;

    if (isArtifact(block, frontMatterEnd)) {
      const mathHits = countMathIndicators(block.text); // [debug-enrich]
      if (mathHits > 0) {
        console.warn("[strip-artifacts.stripArtifacts] Stripping may remove formula-like content:", {
          rule: "isArtifact",
          pageIndex: block.pageIndex,
          blockId: block.id,
          mathIndicators: mathHits,
          sample: sampleForLog(block.text, 80),
        }); // [debug-enrich]
        const bag = dppNormDbg();
        if (bag) {
          bag.suspiciousStripRemovals = (bag.suspiciousStripRemovals || 0) + 1;
          bag.suspiciousStripRemovalSamples = Array.isArray(bag.suspiciousStripRemovalSamples)
            ? bag.suspiciousStripRemovalSamples
            : [];
          if (bag.suspiciousStripRemovalSamples.length < 5) {
            bag.suspiciousStripRemovalSamples.push(sampleForLog(block.text, 80));
          }
        }
      }
      artifactsRemoved += 1;
      return { ...block, kind: "artifact" };
    }

    const pageHeight = pageHeights[block.pageIndex] || defaultPageHeight;
    const lines = String(block.text || "").split(/\n/);
    const protectedCentral =
      block.bbox &&
      isInCentralZone(block, pageHeight) &&
      lines.some((ln) => ln.trim().split(/\s+/).filter(Boolean).length >= 4);

    if (protectedCentral) return block;
    if (headingIds.has(block.id)) return block;
    if (isLikelyLetterheadTitle(block)) return block;
    if (lines.length === 1 && isProtectedSectionHeading(block.text)) return block;
    if (lines.some((ln) => isNumberedSection(ln))) return block;

    let reason = null;
    let code = null;

    const norm = normalizeForRepetition(block.text);
    const inZone = block.bbox && isInHeaderFooterZone(block, pageHeight, headerRatio, footerRatio);

    if (inZone && repeatedTexts.has(norm)) {
      reason = "repetition";
      code = "running_header";
    } else if (inZone) {
      reason = "zone";
      code = "header_footer_zone";
    }

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const pageCode = matchPageNumberRegex(trimmed);
      if (pageCode && lines.length === 1) {
        reason = "regex";
        code = pageCode;
        break;
      }
      if (matchEditorial(trimmed) && (inZone || trimmed.length < 120 || /arXiv:/i.test(trimmed))) {
        reason = "regex";
        code = "editorial_mark";
        break;
      }
    }

    if (!reason && inZone && block.text.trim().split(/\s+/).length <= 6) {
      reason = "zone";
      code = "header_footer_zone";
    }

    if (reason) {
      if (block.bbox && isInCentralZone(block, pageHeight) && !matchPageNumberRegex(block.text.trim())) {
        bodyZoneRejections += 1;
        return block;
      }

      const mathHits = countMathIndicators(block.text); // [debug-enrich]
      if (mathHits > 0) {
        console.warn("[strip-artifacts.stripArtifacts] Stripping may remove formula-like content:", {
          rule: reason,
          code,
          pageIndex: block.pageIndex,
          blockId: block.id,
          inHeaderFooterZone: inZone,
          mathIndicators: mathHits,
          sample: sampleForLog(block.text, 80),
        }); // [debug-enrich]
        const bag = dppNormDbg();
        if (bag) {
          bag.suspiciousStripRemovals = (bag.suspiciousStripRemovals || 0) + 1;
          bag.suspiciousStripRemovalSamples = Array.isArray(bag.suspiciousStripRemovalSamples)
            ? bag.suspiciousStripRemovalSamples
            : [];
          if (bag.suspiciousStripRemovalSamples.length < 5) {
            bag.suspiciousStripRemovalSamples.push(sampleForLog(block.text, 80));
          }
        }
      }

      artifactsRemoved += 1;
      return { ...block, kind: "artifact" };
    }

    return block;
  });

  const cleaned = result.map((block) => {
    if (block.kind === "artifact") return block;
    const lines = String(block.text || "").split(/\n/);
    const kept = lines.filter((ln) => {
      const trimmed = ln.trim();
      if (/arXiv:\S+/i.test(trimmed)) return false;
      if (matchPageNumberRegex(trimmed)) return false;
      if (opts.format === "txt" && isRfcRunningHeaderLine(trimmed)) return false;
      return true;
    });
    if (kept.length === lines.length) return block;
    const text = kept.join("\n").trim();
    if (!text) return { ...block, kind: "artifact" };
    return { ...block, text };
  });

  if (bodyZoneRejections >= 5) {
    warnings.push("layout_complex");
  }

  const charsAfterStrip = blockCharCount(cleaned); // [debug-enrich]
  const removedChars = Math.max(0, charsBeforeStrip - charsAfterStrip);
  const removalPct = charsBeforeStrip > 0 ? Math.round((removedChars / charsBeforeStrip) * 100) : 0;
  console.info("[strip-artifacts.stripArtifacts] Done:", {
    artifactsRemoved,
    charsBeforeStrip,
    charsAfterStrip,
    removalPct,
    warningCount: warnings.length,
  }); // [debug-enrich]
  if (removalPct > STRIP_OVER_REMOVAL_WARN_PCT) {
    console.warn("[strip-artifacts.stripArtifacts] Aggressive stripping:", {
      charsBeforeStrip,
      charsAfterStrip,
      removalPct,
      thresholdPct: STRIP_OVER_REMOVAL_WARN_PCT,
      artifactsRemoved,
    }); // [debug-enrich]
  }

  const bag = dppNormDbg();
  if (bag) {
    bag.charsBeforeStrip = charsBeforeStrip;
    bag.charsAfterStrip = charsAfterStrip;
  }

  return {
    blocks: cleaned,
    artifactsRemoved,
    warnings,
  };
}

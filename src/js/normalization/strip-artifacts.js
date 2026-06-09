/**
 * Artifact removal: page numbers, running headers/footers (artifact-removal.md).
 */

/** @typedef {import("./types.js").TextBlock} TextBlock */

const DEFAULT_HEADER_RATIO = 0.1;
const DEFAULT_FOOTER_RATIO = 0.1;

const PAGE_NUMBER_PATTERNS = [
  { re: /^\d{1,4}$/, code: "page_number" },
  { re: /^[-–—]\s*\d{1,4}\s*[-–—]$/, code: "page_number_decorated" },
  { re: /^page\s+\d+(\s+of\s+\d+)?$/i, code: "page_number_labeled" },
  { re: /^p\.?\s*\d+$/i, code: "page_number_short" },
  { re: /^\d+\s*\/\s*\d+$/, code: "page_fraction" },
  { re: /^[ivxlcdm]+$/i, code: "page_number_roman" },
];

const EDITORIAL_PATTERNS = [
  /doi\.org/i,
  /\bdoi:\s*\S+/i,
  /©|copyright/i,
  /downloaded by \[/i,
  /\bspringer\b/i,
  /\belsevier\b/i,
  /cambridge university press/i,
];

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

/**
 * @param {TextBlock[]} blocks
 * @param {{ format?: string, pageHeights?: number[], headerZoneRatio?: number, footerZoneRatio?: number, headingBlockIds?: Set<string> }} [opts]
 */
export function stripArtifacts(blocks, opts = {}) {
  const headerRatio = opts.headerZoneRatio ?? DEFAULT_HEADER_RATIO;
  const footerRatio = opts.footerZoneRatio ?? DEFAULT_FOOTER_RATIO;
  const pageHeights = opts.pageHeights || [];
  const headingIds = opts.headingBlockIds || new Set();
  const warnings = [];
  let artifactsRemoved = 0;
  let bodyZoneRejections = 0;

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

    const pageHeight = pageHeights[block.pageIndex] || defaultPageHeight;
    const lines = String(block.text || "").split(/\n/);
    const protectedCentral =
      block.bbox &&
      isInCentralZone(block, pageHeight) &&
      lines.some((ln) => ln.trim().split(/\s+/).filter(Boolean).length >= 4);

    if (protectedCentral) return block;
    if (headingIds.has(block.id)) return block;
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
      if (matchEditorial(trimmed) && (inZone || trimmed.length < 80)) {
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
      artifactsRemoved += 1;
      return { ...block, kind: "artifact" };
    }

    return block;
  });

  if (bodyZoneRejections >= 5) {
    warnings.push("layout_complex");
  }

  return {
    blocks: result,
    artifactsRemoved,
    warnings,
  };
}

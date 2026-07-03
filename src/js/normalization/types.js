/**
 * Structure inference data types (specs/20260531-structure-inference/data-model.md)
 */

/** @typedef {"pdf"|"html"|"txt"|"md"} BlockSource */

/** @typedef {"paragraph"|"heading"|"list-item"|"artifact"|"unknown"} BlockKind */

/**
 * @typedef {Object} BBox
 * @property {number} x
 * @property {number} y
 * @property {number} width
 * @property {number} height
 */

/**
 * @typedef {Object} TextBlock
 * @property {string} id
 * @property {string} text
 * @property {number} fontSize
 * @property {number|"bold"|"normal"} fontWeight
 * @property {BBox} [bbox]
 * @property {number} pageIndex
 * @property {number} lineIndex
 * @property {BlockSource} source
 * @property {BlockKind} kind
 */

/**
 * @typedef {Object} HeadingCandidate
 * @property {string} label
 * @property {1|2|3|4|5|6} level
 * @property {number} score
 * @property {"outline"|"font-size"|"pattern"|"html-tag"|"html-heuristic"|"html-inferred"} source
 * @property {string} blockId
 * @property {number} charStart
 * @property {number} charEnd
 */

/**
 * @typedef {Object} ArtifactPattern
 * @property {string} code
 * @property {string} match
 * @property {number} [pageIndex]
 * @property {"zone"|"repetition"|"regex"} reason
 */

/**
 * @typedef {Object} StructureReport
 * @property {number} headingCount
 * @property {number} [bodyFontSize]
 * @property {"high"|"medium"|"low"} confidence
 * @property {number} artifactsRemoved
 * @property {string[]} warnings
 */

/**
 * @typedef {Object} HierarchyNode
 * @property {string} title
 * @property {1|2|3} level
 * @property {number} startOffset
 * @property {number} endOffset
 * @property {string} [summary]
 * @property {HierarchyNode[]} children
 */

let blockSeq = 0;

/** @param {Partial<TextBlock> & Pick<TextBlock, "text"|"source">} partial */
export function createTextBlock(partial) {
  blockSeq += 1;
  return {
    id: partial.id || `blk-${blockSeq}`,
    text: String(partial.text || ""),
    fontSize: Number(partial.fontSize) >= 0 ? Number(partial.fontSize) : 0,
    fontWeight: partial.fontWeight ?? "normal",
    bbox: partial.bbox,
    pageIndex: Number(partial.pageIndex) || 0,
    lineIndex: Number(partial.lineIndex) || 0,
    source: partial.source,
    kind: partial.kind || "paragraph",
  };
}

/** Reset id sequence (tests). */
export function resetBlockIdSequence() {
  blockSeq = 0;
}

/** @returns {StructureReport} */
export function emptyStructureReport() {
  return {
    headingCount: 0,
    confidence: "low",
    artifactsRemoved: 0,
    warnings: [],
  };
}

/**
 * @param {Partial<StructureReport>} partial
 * @returns {StructureReport}
 */
export function createStructureReport(partial = {}) {
  return {
    headingCount: partial.headingCount ?? 0,
    bodyFontSize: partial.bodyFontSize,
    confidence: partial.confidence ?? "low",
    artifactsRemoved: partial.artifactsRemoved ?? 0,
    warnings: Array.isArray(partial.warnings) ? [...partial.warnings] : [],
  };
}

/**
 * @param {HeadingCandidate[]} headings
 * @param {number} totalChars
 * @returns {"high"|"medium"|"low"}
 */
export function aggregateConfidence(headings, totalChars) {
  const hasOutline = headings.some((h) => h.source === "outline");
  const strong = headings.filter((h) => h.score >= 50);
  if (hasOutline || strong.length >= 3) return "high";
  if (headings.length >= 1 && headings.length <= 2) return "medium";
  if (headings.length > 0 && headings.every((h) => h.score >= 35 && h.score < 50)) {
    return "medium";
  }
  if (totalChars > 5000 && headings.length === 0) return "low";
  if (headings.length > 0) return "medium";
  return "low";
}

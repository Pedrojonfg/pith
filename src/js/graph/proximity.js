/** Argument-map ↔ annotation linking (char proximity + page/block + text overlap). */

import { STEELMAN_BLOCK_RADIUS, blockIndexFromId } from "../slow/annotations.js";
import { splitTextIntoBlocks } from "../slow/block-ids.js";

/** Max char distance between annotation midpoint and resolved map anchor. */
export const CHAR_PROXIMITY_CHARS = 200;

/** @deprecated Use CHAR_PROXIMITY_CHARS — still imported by slow/phase3.js */
export const PROXIMITY = CHAR_PROXIMITY_CHARS;

/** Min Jaccard-style token overlap to accept a text-based match (0–1). */
export const MIN_TEXT_OVERLAP_SCORE = 0.12;

/** unvalidated placeholder — max PDF page delta for graph linking (R-GR-4). */
export const GRAPH_PAGE_DELTA_MAX = 1;

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

function annotationIsNewShape(ann) {
  return Boolean(ann?.anchor?.kind);
}

function annotationMid(ann) {
  if (ann?.anchor?.kind === "block-offset") {
    return (Number(ann.anchor.charStart) + Number(ann.anchor.charEnd)) / 2;
  }
  return (Number(ann?.charStart) + Number(ann?.charEnd)) / 2;
}

export function tokenizeForOverlap(text) {
  const raw = String(text || "").toLowerCase();
  const tokens = raw.match(TOKEN_RE) || [];
  return new Set(tokens.filter((t) => t.length >= 3));
}

/** Jaccard similarity on word tokens (lightweight semantic proxy). */
export function textOverlapScore(a, b) {
  const setA = tokenizeForOverlap(a);
  const setB = tokenizeForOverlap(b);
  if (!setA.size || !setB.size) return 0;
  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter += 1;
  }
  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function annotationContextSnippet(scopeText, ann, radius = 140) {
  if (ann?.snippet) return String(ann.snippet);
  const text = String(scopeText || "");
  if (!text.length || !ann) return "";
  const start = Math.max(0, Math.floor(Number(ann.charStart) || 0) - radius);
  const end = Math.min(text.length, Math.ceil(Number(ann.charEnd) || start) + radius);
  return text.slice(start, end);
}

function findBlockIdForNeedle(blocks, needle) {
  const n = String(needle || "").trim().toLowerCase();
  if (!n || n.length < 3) return null;
  for (const b of blocks) {
    if (String(b.text || "").toLowerCase().includes(n)) return b.blockId;
  }
  const words = n.split(/\s+/).filter((w) => w.length >= 5);
  for (const word of words) {
    for (const b of blocks) {
      if (String(b.text || "").toLowerCase().includes(word)) return b.blockId;
    }
  }
  return null;
}

/**
 * Resolve viewer-mode position for an argument-map node (page or blockId).
 * @returns {{ page: number|null, blockId: string|null, source: string } | null}
 */
function resolveNodeViewerPos(node, scopeText, fillableBlanks, annotations) {
  const nodeId = String(node?.id || "").trim();
  const blanks = Array.isArray(fillableBlanks) ? fillableBlanks : [];
  const anns = Array.isArray(annotations) ? annotations : [];
  const linkedBlank = blanks.find((b) => b?.nodeId === nodeId && b?.annotationId);
  if (linkedBlank) {
    const ann = anns.find((a) => a.id === linkedBlank.annotationId);
    if (ann && !ann.orphaned) {
      if (ann?.anchor?.kind === "pdf-rect") {
        return { page: Number(ann.anchor.page), blockId: null, source: "fillable" };
      }
      if (ann?.anchor?.kind === "block-offset") {
        return { page: null, blockId: ann.anchor.blockId, source: "fillable" };
      }
    }
    if (linkedBlank.pdfPage != null) {
      return { page: Number(linkedBlank.pdfPage), blockId: null, source: "fillable" };
    }
    if (linkedBlank.blockId) {
      return { page: null, blockId: linkedBlank.blockId, source: "fillable" };
    }
  }
  if (scopeText) {
    const blocks = splitTextIntoBlocks(scopeText);
    const blockId = findBlockIdForNeedle(blocks, node?.text);
    if (blockId) return { page: null, blockId, source: "text" };
  }
  return null;
}

function viewerDistance(ann, nodePos) {
  if (!nodePos) return Infinity;
  if (ann?.anchor?.kind === "pdf-rect") {
    if (nodePos.page == null) return Infinity;
    return Math.abs(Number(ann.anchor.page) - Number(nodePos.page));
  }
  if (ann?.anchor?.kind === "block-offset") {
    if (!nodePos.blockId) return Infinity;
    const bi = blockIndexFromId(ann.anchor.blockId);
    const ni = blockIndexFromId(nodePos.blockId);
    if (bi < 0 || ni < 0) return Infinity;
    return Math.abs(bi - ni);
  }
  return Infinity;
}

function viewerProximityMax(ann) {
  // unvalidated placeholder — pdf adjacency vs scroll block radius (R-GR-4 / R-ANN-2)
  if (ann?.anchor?.kind === "pdf-rect") return GRAPH_PAGE_DELTA_MAX;
  return STEELMAN_BLOCK_RADIUS;
}

/**
 * Resolve scope char offset for an argument-map node.
 * Priority: fillable blank annotation → text search in scope → keyword.
 */
export function resolveArgumentMapNodeAnchor(node, scopeText, fillableBlanks, annotations) {
  const nodeId = String(node?.id || "").trim();
  const blanks = Array.isArray(fillableBlanks) ? fillableBlanks : [];
  const anns = Array.isArray(annotations) ? annotations : [];
  const text = String(scopeText || "");

  const linkedBlank = blanks.find((b) => b?.nodeId === nodeId && b?.annotationId);
  if (linkedBlank) {
    const ann = anns.find((a) => a.id === linkedBlank.annotationId);
    if (ann) {
      return {
        anchor: annotationMid(ann),
        source: "fillable",
        pageIndex: linkedBlank.pageIndex,
      };
    }
  }

  const needle = String(node?.text || "").trim();
  if (needle.length >= 4 && text.length) {
    const lowerScope = text.toLowerCase();
    const lowerNeedle = needle.toLowerCase();
    let idx = lowerScope.indexOf(lowerNeedle);
    if (idx >= 0) {
      return { anchor: idx + needle.length / 2, source: "text", pageIndex: null };
    }
    const words = needle.split(/\s+/).filter((w) => w.length >= 5);
    for (const word of words) {
      idx = lowerScope.indexOf(word.toLowerCase());
      if (idx >= 0) {
        return { anchor: idx + word.length / 2, source: "keyword", pageIndex: null };
      }
    }
  }

  return { anchor: null, source: "unknown", pageIndex: null };
}

/**
 * Find best argument-map node for an annotation.
 * New-shape: page-delta or block-index-delta (placeholders).
 * Legacy: char proximity within CHAR_PROXIMITY_CHARS, then token overlap.
 * @returns {{ nodeId: string|null, method: 'char'|'block'|'page'|'text'|null, score?: number, distance?: number }}
 */
export function findNearestArgumentMapNode(
  ann,
  {
    argumentMap = [],
    scopeText = "",
    fillableBlanks = [],
    annotations = [],
    charProximity = CHAR_PROXIMITY_CHARS,
    minTextOverlap = MIN_TEXT_OVERLAP_SCORE,
  } = {},
) {
  const map = Array.isArray(argumentMap) ? argumentMap : [];
  if (!map.length || !ann) return { nodeId: null, method: null };

  // Orphans: skip position proximity; text-overlap linking below may still apply.
  if (!ann.orphaned && annotationIsNewShape(ann)) {
    const maxDelta = viewerProximityMax(ann);
    const method = ann.anchor?.kind === "pdf-rect" ? "page" : "block";
    let bestId = null;
    let bestDist = Infinity;
    for (const node of map) {
      const nodePos = resolveNodeViewerPos(node, scopeText, fillableBlanks, annotations);
      const dist = viewerDistance(ann, nodePos);
      if (dist <= maxDelta && dist < bestDist) {
        bestDist = dist;
        bestId = String(node?.id || "").trim() || null;
      }
    }
    if (bestId) {
      return { nodeId: bestId, method, distance: bestDist };
    }
  } else if (!ann.orphaned) {
    const mid = annotationMid(ann);
    let bestCharId = null;
    let bestCharDist = Infinity;

    for (const node of map) {
      const resolved = resolveArgumentMapNodeAnchor(node, scopeText, fillableBlanks, annotations);
      if (resolved.anchor == null) continue;
      const dist = Math.abs(resolved.anchor - mid);
      if (dist <= charProximity && dist < bestCharDist) {
        bestCharDist = dist;
        bestCharId = String(node?.id || "").trim() || null;
      }
    }

    if (bestCharId) {
      return { nodeId: bestCharId, method: "char", distance: bestCharDist };
    }
  }

  const userText = String(ann?.userText || "").trim();
  const snippet = annotationContextSnippet(scopeText, ann);
  if (!userText && !snippet) return { nodeId: null, method: null };

  let bestTextId = null;
  let bestScore = 0;

  for (const node of map) {
    const nodeText = String(node?.text || "").trim();
    if (!nodeText) continue;
    const score = Math.max(
      textOverlapScore(userText, nodeText),
      snippet ? textOverlapScore(snippet, nodeText) : 0,
    );
    if (score >= minTextOverlap && score > bestScore) {
      bestScore = score;
      bestTextId = String(node?.id || "").trim() || null;
    }
  }

  if (bestTextId) {
    return { nodeId: bestTextId, method: "text", score: bestScore };
  }

  return { nodeId: null, method: null };
}

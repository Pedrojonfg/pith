/** Argument-map ↔ annotation linking (char proximity + text overlap fallback). */

/** Max char distance between annotation midpoint and resolved map anchor. */
export const CHAR_PROXIMITY_CHARS = 200;

/** @deprecated Use CHAR_PROXIMITY_CHARS */
export const PROXIMITY = CHAR_PROXIMITY_CHARS;

/** Min Jaccard-style token overlap to accept a text-based match (0–1). */
export const MIN_TEXT_OVERLAP_SCORE = 0.12;

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

function annotationMid(ann) {
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
  const text = String(scopeText || "");
  if (!text.length || !ann) return "";
  const start = Math.max(0, Math.floor(Number(ann.charStart) || 0) - radius);
  const end = Math.min(text.length, Math.ceil(Number(ann.charEnd) || start) + radius);
  return text.slice(start, end);
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
 * 1) Char proximity within CHAR_PROXIMITY_CHARS
 * 2) Token overlap on userText + local scope snippet vs node text
 * @returns {{ nodeId: string|null, method: 'char'|'text'|null, score?: number, distance?: number }}
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

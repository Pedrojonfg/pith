import { LITERATURE_TERM_ID } from "../graph/ids.js?v=20260625_02";
import { resolveBlockOffset, splitTextIntoBlocks } from "./block-ids.js";

/** Annotation types registry — FR-004, FR-013, FR-016 */

export const IA_QUERY_TYPE = "ia-query";

/** Unvalidated placeholder — scroll steel-man proximity in blocks (R-ANN-2). */
export const STEELMAN_BLOCK_RADIUS = 3;

export const ANNOTATION_TYPES = [
  { symbol: "≈", id: "approx", tier: "primary", criticalMenu: false, label: "Paraphrase", hotkey: "1" },
  { symbol: "?", id: "question", tier: "primary", criticalMenu: false, label: "Question", hotkey: "2" },
  { symbol: "→", id: "explain", tier: "primary", criticalMenu: false, label: "Self-explain", hotkey: "3" },
  { symbol: "⟷", id: "link", tier: "primary", criticalMenu: false, label: "Connection", hotkey: "4" },
  { symbol: "⚑", id: "flag", tier: "primary", criticalMenu: false, label: "Ask AI", hotkey: "5" },
  { symbol: "⊘", id: "reject", tier: "critical", criticalMenu: true, label: "Objection", hotkey: "6" },
  { symbol: "↯", id: "tension", tier: "critical", criticalMenu: true, label: "Tension", hotkey: "7" },
  { symbol: "⚠", id: "weak", tier: "critical", criticalMenu: true, label: "Weakness", hotkey: "8" },
  { symbol: "★", id: "strong", tier: "critical", criticalMenu: true, label: "Strength", hotkey: "9" },
  { symbol: "⇑", id: "steel", tier: "critical", criticalMenu: true, label: "Steel man", hotkey: "0" },
  { symbol: "📌", id: "pin", tier: "secondary", criticalMenu: false, label: "Pin", hotkey: "p" },
  { symbol: "⚡", id: "insight", tier: "secondary", criticalMenu: false, label: "Insight", hotkey: "i" },
  { symbol: "↩", id: "return", tier: "secondary", criticalMenu: false, label: "Return", hotkey: "r" },
  { symbol: "🔗", id: "graph", tier: "secondary", criticalMenu: false, label: "Graph", hotkey: "g" },
];

export function visibleAnnotationTypes(criticalMode, { showSecondary = false } = {}) {
  return ANNOTATION_TYPES.filter((t) => {
    if (t.tier === "primary") return true;
    if (t.tier === "critical" && criticalMode) return true;
    if (t.tier === "secondary" && showSecondary) return true;
    return false;
  });
}

export function findAnnotationTypeByHotkey(key, criticalMode, { showSecondary = false } = {}) {
  const k = String(key ?? "").toLowerCase();
  if (!k) return null;
  return visibleAnnotationTypes(criticalMode, { showSecondary }).find((t) => t.hotkey === k) || null;
}

export function newAnnotationId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `a_${Date.now().toString(36)}`;
}

export function isIAQueryAnnotation(ann) {
  if (!ann) return false;
  if (ann.type === IA_QUERY_TYPE || ann.isIAQuery) return true;
  return (ann.type === "⚑" || ann.type === "⇑") && Boolean(ann.aiReply);
}

export function blockIndexFromId(blockId) {
  const m = String(blockId || "").match(/^b(\d+)$/i);
  return m ? Number(m[1]) : -1;
}

/**
 * Resolve legacy global offsets or explicit anchor into v2 shape.
 * @returns {{ anchor: object, snippet: string } | null}
 */
export function resolveCreateAnchor(session, opts = {}) {
  const snippetIn = String(opts.snippet || "").trim();
  if (opts.anchor && typeof opts.anchor === "object" && opts.anchor.kind) {
    if (!snippetIn) return null;
    return { anchor: { ...opts.anchor }, snippet: snippetIn };
  }

  // Legacy shim: charStart/charEnd → block-offset + snippet
  if (!Number.isFinite(Number(opts.charStart)) && !Number.isFinite(Number(opts.charEnd))) {
    return null;
  }
  const text = String(session?.slow?.normalizedTextFull || "");
  const max = text.length;
  const start = Math.max(0, Math.floor(Number(opts.charStart) || 0));
  const end = Math.min(max, Math.max(start + 1, Math.floor(Number(opts.charEnd) || start + 1)));
  const snippet = snippetIn || text.slice(start, end);
  if (!String(snippet).trim()) return null;
  const blocks = splitTextIntoBlocks(text);
  const local = resolveBlockOffset(blocks, start, end);
  if (!local) {
    return {
      anchor: {
        kind: "block-offset",
        blockId: blocks[0]?.blockId || "b0",
        charStart: 0,
        charEnd: 0,
      },
      snippet: String(snippet).trim(),
      orphaned: true,
    };
  }
  return {
    anchor: { kind: "block-offset", ...local },
    snippet: String(snippet).trim(),
  };
}

export async function addAnnotation(session, opts = {}) {
  if (!session?.slow) return null;
  const resolved = resolveCreateAnchor(session, opts);
  if (!resolved) return null;

  const entry = {
    id: newAnnotationId(),
    type: String(opts.type || "≈"),
    anchor: resolved.anchor,
    snippet: resolved.snippet,
    userText: String(opts.userText || "").trim(),
    createdAt: Date.now(),
    aiReply: opts.aiReply != null ? String(opts.aiReply) : null,
    graphLinks: [],
  };
  if (opts.type === IA_QUERY_TYPE) entry.isIAQuery = true;
  if (resolved.orphaned) entry.orphaned = true;

  if (!Array.isArray(session.slow.annotations)) session.slow.annotations = [];
  session.slow.annotations.push(entry);
  // ponytail: no shared.annotations dual-write (FR-013 / T09)
  return entry;
}

export async function addIAQueryAnnotation(session, { userText, anchor, snippet, charStart, charEnd, aiReply = null } = {}) {
  return await addAnnotation(session, {
    type: IA_QUERY_TYPE,
    anchor,
    snippet,
    charStart,
    charEnd,
    userText,
    aiReply,
  });
}

export function updateAnnotation(session, id, patch) {
  const list = session?.slow?.annotations;
  if (!Array.isArray(list)) return null;
  const idx = list.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  list[idx] = { ...list[idx], ...patch };
  return list[idx];
}

export function deleteAnnotation(session, id) {
  const list = session?.slow?.annotations;
  if (!Array.isArray(list)) return false;
  const next = list.filter((a) => a.id !== id);
  if (next.length === list.length) return false;
  session.slow.annotations = next;
  return true;
}

export function findAnnotation(session, id) {
  const list = session?.slow?.annotations;
  if (!Array.isArray(list)) return null;
  return list.find((a) => a.id === id) || null;
}

/** @returns {{ termId: string, relation: string } | null} */
export function addGraphLink(session, annotationId, { termId, relation } = {}) {
  const ann = findAnnotation(session, annotationId);
  if (!ann) return null;
  const tid = String(termId || "").trim();
  if (!tid) return null;
  const entry = { termId: tid, relation: String(relation || "").trim() };
  if (!Array.isArray(ann.graphLinks)) ann.graphLinks = [];
  ann.graphLinks.push(entry);
  return entry;
}

export function addLiteratureGraphLink(session, annotationId, note) {
  const rel = String(note || "").trim();
  if (!rel) return null;
  return addGraphLink(session, annotationId, { termId: LITERATURE_TERM_ID, relation: rel });
}

/** Legacy global-offset helper + block-offset mapped via optional globalStart on ann. */
export function annotationsOnPage(annotations, pageSlice) {
  const { charStart, charEnd } = pageSlice;
  return (annotations || []).filter((a) => {
    if (a?.orphaned) return false;
    if (a?.anchor?.kind === "block-offset") {
      // When highlight path maps locals onto a 0-based block slice, treat like local.
      const aStart = Number(a.charStart ?? a.anchor.charStart) || 0;
      const aEnd = Number(a.charEnd ?? a.anchor.charEnd) || aStart;
      return aEnd > charStart && aStart < charEnd;
    }
    return a.charEnd > charStart && a.charStart < charEnd;
  });
}

/** CSS slug per annotation type for inline highlights (one distinct color each). */
export const ANNOTATION_HIGHLIGHT_CLASS = {
  "≈": "approx",
  "?": "question",
  "→": "explain",
  "⟷": "link",
  "⚑": "flag",
  "⊘": "reject",
  "↯": "tension",
  "⚠": "weak",
  "★": "strong",
  "⇑": "steel",
  "📌": "pin",
  "⚡": "insight",
  "↩": "return",
  "🔗": "graph",
  [IA_QUERY_TYPE]: "ia-query",
};

export function annotationHighlightClass(type) {
  return ANNOTATION_HIGHLIGHT_CLASS[type] || "default";
}

export function annotationMarkClass(type) {
  if (["⊘", "↯", "⚠"].includes(type)) return "critical";
  return annotationHighlightClass(type);
}

/** When several annotations cover the same span, prefer the most recent. */
export function pickPrimaryAnnotation(covering) {
  if (!Array.isArray(covering) || !covering.length) return null;
  if (covering.length === 1) return covering[0];
  return covering.reduce((a, b) => ((a.createdAt || 0) >= (b.createdAt || 0) ? a : b));
}

/**
 * Build nested highlight spans (inner = older, outer = newer) for layered overlap tint.
 * @param {Document} doc
 * @param {Node} contents — text or fragment to wrap
 */
export function createNestedHighlightSpans(covering, doc, contents) {
  const sorted = [...covering].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  let current = contents;
  for (const ann of sorted) {
    const span = doc.createElement("span");
    span.className = `slow-ann-highlight slow-ann-highlight--${annotationHighlightClass(ann.type)}`;
    span.dataset.annId = ann.id;
    span.title = ann.userText || ann.type;
    span.appendChild(current);
    current = span;
  }
  return current;
}

/**
 * Split page plain text into segments with covering annotations (for inline highlights).
 * Accepts legacy top-level charStart/charEnd or mapped locals on the ann object.
 * @returns {Array<{ segStart: number, segEnd: number, text: string, covering: object[] }>}
 */
export function buildAnnotationHighlightSegments(pageSlice, slicePlain, annotations) {
  const anns = annotationsOnPage(annotations, pageSlice)
    .map((a) => {
      const aStart = Number(a.charStart ?? a.anchor?.charStart) || 0;
      const aEnd = Number(a.charEnd ?? a.anchor?.charEnd) || aStart;
      return {
        ...a,
        localStart: aStart - pageSlice.charStart,
        localEnd: aEnd - pageSlice.charStart,
      };
    })
    .filter((a) => a.localStart < a.localEnd);
  if (!anns.length) return [];

  const pageLen = slicePlain.length;
  const boundaries = new Set([0, pageLen]);
  for (const a of anns) {
    boundaries.add(a.localStart);
    boundaries.add(a.localEnd);
  }
  const points = [...boundaries].sort((x, y) => x - y);
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segStart >= segEnd) continue;
    const covering = anns.filter((a) => a.localStart <= segStart && a.localEnd >= segEnd);
    segments.push({
      segStart,
      segEnd,
      text: slicePlain.slice(segStart, segEnd),
      covering,
    });
  }
  return segments;
}

/**
 * Find snippet in blocks starting at ±initialRadius from origin, expanding until exhausted (R-SCR-7).
 * @param {{ blockId: string, text: string }[]} blocks
 * @returns {{ blockId: string, charStart: number, charEnd: number } | null}
 */
export function findSnippetInBlocks(blocks, snippet, originIndex, initialRadius = STEELMAN_BLOCK_RADIUS) {
  const needle = String(snippet || "");
  if (!needle || !Array.isArray(blocks) || !blocks.length) return null;
  const n = blocks.length;
  const origin = Number.isFinite(originIndex) && originIndex >= 0 ? originIndex : 0;
  const searched = new Set();

  for (let radius = initialRadius; ; radius += initialRadius) {
    const lo = Math.max(0, origin - radius);
    const hi = Math.min(n - 1, origin + radius);
    for (let i = lo; i <= hi; i += 1) {
      if (searched.has(i)) continue;
      searched.add(i);
      const idx = String(blocks[i].text || "").indexOf(needle);
      if (idx >= 0) {
        return {
          blockId: blocks[i].blockId,
          charStart: idx,
          charEnd: idx + needle.length,
        };
      }
    }
    if (searched.size >= n) break;
  }
  return null;
}

/**
 * Repair block-offset annotations against current block texts (R-SCR-7).
 * Mutates annotations in place.
 * @param {{ slow?: { annotations?: object[] } }} session
 * @param {{ blockId: string, text: string }[]} blocks
 * @returns {{ repaired: number, orphaned: number }}
 */
export function repairScrollAnnotations(session, blocks) {
  const list = session?.slow?.annotations;
  if (!Array.isArray(list) || !Array.isArray(blocks)) {
    return { repaired: 0, orphaned: 0 };
  }
  let repaired = 0;
  let orphaned = 0;

  for (const ann of list) {
    if (ann?.anchor?.kind !== "block-offset") continue;
    const snippet = String(ann.snippet || "");
    if (!snippet) {
      ann.orphaned = true;
      orphaned += 1;
      continue;
    }

    const block = blocks.find((b) => b.blockId === ann.anchor.blockId);
    if (block) {
      const local = String(block.text || "").slice(ann.anchor.charStart, ann.anchor.charEnd);
      if (local === snippet) {
        if (ann.orphaned) delete ann.orphaned;
        continue;
      }
      const sameIdx = String(block.text || "").indexOf(snippet);
      if (sameIdx >= 0) {
        ann.anchor.charStart = sameIdx;
        ann.anchor.charEnd = sameIdx + snippet.length;
        if (ann.orphaned) delete ann.orphaned;
        repaired += 1;
        continue;
      }
    }

    const origin = blockIndexFromId(ann.anchor.blockId);
    const hit = findSnippetInBlocks(blocks, snippet, origin, STEELMAN_BLOCK_RADIUS);
    if (hit) {
      ann.anchor = { kind: "block-offset", ...hit };
      if (ann.orphaned) delete ann.orphaned;
      repaired += 1;
    } else {
      ann.orphaned = true;
      orphaned += 1;
    }
  }

  return { repaired, orphaned };
}

/** Collect {blockId, text} from a rendered root with data-block-id nodes. */
export function collectBlockTextsFromRoot(root) {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll("[data-block-id]")).map((el) => ({
    blockId: el.getAttribute("data-block-id"),
    text: el.textContent || "",
  }));
}

/** Critical types that trigger steel-man nudge on confirm (T07). */
export const STEELMAN_NUDGE_TYPES = new Set(["⊘", "↯", "⚠"]);

/** Prior annotation types that satisfy steel-man prerequisite (T07). */
export const STEELMAN_PRECURSOR_TYPES = new Set(["⇑", "≈"]);

function steelManBlockNearby(annotations, targetAnn) {
  const origin = blockIndexFromId(targetAnn?.anchor?.blockId);
  if (origin < 0) return false;
  const list = Array.isArray(annotations) ? annotations : [];
  return list.some((a) => {
    if (a.id === targetAnn.id) return false;
    if (!STEELMAN_PRECURSOR_TYPES.has(a.type)) return false;
    if (!String(a.userText || "").trim()) return false;
    if (a.anchor?.kind !== "block-offset") return false;
    const bi = blockIndexFromId(a.anchor.blockId);
    return bi >= 0 && Math.abs(bi - origin) <= STEELMAN_BLOCK_RADIUS;
  });
}

/**
 * True if a ⇑/≈ annotation with user text exists nearby.
 * Scroll block-offset: within STEELMAN_BLOCK_RADIUS blocks.
 * Legacy / other: ±windowChars on global offsets.
 */
export function hasSteelManPrecursorNearby(annotations, targetAnn, windowChars = 500) {
  if (!targetAnn) return false;
  if (targetAnn.anchor?.kind === "block-offset") {
    return steelManBlockNearby(annotations, targetAnn);
  }
  const list = Array.isArray(annotations) ? annotations : [];
  const lo = Math.max(0, (Number(targetAnn.charStart) || 0) - windowChars);
  const hi = (Number(targetAnn.charEnd) || 0) + windowChars;
  return list.some((a) => {
    if (a.id === targetAnn.id) return false;
    if (!STEELMAN_PRECURSOR_TYPES.has(a.type)) return false;
    if (!String(a.userText || "").trim()) return false;
    if (a.anchor?.kind === "block-offset") return false;
    const aStart = Number(a.charStart) || 0;
    const aEnd = Number(a.charEnd) || aStart;
    return aEnd > lo && aStart < hi;
  });
}

export function shouldShowSteelManNudge(annotations, targetAnn, windowChars = 500) {
  if (!targetAnn || !STEELMAN_NUDGE_TYPES.has(targetAnn.type)) return false;
  return !hasSteelManPrecursorNearby(annotations, targetAnn, windowChars);
}

import { LITERATURE_TERM_ID } from "../graph/ids.js?v=20260625_02";
import { addAnnotationToShared, getActiveSession } from "../session-store.js";

/** Annotation types registry � FR-004, FR-013, FR-016 */

export const IA_QUERY_TYPE = "ia-query";

export const ANNOTATION_TYPES = [
  { symbol: "�", id: "approx", tier: "primary", criticalMenu: false, label: "Paraphrase", hotkey: "1" },
  { symbol: "?", id: "question", tier: "primary", criticalMenu: false, label: "Question", hotkey: "2" },
  { symbol: "?", id: "explain", tier: "primary", criticalMenu: false, label: "Self-explain", hotkey: "3" },
  { symbol: "?", id: "link", tier: "primary", criticalMenu: false, label: "Connection", hotkey: "4" },
  { symbol: "?", id: "flag", tier: "primary", criticalMenu: false, label: "Ask AI", hotkey: "5" },
  { symbol: "?", id: "reject", tier: "critical", criticalMenu: true, label: "Objection", hotkey: "6" },
  { symbol: "?", id: "tension", tier: "critical", criticalMenu: true, label: "Tension", hotkey: "7" },
  { symbol: "?", id: "weak", tier: "critical", criticalMenu: true, label: "Weakness", hotkey: "8" },
  { symbol: "?", id: "strong", tier: "critical", criticalMenu: true, label: "Strength", hotkey: "9" },
  { symbol: "?", id: "steel", tier: "critical", criticalMenu: true, label: "Steel man", hotkey: "0" },
  { symbol: "??", id: "pin", tier: "secondary", criticalMenu: false, label: "Pin", hotkey: "p" },
  { symbol: "?", id: "insight", tier: "secondary", criticalMenu: false, label: "Insight", hotkey: "i" },
  { symbol: "?", id: "return", tier: "secondary", criticalMenu: false, label: "Return", hotkey: "r" },
  { symbol: "??", id: "graph", tier: "secondary", criticalMenu: false, label: "Graph", hotkey: "g" },
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
  return (ann.type === "?" || ann.type === "?") && Boolean(ann.aiReply);
}

export async function addAnnotation(session, { type, charStart, charEnd, userText = "", aiReply = null }) {
  if (!session?.slow) return null;
  const scopeLen =
    Number(session.slow.readingScope?.charEnd) - Number(session.slow.readingScope?.charStart);
  const max = scopeLen > 0 ? scopeLen : String(session.slow.normalizedTextFull || "").length;
  const start = Math.max(0, Math.floor(Number(charStart) || 0));
  const end = Math.min(max, Math.max(start + 1, Math.floor(Number(charEnd) || start + 1)));
  const entry = {
    id: newAnnotationId(),
    type: String(type || "�"),
    charStart: start,
    charEnd: end,
    userText: String(userText || "").trim(),
    createdAt: Date.now(),
    aiReply: aiReply != null ? String(aiReply) : null,
    graphLinks: [],
  };
  if (type === IA_QUERY_TYPE) entry.isIAQuery = true;
  if (!Array.isArray(session.slow.annotations)) session.slow.annotations = [];
  session.slow.annotations.push(entry);
  try {
    const doc = await getActiveSession();
    if (doc?.docId) {
      await addAnnotationToShared(doc.docId, {
        type: entry.type,
        text: entry.userText,
        offset: entry.charStart,
        id: entry.id,
        createdAt: entry.createdAt,
      });
    }
  } catch (err) {
    console.warn("[annotations] shared dual-write failed", err);
  }
  return entry;
}

export async function addIAQueryAnnotation(session, { userText, charStart, charEnd, aiReply = null }) {
  return await addAnnotation(session, {
    type: IA_QUERY_TYPE,
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

export function annotationsOnPage(annotations, pageSlice) {
  const { charStart, charEnd } = pageSlice;
  return (annotations || []).filter(
    (a) => a.charEnd > charStart && a.charStart < charEnd,
  );
}

/** CSS slug per annotation type for inline highlights (one distinct color each). */
export const ANNOTATION_HIGHLIGHT_CLASS = {
  "�": "approx",
  "?": "question",
  "?": "explain",
  "?": "link",
  "?": "flag",
  "?": "reject",
  "?": "tension",
  "?": "weak",
  "?": "strong",
  "?": "steel",
  "??": "pin",
  "?": "insight",
  "?": "return",
  "??": "graph",
  [IA_QUERY_TYPE]: "ia-query",
};

export function annotationHighlightClass(type) {
  return ANNOTATION_HIGHLIGHT_CLASS[type] || "default";
}

export function annotationMarkClass(type) {
  if (["?", "?", "?"].includes(type)) return "critical";
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
 * @param {Node} contents � text or fragment to wrap
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
 * @returns {Array<{ segStart: number, segEnd: number, text: string, covering: object[] }>}
 */
export function buildAnnotationHighlightSegments(pageSlice, slicePlain, annotations) {
  const anns = annotationsOnPage(annotations, pageSlice)
    .map((a) => ({
      ...a,
      localStart: a.charStart - pageSlice.charStart,
      localEnd: a.charEnd - pageSlice.charStart,
    }))
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

/** Critical types that trigger steel-man nudge on confirm (T07). */
export const STEELMAN_NUDGE_TYPES = new Set(["?", "?", "?"]);

/** Prior annotation types that satisfy steel-man prerequisite (T07). */
export const STEELMAN_PRECURSOR_TYPES = new Set(["?", "�"]);

/**
 * True if a ?/� annotation with user text exists within �windowChars of target.
 */
export function hasSteelManPrecursorNearby(annotations, targetAnn, windowChars = 500) {
  if (!targetAnn) return false;
  const list = Array.isArray(annotations) ? annotations : [];
  const lo = Math.max(0, (Number(targetAnn.charStart) || 0) - windowChars);
  const hi = (Number(targetAnn.charEnd) || 0) + windowChars;
  return list.some((a) => {
    if (a.id === targetAnn.id) return false;
    if (!STEELMAN_PRECURSOR_TYPES.has(a.type)) return false;
    if (!String(a.userText || "").trim()) return false;
    const aStart = Number(a.charStart) || 0;
    const aEnd = Number(a.charEnd) || aStart;
    return aEnd > lo && aStart < hi;
  });
}

export function shouldShowSteelManNudge(annotations, targetAnn, windowChars = 500) {
  if (!targetAnn || !STEELMAN_NUDGE_TYPES.has(targetAnn.type)) return false;
  return !hasSteelManPrecursorNearby(annotations, targetAnn, windowChars);
}

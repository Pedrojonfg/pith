/** Annotation types registry — FR-004, FR-013, FR-016 */

export const ANNOTATION_TYPES = [
  { symbol: "≈", id: "approx", tier: "primary", criticalMenu: false, label: "Paraphrase" },
  { symbol: "?", id: "question", tier: "primary", criticalMenu: false, label: "Question" },
  { symbol: "→", id: "explain", tier: "primary", criticalMenu: false, label: "Self-explain" },
  { symbol: "⟷", id: "link", tier: "primary", criticalMenu: false, label: "Connection" },
  { symbol: "⚑", id: "flag", tier: "primary", criticalMenu: false, label: "Ask AI" },
  { symbol: "⊘", id: "reject", tier: "critical", criticalMenu: true, label: "Objection" },
  { symbol: "↯", id: "tension", tier: "critical", criticalMenu: true, label: "Tension" },
  { symbol: "⚠", id: "weak", tier: "critical", criticalMenu: true, label: "Weakness" },
  { symbol: "★", id: "strong", tier: "critical", criticalMenu: true, label: "Strength" },
  { symbol: "⇑", id: "steel", tier: "critical", criticalMenu: true, label: "Steel man" },
  { symbol: "📌", id: "pin", tier: "secondary", criticalMenu: false, label: "Pin" },
  { symbol: "⚡", id: "insight", tier: "secondary", criticalMenu: false, label: "Insight" },
  { symbol: "↩", id: "return", tier: "secondary", criticalMenu: false, label: "Return" },
  { symbol: "🔗", id: "graph", tier: "secondary", criticalMenu: false, label: "Graph" },
];

export function visibleAnnotationTypes(criticalMode, { showSecondary = false } = {}) {
  return ANNOTATION_TYPES.filter((t) => {
    if (t.tier === "primary") return true;
    if (t.tier === "critical" && criticalMode) return true;
    if (t.tier === "secondary" && showSecondary) return true;
    return false;
  });
}

export function newAnnotationId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : `a_${Date.now().toString(36)}`;
}

export function addAnnotation(session, { type, charStart, charEnd, userText = "" }) {
  if (!session?.slow) return null;
  const scopeLen =
    Number(session.slow.readingScope?.charEnd) - Number(session.slow.readingScope?.charStart);
  const max = scopeLen > 0 ? scopeLen : String(session.slow.normalizedTextFull || "").length;
  const start = Math.max(0, Math.floor(Number(charStart) || 0));
  const end = Math.min(max, Math.max(start + 1, Math.floor(Number(charEnd) || start + 1)));
  const entry = {
    id: newAnnotationId(),
    type: String(type || "≈"),
    charStart: start,
    charEnd: end,
    userText: String(userText || "").trim(),
    createdAt: Date.now(),
    aiReply: null,
    graphLinks: [],
  };
  if (!Array.isArray(session.slow.annotations)) session.slow.annotations = [];
  session.slow.annotations.push(entry);
  return entry;
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

export function annotationsOnPage(annotations, pageSlice) {
  const { charStart, charEnd } = pageSlice;
  return (annotations || []).filter(
    (a) => a.charEnd > charStart && a.charStart < charEnd,
  );
}

export function annotationMarkClass(type) {
  const map = {
    "?": "question",
    "≈": "approx",
    "→": "explain",
    "⊘": "critical",
    "↯": "critical",
    "⚠": "critical",
  };
  return map[type] || "approx";
}

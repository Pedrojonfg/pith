/** Shared node id helpers for material graphs (mode-agnostic). */

/** Reserved termId for 🔗 literature links — not a user dictionary term. */
export const LITERATURE_TERM_ID = "literature";

export function conceptNodeId(conceptId) {
  return `concept:${String(conceptId || "").trim()}`;
}

export function blockNodeId(blockId) {
  return `block:${String(blockId || "").trim()}`;
}

export function textNodeId(termId) {
  return `text:${String(termId || "").trim()}`;
}

export function userNodeId(annotationId) {
  return `user:${String(annotationId || "").trim()}`;
}

export function argNodeId(nodeId) {
  return `arg:${String(nodeId || "").trim()}`;
}

export function termNodeId(term) {
  return `term:${graphTermSlug(term)}`;
}

/** Slug for text-layer term ids (shared with Phase 0 graphTermId). */
export function graphTermSlug(term) {
  return String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/gi, "");
}

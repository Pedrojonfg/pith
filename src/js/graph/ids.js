/** Shared node id helpers for material graphs (mode-agnostic). */

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
  return `term:${String(term || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_áéíóúñü-]/gi, "")}`;
}

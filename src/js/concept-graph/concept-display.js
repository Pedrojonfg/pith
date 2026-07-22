/**
 * Display-name / definition fallbacks for inventory + epistemic concept nodes.
 * T1.2 persists title/scope_one_line; Slow/merge paths may use label/definition;
 * legacy graph nodes may use text.
 */

/** Visible concept name: text || label || title || term (same order as graph/cloze adapters). */
export function getConceptDisplayName(node) {
  return String(node?.text || node?.label || node?.title || node?.term || "").trim();
}

/** Concept definition/body: definition || scope_one_line || authorUsage. */
export function getConceptDefinition(node) {
  return String(node?.definition || node?.scope_one_line || node?.authorUsage || "").trim();
}

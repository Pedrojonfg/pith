/**
 * R5 — Knowledge frontier computation.
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import { getAdaptiveProbingFlags } from "../config/flags.js";

function beliefOf(state, id) {
  const b = state?.[id]?.belief;
  return Number.isFinite(Number(b)) ? Number(b) : 0;
}

/**
 * @param {object} graph
 * @param {Record<string, object>} state
 * @param {object} [flags]
 */
export function computeFringes(graph, state, flags = getAdaptiveProbingFlags()) {
  const hi = Number(flags.HIGH_CONFIDENCE_SKIP_THRESHOLD) || 0.9;
  const nodeIds = graph?.nodes || Object.keys(state || {});
  const prereqs = graph?.adjacency?.prerequisites;

  /** @type {string[]} */
  const outerFringe = [];
  /** @type {string[]} */
  const innerFringe = [];

  for (const id of nodeIds) {
    const self = beliefOf(state, id);
    const parents = prereqs?.get(id) || [];
    const allParentsHigh = parents.length > 0 && parents.every((p) => beliefOf(state, p) >= hi);
    const selfBelow = self < hi;

    if (allParentsHigh && selfBelow) {
      outerFringe.push(id);
    }

    if (self >= hi) {
      const hasUnmasteredChild = (graph?.adjacency?.dependents?.get(id) || []).some(
        (child) => beliefOf(state, child) < hi,
      );
      if (hasUnmasteredChild || parents.some((p) => beliefOf(state, p) < hi)) {
        innerFringe.push(id);
      }
    }
  }

  return { outerFringe, innerFringe };
}

/**
 * @param {string[]} ids
 * @param {object[]} inventory
 */
export function labelConcepts(ids, inventory) {
  const byId = new Map(
    (Array.isArray(inventory) ? inventory : []).map((c) => [
      String(c?.id || c?.concept_id || "").trim(),
      String(c?.label || c?.title || c?.term || "").trim() || String(c?.id || ""),
    ]),
  );
  return ids.map((id) => ({ id, label: byId.get(id) || id }));
}

/**
 * Edge weights for block packing (unified concept graph).
 * Tunable placeholders — not calibrated on production data.
 */

/** @type {Readonly<Record<string, number>>} */
export const EDGE_ORDERING_WEIGHTS = Object.freeze({
  prerequisite_of: 1.0,
  exemplifies: 0.4,
  implies: 0,
  causes: 0,
  supports: 0,
  contradicts: 0,
  defines: 0,
  is_a: 0,
  part_of: 0,
});

/** @type {Readonly<Record<string, number>>} */
export const EDGE_AFFINITY_WEIGHTS = Object.freeze({
  part_of: 0.9,
  exemplifies: 0.7,
  contradicts: 0.5,
  prerequisite_of: 0.3,
  implies: 0.1,
  causes: 0.1,
  supports: 0.1,
  defines: 0.1,
  is_a: 0.1,
});

/** Caps structural nudge vs LLM importance (see finalImportance). */
export const STRUCTURAL_BONUS_SCALE = 0.3;

const DEFAULT_UNMAPPED_ORDERING = 0;
const DEFAULT_UNMAPPED_AFFINITY = 0.1;

const _warnedUnmapped = new Set();

function warnUnmapped(type) {
  const key = String(type || "");
  if (!key || _warnedUnmapped.has(key)) return;
  _warnedUnmapped.add(key);
  console.warn(`[packing-weights] unmapped relation type "${key}" — using defaults`);
}

export function getEdgeOrderingWeight(type) {
  const t = String(type || "").trim();
  if (Object.prototype.hasOwnProperty.call(EDGE_ORDERING_WEIGHTS, t)) {
    return EDGE_ORDERING_WEIGHTS[t];
  }
  warnUnmapped(t);
  return DEFAULT_UNMAPPED_ORDERING;
}

export function getEdgeAffinityWeight(type) {
  const t = String(type || "").trim();
  if (Object.prototype.hasOwnProperty.call(EDGE_AFFINITY_WEIGHTS, t)) {
    return EDGE_AFFINITY_WEIGHTS[t];
  }
  warnUnmapped(t);
  return DEFAULT_UNMAPPED_AFFINITY;
}

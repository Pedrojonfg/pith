/**
 * R3 — Bayesian belief propagation on probe answers.
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import { getAdaptiveProbingFlags } from "../config/flags.js";
import { cloneBeliefState } from "./belief-state.js";

const DIRECT_BELIEF = Object.freeze({
  knew: 0.88,
  partial: 0.55,
  missed: 0.15,
});

export const PREPACKING_DONT_KNOW_ANSWER = "I don't know";
export const PREPACKING_ALREADY_KNOW_ANSWER = "I already know this ✓";

function clampBelief(b) {
  return Math.min(0.99, Math.max(0.01, Number(b) || 0.5));
}

function damp(current, target, factor) {
  const c = clampBelief(current);
  const t = clampBelief(target);
  const f = Math.min(1, Math.max(0, Number(factor) || 0.5));
  return clampBelief(c + (t - c) * f);
}

/**
 * @param {number} p
 */
export function binaryEntropy(p) {
  const x = clampBelief(p);
  if (x <= 0.01 || x >= 0.99) return 0;
  return -(x * Math.log2(x) + (1 - x) * Math.log2(1 - x));
}

/**
 * @param {Record<string, object>} state
 * @param {string[]} nodeIds
 */
export function computeGraphEntropy(state, nodeIds) {
  let total = 0;
  for (const id of nodeIds) {
    const b = state[id]?.belief;
    if (b == null) total += binaryEntropy(0.5);
    else total += binaryEntropy(b);
  }
  return total;
}

/**
 * @param {object} graph
 * @param {Record<string, object>} state
 * @param {string} startId
 * @param {'prerequisites'|'dependents'} direction
 * @param {number} targetBelief
 * @param {number} factor
 * @param {string} triggeredBy
 */
function propagateFromNode(graph, state, startId, direction, targetBelief, factor, triggeredBy) {
  const maxHops = Math.max(0, Math.floor(Number(getAdaptiveProbingFlags().MAX_PROPAGATION_HOPS) || 2));
  const adj =
    direction === "prerequisites"
      ? graph.adjacency?.prerequisites
      : graph.adjacency?.dependents;
  if (!adj) return;

  /** @type {Array<{ id: string, hop: number }>} */
  const queue = [{ id: startId, hop: 0 }];
  const visited = new Set();

  while (queue.length) {
    const { id, hop } = queue.shift();
    if (hop >= maxHops) continue;
    const neighbors = adj.get(id) || [];
    for (const nextId of neighbors) {
      const visitKey = `${nextId}:${hop + 1}:${direction}`;
      if (visited.has(visitKey)) continue;
      visited.add(visitKey);

      const current = state[nextId]?.belief ?? 0.5;
      const hopFactor = factor * Math.max(0.35, 1 - hop * 0.2);
      const nextBelief = damp(current, targetBelief, hopFactor);
      state[nextId] = {
        belief: nextBelief,
        lastUpdated: new Date().toISOString(),
        source: "propagated",
        triggeredBy,
      };
      queue.push({ id: nextId, hop: hop + 1 });
    }
  }
}

/**
 * @param {object} graph
 * @param {Record<string, object>} state
 * @param {string} conceptId
 * @param {'knew'|'partial'|'missed'} response
 * @param {object} [flags]
 */
export function updateBeliefs(graph, state, conceptId, response, flags = getAdaptiveProbingFlags()) {
  const id = String(conceptId || "").trim();
  if (!id || !state) return state;
  const resp = String(response || "").trim().toLowerCase();
  const direct = DIRECT_BELIEF[resp] ?? DIRECT_BELIEF.partial;
  const prev = state[id]?.belief ?? 0.5;
  state[id] = {
    belief: damp(prev, direct, 0.85),
    lastUpdated: new Date().toISOString(),
    source: "probe",
  };

  if (!graph?.propagationEnabled) return state;

  const upDamp = Number(flags.UPWARD_PROPAGATION_DAMPING) || 0.6;
  const downDamp = Number(flags.DOWNWARD_PROPAGATION_DAMPING) || 0.8;

  if (resp === "knew") {
    propagateFromNode(graph, state, id, "prerequisites", 0.72, upDamp * 0.55, id);
    propagateFromNode(graph, state, id, "dependents", 0.68, upDamp * 0.45, id);
  } else if (resp === "partial") {
    propagateFromNode(graph, state, id, "prerequisites", 0.58, upDamp * 0.35, id);
    propagateFromNode(graph, state, id, "dependents", 0.55, upDamp * 0.3, id);
  } else if (resp === "missed") {
    propagateFromNode(graph, state, id, "dependents", 0.04, downDamp, id);
  }
  return state;
}

/**
 * Immutable simulation helper for EIG.
 */
export function simulateBeliefUpdate(graph, state, conceptId, response, flags) {
  const nodeIds = graph?.nodes || Object.keys(state);
  const clone = cloneBeliefState(state, nodeIds);
  updateBeliefs(graph, clone, conceptId, response, flags);
  return clone;
}

export { DIRECT_BELIEF };

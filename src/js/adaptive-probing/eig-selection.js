/**
 * R2 — Expected information gain probe selection.
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import { getAdaptiveProbingFlags } from "../config/flags.js";
import { isProbeCandidate, cloneBeliefState } from "./belief-state.js";
import {
  binaryEntropy,
  computeGraphEntropy,
  simulateBeliefUpdate,
} from "./belief-propagation.js";

/**
 * @param {object} graph
 * @param {Record<string, object>} state
 * @param {Set<string>} probedIds
 * @param {object} flags
 */
function expectedInformationGain(graph, state, conceptId, probedIds, flags) {
  const id = String(conceptId || "").trim();
  const entry = state[id];
  const pKnew = clamp01(entry?.belief ?? 0.5);
  const nodeIds = graph?.nodes || Object.keys(state);
  const baseEntropy = computeGraphEntropy(state, nodeIds);

  const outcomes = [
    { response: "knew", prob: pKnew },
    { response: "missed", prob: 1 - pKnew },
  ];

  let expectedRemaining = 0;
  for (const { response, prob } of outcomes) {
    const next = simulateBeliefUpdate(graph, state, id, response, flags);
    expectedRemaining += prob * computeGraphEntropy(next, nodeIds);
  }

  return baseEntropy - expectedRemaining;
}

function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.5;
  return Math.min(0.99, Math.max(0.01, x));
}

/**
 * @param {object} graph
 * @param {Record<string, object>} state
 * @param {object} [options]
 */
export function nextProbe(graph, state, options = {}) {
  const flags = options.flags || getAdaptiveProbingFlags();
  const probedIds = options.probedIds || new Set();
  const nodeIds = graph?.nodes || Object.keys(state);
  let best = null;
  let bestEig = -Infinity;

  for (const id of nodeIds) {
    if (!isProbeCandidate(id, state, probedIds, flags)) continue;
    const eig = expectedInformationGain(graph, state, id, probedIds, flags);
    if (eig > bestEig) {
      bestEig = eig;
      best = { conceptId: id, expectedInformationGain: eig };
    }
  }
  return best;
}

/**
 * @param {object} graph
 * @param {Record<string, object>} state
 * @param {number} n
 * @param {object} [options]
 */
export function nextProbeBatch(graph, state, n, options = {}) {
  const flags = options.flags || getAdaptiveProbingFlags();
  const count = Math.max(0, Math.floor(Number(n) || 0));
  if (!count) return [];

  const probedIds = new Set(options.probedIds || []);
  const working = cloneBeliefState(state, graph?.nodes);
  /** @type {{ conceptId: string, expectedInformationGain: number }[]} */
  const batch = [];

  for (let i = 0; i < count; i += 1) {
    const pick = nextProbe(graph, working, { flags, probedIds });
    if (!pick || pick.expectedInformationGain <= 0) break;
    batch.push(pick);
    probedIds.add(pick.conceptId);
    const simulated = simulateBeliefUpdate(graph, working, pick.conceptId, "knew", flags);
    Object.assign(working, simulated);
    applySiblingRedundancy(graph, working, pick.conceptId, flags);
  }
  return batch;
}

/**
 * Nodes sharing the same prerequisite set get partial belief lift when a sibling is probed.
 */
function applySiblingRedundancy(graph, state, conceptId, flags) {
  const prereqs = graph?.adjacency?.prerequisites?.get(conceptId) || [];
  const key = prereqs.slice().sort().join("|");
  if (!key) return;
  for (const id of graph.nodes || []) {
    if (id === conceptId) continue;
    const otherKey = (graph.adjacency?.prerequisites?.get(id) || []).slice().sort().join("|");
    if (otherKey !== key) continue;
    const current = state[id]?.belief ?? 0.5;
    const hi = Number(flags.HIGH_CONFIDENCE_SKIP_THRESHOLD) || 0.9;
    if (current >= hi) continue;
    state[id] = {
      belief: Math.min(0.99, current + 0.72),
      lastUpdated: new Date().toISOString(),
      source: "propagated",
      triggeredBy: conceptId,
    };
  }
}

/**
 * @param {object} params
 */
export function selectAdaptiveProbeConcepts({
  graph,
  state,
  n,
  inventory,
  flags = getAdaptiveProbingFlags(),
}) {
  const batch = nextProbeBatch(graph, state, n, { flags });
  if (batch.length) return batch.map((b) => b.conceptId);

  const fallback = (Array.isArray(inventory) ? inventory : [])
    .map((c) => String(c?.id || c?.concept_id || "").trim())
    .filter(Boolean);
  return fallback.slice(0, Math.max(1, Math.floor(Number(n) || 1)));
}

export { binaryEntropy, computeGraphEntropy };

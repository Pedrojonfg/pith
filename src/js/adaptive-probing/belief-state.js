/**
 * R1 — Belief state initialization from vault maturity priors.
 * @see specs/20260630-adaptive-knowledge-probing/
 */

import { getAdaptiveProbingFlags } from "../config/flags.js";
import { getConceptById } from "../concept-registry/registry-store.js";
import { getProbeConceptId } from "./probe-graph.js";

const MATURITY_PRIORS = Object.freeze({
  green: 0.85,
  yellow: 0.55,
  gray: null,
});

/**
 * @param {string} [maturity]
 * @param {object} [flags]
 */
export function priorBeliefForMaturity(maturity, flags = getAdaptiveProbingFlags()) {
  const m = String(maturity || "gray").trim().toLowerCase();
  if (m === "green") return MATURITY_PRIORS.green;
  if (m === "yellow") return MATURITY_PRIORS.yellow;
  return Number(flags.BASE_RATE_PRIOR) || 0.25;
}

/**
 * Resolve maturity for an inventory concept (registry link or inline field).
 * @param {object} concept
 */
export function resolveConceptMaturity(concept) {
  const inline = String(concept?.maturity || "").trim().toLowerCase();
  if (inline === "green" || inline === "yellow" || inline === "gray") return inline;
  const registryId = String(
    concept?.registryConceptId || concept?.canonicalId || concept?.vaultConceptId || "",
  ).trim();
  const lookupId = registryId || getProbeConceptId(concept);
  if (lookupId) {
    const reg = getConceptById(lookupId);
    if (reg?.maturity) return String(reg.maturity).trim().toLowerCase();
  }
  return "gray";
}

/**
 * @param {object} params
 * @param {object[]} params.conceptInventory
 * @param {object} [params.flags]
 */
export function initializeBeliefState({ conceptInventory, flags = getAdaptiveProbingFlags() }) {
  const now = new Date().toISOString();
  /** @type {Record<string, { belief: number, lastUpdated: string, source: string }>} */
  const state = {};
  for (const c of Array.isArray(conceptInventory) ? conceptInventory : []) {
    const id = getProbeConceptId(c);
    if (!id || state[id]) continue;
    const maturity = resolveConceptMaturity(c);
    state[id] = {
      belief: priorBeliefForMaturity(maturity, flags),
      lastUpdated: now,
      source: "prior",
    };
  }
  return state;
}

/**
 * @param {string} conceptId
 * @param {Record<string, object>} state
 * @param {Set<string>} [probedIds]
 * @param {object} [flags]
 */
export function isProbeCandidate(conceptId, state, probedIds = new Set(), flags = getAdaptiveProbingFlags()) {
  const id = String(conceptId || "").trim();
  if (!id || probedIds.has(id)) return false;
  const entry = state[id];
  if (!entry) return true;
  const b = Number(entry.belief);
  if (!Number.isFinite(b)) return true;
  const hi = Number(flags.HIGH_CONFIDENCE_SKIP_THRESHOLD) || 0.9;
  const lo = Number(flags.LOW_CONFIDENCE_SKIP_THRESHOLD) || 0.1;
  if (b >= hi || b <= lo) return false;
  return true;
}

/**
 * @param {Record<string, object>} state
 * @param {string[]} nodeIds
 */
export function cloneBeliefState(state, nodeIds = null) {
  const ids = nodeIds || Object.keys(state || {});
  /** @type {Record<string, object>} */
  const out = {};
  for (const id of ids) {
    const row = state[id];
    if (!row) continue;
    out[id] = { ...row };
  }
  return out;
}

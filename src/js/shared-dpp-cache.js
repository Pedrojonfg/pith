/**
 * Shared tier-1 DPP artifact cache — pure extract/hydrate/key helpers.
 * @see specs/20260704-shared-dpp-cache/contracts/shared-dpp-cache-store.md
 */

import { isTier1PreparationComplete, normalizePreparationState } from "./session-types.js";

/** Bump when tier-1 phases or artifact schema change. */
export const DPP_PIPELINE_VERSION = "20260704_01";

const TIER1_PHASE_IDS = [
  "T0.1",
  "T0.2",
  "T1.1",
  "T1.2",
  "T1.3",
  "T1.4",
  "T1.5",
  "T1.7",
];

/** Phases that depend on user vault / project context — not in shared cache. */
export const USER_SPECIFIC_DPP_PHASES = ["T1.6", "T1.8", "T1.9"];

/**
 * @param {string} docId
 * @param {string} [pipelineVersion]
 * @returns {string}
 */
export function buildSharedDppCacheKey(docId, pipelineVersion = DPP_PIPELINE_VERSION) {
  const id = String(docId || "").trim();
  const version = String(pipelineVersion || DPP_PIPELINE_VERSION).trim();
  return `${id}:${version}`;
}

/**
 * @param {object} phaseResults
 * @returns {Record<string, object>}
 */
function pickTier1PhaseResults(phaseResults) {
  const src = phaseResults && typeof phaseResults === "object" ? phaseResults : {};
  /** @type {Record<string, object>} */
  const out = {};
  for (const id of TIER1_PHASE_IDS) {
    if (src[id]) out[id] = { ...src[id] };
  }
  return out;
}

/**
 * @param {object | null | undefined} session
 * @returns {object | null}
 */
export function extractShareableTier1Artifacts(session) {
  if (!isTier1PreparationComplete(session)) return null;
  const shared = session?.shared;
  if (!shared) return null;
  const prep = normalizePreparationState(shared.preparation);
  return {
    conceptInventory: Array.isArray(shared.conceptInventory) ? [...shared.conceptInventory] : [],
    docHierarchy: shared.docHierarchy ?? null,
    docTopics: Array.isArray(shared.docTopics) ? [...shared.docTopics] : [],
    textMetrics: shared.textMetrics ? { ...shared.textMetrics } : null,
    blockRecommendation: shared.blockRecommendation ? { ...shared.blockRecommendation } : null,
    modeRecommendation: shared.modeRecommendation ? { ...shared.modeRecommendation } : null,
    conceptGraph: shared.conceptGraph ?? null,
    phaseResults: pickTier1PhaseResults(prep.phaseResults),
    preparation: {
      status: "ready",
      fingerprint: String(prep.fingerprint || ""),
      completedAt: prep.completedAt || Date.now(),
    },
  };
}

/**
 * @param {object} session
 * @param {object} artifacts
 * @returns {object}
 */
export function hydrateSessionFromSharedCache(session, artifacts) {
  if (!session || !artifacts || typeof artifacts !== "object") return session;
  if (!session.shared) session.shared = {};
  const sh = session.shared;
  if (Array.isArray(artifacts.conceptInventory)) sh.conceptInventory = artifacts.conceptInventory;
  if (artifacts.docHierarchy != null) sh.docHierarchy = artifacts.docHierarchy;
  if (Array.isArray(artifacts.docTopics)) sh.docTopics = artifacts.docTopics;
  if (artifacts.textMetrics != null) sh.textMetrics = artifacts.textMetrics;
  if (artifacts.blockRecommendation != null) sh.blockRecommendation = artifacts.blockRecommendation;
  if (artifacts.modeRecommendation != null) sh.modeRecommendation = artifacts.modeRecommendation;
  if (artifacts.conceptGraph != null) sh.conceptGraph = artifacts.conceptGraph;

  const prep = normalizePreparationState(sh.preparation);
  const cachedPrep =
    artifacts.preparation && typeof artifacts.preparation === "object" ? artifacts.preparation : {};
  prep.status = cachedPrep.status === "ready" ? "ready" : "ready";
  prep.fingerprint = String(cachedPrep.fingerprint || prep.fingerprint || "");
  prep.completedAt = Number(cachedPrep.completedAt) || prep.completedAt || Date.now();
  prep.phaseResults = {
    ...(prep.phaseResults || {}),
    ...pickTier1PhaseResults(artifacts.phaseResults),
  };
  prep.failReason = null;
  sh.preparation = prep;
  return session;
}

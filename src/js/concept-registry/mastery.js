/**
 * Global concept mastery cache — decay + facet weighting v1.
 */

import { LAMBDA } from "../vault/mastery-model.js";
import {
  appendObservation,
  getConceptById,
  loadRegistry,
  setConceptMasteryCache,
} from "./registry-store.js";

const MS_PER_DAY = 86_400_000;

/**
 * @param {import('../session-types.js').Concept} concept
 * @param {import('../session-types.js').VaultObservationGlobal[]} observations
 */
export function computeConceptMastery(concept, observations = []) {
  const facets = Array.isArray(concept?.facets) ? concept.facets : [];
  if (!facets.length) return 0;

  const now = Date.now();
  let weightedSum = 0;
  let weightTotal = 0;

  for (const schedule of facets) {
    const q = Number(schedule.lastQuality);
    const qualityNorm = Number.isFinite(q) ? Math.max(0, Math.min(1, q / 5)) : 0;
    const reviewedAt = Date.parse(schedule.lastReviewedAt);
    const recencyWeight = Number.isFinite(reviewedAt)
      ? 1 + Math.max(0, 1 - (now - reviewedAt) / (30 * MS_PER_DAY))
      : 1;
    const w = recencyWeight * (schedule.facet === "recognition" ? 1 : 1.2);
    weightedSum += qualityNorm * w;
    weightTotal += w;
  }

  const facetAvg = weightTotal > 0 ? weightedSum / weightTotal : 0;

  const conceptObs = observations.filter((o) => o.conceptId === concept.id);
  const lastObs = conceptObs.reduce((max, o) => {
    const t = Date.parse(o.observedAt);
    return Number.isFinite(t) && t > max ? t : max;
  }, 0);
  const daysSince =
    lastObs > 0 ? Math.max(0, (now - lastObs) / MS_PER_DAY) : facets.length ? 0 : 30;

  const decay = Math.exp(-LAMBDA * daysSince);
  return Math.max(0, Math.min(1, facetAvg * decay));
}

/**
 * @param {string} conceptId
 */
export function recomputeAndCacheMastery(conceptId) {
  const concept = getConceptById(conceptId);
  if (!concept) return 0;
  const registry = loadRegistry();
  const mastery = computeConceptMastery(concept, registry.observations);
  setConceptMasteryCache(conceptId, mastery);
  return mastery;
}

/**
 * @param {object} params
 */
export function recordObservationAndRecompute({ conceptId, facet, quality, sourceDocId }) {
  appendObservation({
    conceptId,
    facet,
    quality,
    sourceDocId,
    observedAt: new Date().toISOString(),
  });
  return recomputeAndCacheMastery(conceptId);
}

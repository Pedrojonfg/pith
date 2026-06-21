/**
 * Pure dedup veto gate rules (no I/O) — testable in Node.
 */

import { DEDUP_GENERATION_FLOOR, DEDUP_HARD_GATE_THRESHOLD } from "../vault/embedding-thresholds.js";

export { DEDUP_GENERATION_FLOOR, DEDUP_HARD_GATE_THRESHOLD };

/**
 * G1 — same language or translatable (pass if language data absent).
 */
export function gateSameLanguageOrTranslatable(conceptA, conceptB, context) {
  const langA = context?.languageA;
  const langB = context?.languageB;
  if (!langA || !langB) return { passed: true, reason: "language_data_absent" };
  if (langA === langB) return { passed: true, reason: "same_language" };
  if (context?.crossLingualOverride) return { passed: true, reason: "cross_lingual_override" };
  return { passed: false, reason: `language_mismatch:${langA}:${langB}` };
}

/**
 * G2 — no conflicting external id (pass if field absent).
 */
export function gateNoConflictingExternalId(conceptA, conceptB) {
  const extA = conceptA?.externalId;
  const extB = conceptB?.externalId;
  if (!extA || !extB) return { passed: true, reason: "no_external_id" };
  if (extA === extB) return { passed: true, reason: "matching_external_id" };
  return { passed: false, reason: "conflicting_external_id" };
}

/**
 * G3 — minimum generation floor (hard proposal threshold handled in outcome).
 */
export function gateCosineAboveThreshold(cosineScore, threshold = DEDUP_GENERATION_FLOOR) {
  if (cosineScore >= threshold) {
    return { passed: true, reason: `cosine_${cosineScore.toFixed(3)}_gte_${threshold}` };
  }
  return { passed: false, reason: `cosine_${cosineScore.toFixed(3)}_lt_${threshold}` };
}

/**
 * @param {number} cosineScore
 */
export function classifyDedupOutcome(cosineScore) {
  if (cosineScore >= DEDUP_HARD_GATE_THRESHOLD) return "proposal";
  if (cosineScore >= DEDUP_GENERATION_FLOOR) return "suggestion";
  return "rejected";
}

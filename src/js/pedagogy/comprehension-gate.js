/**
 * Comprehension gate — conceptual concepts need confirmation before SM-2 scheduling.
 * @see specs/20260701-pedagogical-principles/spec.md §4
 */

import { isComprehensionGateEnabled } from "../config/flags.js";
import { isThresholdConcept } from "./threshold-concepts.js";

/**
 * @param {object} conceptEntry
 * @returns {boolean}
 */
export function isConceptualForGate(conceptEntry) {
  if (!conceptEntry || typeof conceptEntry !== "object") return false;
  return conceptEntry.questionClass !== "factual";
}

/**
 * @param {object} conceptEntry
 * @returns {boolean}
 */
export function isComprehensionConfirmed(conceptEntry) {
  if (!conceptEntry || typeof conceptEntry !== "object") return false;
  if (conceptEntry.questionClass === "factual") return true;
  return conceptEntry.comprehensionConfirmed === true;
}

/**
 * @param {object} session
 * @param {string} conceptId
 * @returns {object | null}
 */
export function findConceptInInventory(session, conceptId) {
  const id = String(conceptId || "").trim();
  if (!id) return null;
  const inv = session?.shared?.conceptInventory;
  if (!Array.isArray(inv)) return null;
  return (
    inv.find(
      (c) =>
        String(c?.canonicalId || c?.id || "").trim() === id ||
        String(c?.label || "").trim() === id,
    ) || null
  );
}

/**
 * @param {object} session
 * @param {string[]} conceptIds
 * @returns {boolean} true if all concepts may enter SM-2
 */
export function mayScheduleSm2ForConcepts(session, conceptIds) {
  if (!isComprehensionGateEnabled()) return true;
  const ids = Array.isArray(conceptIds) ? conceptIds : [];
  if (!ids.length) return true;

  for (const rawId of ids) {
    const concept = findConceptInInventory(session, rawId);
    if (!concept) continue;
    if (isConceptualForGate(concept) && !isComprehensionConfirmed(concept)) {
      return false;
    }
  }
  return true;
}

/**
 * @param {object} conceptEntry
 * @param {'recall'|'socratic'} signal
 * @param {number} [quality]
 * @returns {object}
 */
export function applyComprehensionSignal(conceptEntry, signal, quality = 0) {
  if (!conceptEntry || typeof conceptEntry !== "object") return conceptEntry;
  if (conceptEntry.questionClass === "factual") return conceptEntry;

  let confirmed = conceptEntry.comprehensionConfirmed === true;
  if (signal === "recall") {
    const q = String(quality);
    if (isThresholdConcept(conceptEntry)) {
      if (q === "adequate" || q === "strong" || quality >= 3) {
        confirmed = true;
      }
    } else if (q === "partial" || q === "adequate" || q === "strong" || quality >= 2) {
      confirmed = true;
    }
  }
  if (signal === "socratic" && quality >= 4) {
    confirmed = true;
  }
  if (confirmed) {
    return { ...conceptEntry, comprehensionConfirmed: true };
  }
  return conceptEntry;
}

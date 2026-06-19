/** Feature flags — RSVP assessment reposition (20260611-rsvp-assessment-reposition). */

export const ASSESSMENT_FLAGS = Object.freeze({
  ASSESSMENT_BEFORE_PACKING: true,
  ASSESSMENT_USE_QUESTIONS_UI: true,
  /** Safety ceiling only; count driven by n_test + n_socratic. */
  ASSESSMENT_ITEMS_MAX: 7,
  ASSESSMENT_MASTERY_THRESHOLD: 0.85,
  ASSESSMENT_SHOW_DIFF: true,
  ASSESSMENT_PARALLEL_PACKING: true,
  /** Document-wide map-reduce assessment (20260618-holistic-assessment-coverage). */
  HOLISTIC_ASSESSMENT_ENABLED: true,
  HOLISTIC_ASSESSMENT_MAX: 50,
});

export function isHolisticAssessmentEnabled() {
  return (
    ASSESSMENT_FLAGS.HOLISTIC_ASSESSMENT_ENABLED === true &&
    isPrePackingAssessmentEnabled() &&
    isAssessmentQuestionsUiEnabled()
  );
}

export function isPrePackingAssessmentEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_BEFORE_PACKING === true;
}

export function isAssessmentQuestionsUiEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_USE_QUESTIONS_UI === true;
}

/** Source fidelity strict mode (20260613-source-fidelity Phase C). */
import { LS_SOURCE_FIDELITY_STRICT_KEY } from "../config.js";

export function getSourceFidelityStrictPreference() {
  try {
    return localStorage.getItem(LS_SOURCE_FIDELITY_STRICT_KEY) === "true";
  } catch {
    return false;
  }
}

export function saveSourceFidelityStrictPreference(strict) {
  try {
    localStorage.setItem(LS_SOURCE_FIDELITY_STRICT_KEY, strict === true ? "true" : "false");
  } catch {
    // ignore
  }
}

export function isSourceFidelityStrictEnabled() {
  return getSourceFidelityStrictPreference() === true;
}

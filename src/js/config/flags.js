/** Feature flags — RSVP assessment reposition (20260611-rsvp-assessment-reposition). */

export const ASSESSMENT_FLAGS = Object.freeze({
  ASSESSMENT_BEFORE_PACKING: true,
  ASSESSMENT_USE_QUESTIONS_UI: true,
  ASSESSMENT_LEGACY_MCQ_UI: false,
  /** Safety ceiling only; count driven by n_test + n_socratic. */
  ASSESSMENT_ITEMS_MAX: 7,
  ASSESSMENT_MASTERY_THRESHOLD: 0.85,
  ASSESSMENT_SHOW_DIFF: true,
  ASSESSMENT_PARALLEL_PACKING: true,
});

export function isPrePackingAssessmentEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_BEFORE_PACKING === true;
}

export function isAssessmentQuestionsUiEnabled() {
  return (
    ASSESSMENT_FLAGS.ASSESSMENT_USE_QUESTIONS_UI === true &&
    !ASSESSMENT_FLAGS.ASSESSMENT_LEGACY_MCQ_UI
  );
}

/** Source fidelity strict mode (20260613-source-fidelity Phase C). */
export const SOURCE_FIDELITY_FLAGS = Object.freeze({
  SOURCE_FIDELITY_STRICT: false,
});

export function isSourceFidelityStrictEnabled() {
  return SOURCE_FIDELITY_FLAGS.SOURCE_FIDELITY_STRICT === true;
}

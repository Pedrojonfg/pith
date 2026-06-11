/** Feature flags — RSVP assessment reposition (20260611-rsvp-assessment-reposition). */

export const ASSESSMENT_FLAGS = Object.freeze({
  ASSESSMENT_BEFORE_PACKING: true,
  ASSESSMENT_ITEMS_MAX: 7,
  ASSESSMENT_MASTERY_THRESHOLD: 0.85,
  ASSESSMENT_SHOW_DIFF: true,
  ASSESSMENT_PARALLEL_PACKING: true,
});

export function isPrePackingAssessmentEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_BEFORE_PACKING === true;
}

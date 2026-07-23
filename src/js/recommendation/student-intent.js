/**
 * Labeled studentIntent appendix for high-priority generative prompts (FR-015).
 * @see specs/20260724-mode-recommendation/contracts/student-intent-injection.md
 */

/**
 * @param {string | null | undefined} studentIntent
 * @returns {string | null}
 */
export function buildStudentIntentAppendix(studentIntent) {
  const text = String(studentIntent ?? "").trim();
  if (!text) return null;
  return (
    "STUDENT INTENT (optional; from onboarding — calibrate examples, depth, and urgency;\n" +
    "do not invent facts absent from the source material):\n" +
    `"""\n${text}\n"""`
  );
}

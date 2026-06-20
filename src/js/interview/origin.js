/** Interview session origin helpers (20260620-nodoc-interview-capture). */

/** @typedef {'rsvp'|'slow'|'questions'|'cloze'|'recall'} StudyModeKey */

export const INTERVIEW_PLACEHOLDER_MARKDOWN =
  "# Interview capture\n\n_Session in progress — content will be synthesized from your answers._";

export const INTERVIEW_HIDDEN_MODES = Object.freeze(["rsvp", "slow", "questions"]);

/**
 * @param {object|null|undefined} session
 */
export function isInterviewOriginSession(session) {
  return String(session?.shared?.uploadMeta?.originalFormat || "").trim() === "interview";
}

/**
 * @param {object|null|undefined} session
 * @param {string} mode
 */
export function isModeAvailableForSession(session, mode) {
  const key = String(mode || "").trim();
  if (!isInterviewOriginSession(session)) return true;
  return !INTERVIEW_HIDDEN_MODES.includes(key);
}

/**
 * @param {object|null|undefined} session
 * @returns {StudyModeKey[]}
 */
export function getDefaultModesForSession(session) {
  if (isInterviewOriginSession(session)) return ["cloze", "recall"];
  return ["rsvp", "slow", "cloze", "questions", "recall"];
}

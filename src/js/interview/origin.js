/** Interview session origin helpers (20260620-nodoc-interview-capture). */

import {
  isPackImportSession,
  packImportHasSourceDocument,
  PACK_SOURCE_REQUIRED_MODES,
} from "../session-types.js";

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
  if (isInterviewOriginSession(session) && INTERVIEW_HIDDEN_MODES.includes(key)) return false;
  if (
    isPackImportSession(session) &&
    !packImportHasSourceDocument(session) &&
    PACK_SOURCE_REQUIRED_MODES.includes(key)
  ) {
    return false;
  }
  return true;
}

/**
 * @param {object|null|undefined} session
 * @returns {StudyModeKey[]}
 */
export function getDefaultModesForSession(session) {
  if (isInterviewOriginSession(session)) return ["cloze", "recall"];
  if (isPackImportSession(session) && !packImportHasSourceDocument(session)) {
    return ["rsvp", "questions", "recall"];
  }
  return ["rsvp", "slow", "cloze", "questions", "recall"];
}

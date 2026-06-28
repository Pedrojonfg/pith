/**
 * Adaptive WPM calibration from RSVP MCQ comprehension signals.
 * @see specs/20260628-adaptive-wpm-calibration/spec.md
 */

import { LS_RSVP_WPM_BASE_KEY } from "../config.js";

export const WPM_BASE_MIN = 150;
export const WPM_BASE_MAX = 1000;
export const WPM_BASE_DEFAULT = 300;
export const WPM_ADJUSTMENT_STEP = 25;
export const MIN_ELIGIBLE_BLOCKS = 3;

/** Detail/inference items for comprehension scoring. */
export function isDetailInferenceQuestionClass(questionClass) {
  return String(questionClass || "").trim() === "factual";
}

/** Gist items — excluded from comprehension score. */
export function isGistQuestionClass(questionClass) {
  const qc = String(questionClass || "").trim();
  return qc === "conceptual" || !qc;
}

/**
 * @param {string} conceptId
 * @param {object[]} conceptInventory
 * @returns {string}
 */
export function lookupQuestionClass(conceptId, conceptInventory) {
  const id = String(conceptId || "").trim();
  if (!id) return "conceptual";
  const inv = Array.isArray(conceptInventory) ? conceptInventory : [];
  const hit = inv.find((c) => {
    if (!c || typeof c !== "object") return false;
    const cid = String(c.id || c.concept_id || c.canonicalId || "").trim();
    return cid === id;
  });
  const qc = String(hit?.questionClass || "").trim();
  return qc || "conceptual";
}

function parseAnswerLetter(raw) {
  const t = String(raw || "").trim();
  if (!t) return "";
  const m = t.match(/\b([ABCD])\b/i);
  return m ? String(m[1]).toUpperCase() : "";
}

/**
 * @param {object|null|undefined} response
 * @returns {boolean}
 */
export function isMcqAnswerCorrect(response) {
  if (!response || typeof response !== "object") return false;
  if (response.is_correct === true) return true;
  if (response.is_correct === false) return false;
  const userLetter = parseAnswerLetter(response.user_answer);
  const correct = String(response.correct_answer || "").trim().toUpperCase();
  if (!userLetter || !correct) return false;
  return userLetter === correct;
}

/**
 * @param {object|null|undefined} block
 * @returns {{ globalIndex: number, question: object }[]}
 */
export function getTestQuestionContexts(block) {
  const qs = Array.isArray(block?.questions) ? block.questions : [];
  const testQs = qs.filter((q) => q && typeof q === "object" && String(q.type || "").trim() === "test");
  return testQs.map((question, globalIndex) => ({ globalIndex, question }));
}

/**
 * @param {object|null|undefined} block
 * @param {object|null|undefined} blockResponses
 * @param {object[]} conceptInventory
 * @returns {{ eligible: boolean, score: number|null, answeredDetail: number, totalDetail: number }}
 */
export function computeBlockDetailInferenceScore(block, blockResponses, conceptInventory) {
  const qm =
    blockResponses?.questions && typeof blockResponses.questions === "object"
      ? blockResponses.questions
      : {};
  const contexts = getTestQuestionContexts(block);
  let answeredDetail = 0;
  let correctDetail = 0;

  for (const { globalIndex, question } of contexts) {
    const response = qm[String(globalIndex)];
    const userAnswer = String(response?.user_answer || "").trim();
    if (!userAnswer) continue;

    const conceptId = String(question?.concept_id || "").trim();
    const questionClass = lookupQuestionClass(conceptId, conceptInventory);
    if (!isDetailInferenceQuestionClass(questionClass)) continue;

    answeredDetail += 1;
    if (isMcqAnswerCorrect(response)) correctDetail += 1;
  }

  if (answeredDetail === 0) {
    return { eligible: false, score: null, answeredDetail: 0, totalDetail: 0 };
  }

  return {
    eligible: true,
    score: correctDetail / answeredDetail,
    answeredDetail,
    totalDetail: answeredDetail,
  };
}

/**
 * @param {number[]} values
 * @returns {number|null}
 */
export function medianFinite(values) {
  const nums = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  nums.sort((a, b) => a - b);
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 1) return nums[mid];
  return (nums[mid - 1] + nums[mid]) / 2;
}

/**
 * @param {object|null|undefined} session
 * @param {object[]} conceptInventory
 * @returns {{ sessionScore: number, eligibleBlockCount: number, blockScores: number[], medianWpm: number|null }|null}
 */
export function computeSessionComprehension(session, conceptInventory) {
  const blocks = Array.isArray(session?.blocks) ? session.blocks : [];
  const respBlocks =
    session?._responses?.blocks && typeof session._responses.blocks === "object"
      ? session._responses.blocks
      : {};
  const blockWpmMap =
    session?._meta?.rsvp_block_wpm && typeof session._meta.rsvp_block_wpm === "object"
      ? session._meta.rsvp_block_wpm
      : {};
  const sessionStartWpm = Number(session?._meta?.rsvp_session_start_wpm);

  /** @type {number[]} */
  const blockScores = [];
  /** @type {number[]} */
  const eligibleWpms = [];

  for (let bi = 0; bi < blocks.length; bi += 1) {
    const block = blocks[bi];
    const blockResponses = respBlocks[String(bi)];
    const result = computeBlockDetailInferenceScore(block, blockResponses, conceptInventory);
    if (!result.eligible || result.score == null) continue;

    blockScores.push(result.score);
    const recorded = Number(blockWpmMap[String(bi)]);
    if (Number.isFinite(recorded) && recorded > 0) {
      eligibleWpms.push(recorded);
    } else if (Number.isFinite(sessionStartWpm) && sessionStartWpm > 0) {
      eligibleWpms.push(sessionStartWpm);
    }
  }

  if (blockScores.length < MIN_ELIGIBLE_BLOCKS) return null;

  const sessionScore = blockScores.reduce((a, b) => a + b, 0) / blockScores.length;
  return {
    sessionScore,
    eligibleBlockCount: blockScores.length,
    blockScores,
    medianWpm: medianFinite(eligibleWpms),
  };
}

/**
 * @param {number} sessionScore
 * @returns {number}
 */
export function deriveWpmAdjustment(sessionScore) {
  const score = Number(sessionScore);
  if (!Number.isFinite(score)) return 0;
  if (score >= 0.75) return WPM_ADJUSTMENT_STEP;
  if (score < 0.5) return -WPM_ADJUSTMENT_STEP;
  return 0;
}

/**
 * @param {number} wpm
 * @returns {number}
 */
export function clampWpmBase(wpm) {
  const n = Math.round(Number(wpm));
  if (!Number.isFinite(n)) return WPM_BASE_DEFAULT;
  return Math.min(WPM_BASE_MAX, Math.max(WPM_BASE_MIN, n));
}

/**
 * @param {Storage} [storage]
 * @returns {number}
 */
export function readWpmBase(storage = localStorage) {
  try {
    const raw = storage.getItem(LS_RSVP_WPM_BASE_KEY);
    if (raw == null || raw === "") return WPM_BASE_DEFAULT;
    return clampWpmBase(Number(raw));
  } catch {
    return WPM_BASE_DEFAULT;
  }
}

/**
 * @param {number} wpm
 * @param {Storage} [storage]
 */
export function writeWpmBase(wpm, storage = localStorage) {
  try {
    storage.setItem(LS_RSVP_WPM_BASE_KEY, String(clampWpmBase(wpm)));
  } catch {
    // ignore storage errors
  }
}

/**
 * @param {object|null|undefined} session
 * @param {object[]} conceptInventory
 * @param {Storage} [storage]
 * @returns {{ previous: number, next: number, adjustment: number, sessionScore: number }|null}
 */
export function applySessionWpmCalibration(session, conceptInventory, storage = localStorage) {
  const comprehension = computeSessionComprehension(session, conceptInventory);
  if (!comprehension) return null;

  const adjustment = deriveWpmAdjustment(comprehension.sessionScore);
  const previous = readWpmBase(storage);
  const next = clampWpmBase(previous + adjustment);
  writeWpmBase(next, storage);

  return {
    previous,
    next,
    adjustment,
    sessionScore: comprehension.sessionScore,
  };
}

/**
 * @param {object} session
 * @param {number} blockIndex
 * @param {number} wpm
 */
export function recordBlockRsvpWpm(session, blockIndex, wpm) {
  if (!session || typeof session !== "object") return;
  if (!session._meta || typeof session._meta !== "object") session._meta = {};
  if (!session._meta.rsvp_block_wpm || typeof session._meta.rsvp_block_wpm !== "object") {
    session._meta.rsvp_block_wpm = {};
  }
  const n = Math.round(Number(wpm));
  if (!Number.isFinite(n) || n <= 0) return;
  session._meta.rsvp_block_wpm[String(blockIndex)] = n;
}

/**
 * @param {object} session
 * @param {number} wpm
 */
export function ensureSessionStartWpm(session, wpm) {
  if (!session || typeof session !== "object") return;
  if (!session._meta || typeof session._meta !== "object") session._meta = {};
  if (Number.isFinite(Number(session._meta.rsvp_session_start_wpm))) return;
  const n = Math.round(Number(wpm));
  if (!Number.isFinite(n) || n <= 0) return;
  session._meta.rsvp_session_start_wpm = n;
}

/**
 * @param {string} studyMode
 * @returns {boolean}
 */
export function shouldCalibrateStudyMode(studyMode) {
  const m = String(studyMode || "").trim().toLowerCase();
  return m === "rsvp" || m === "questions" || !m;
}

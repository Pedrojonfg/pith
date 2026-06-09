/**
 * Flow progress tracker (pure, immutable).
 * @see specs/20260609-flow-recommendation/contracts/tracker-api.md
 */

import { getSession, getSmItemsDueToday } from "../session-store.js";

/** @typedef {'rsvp'|'slow'|'cloze'|'questions'|'review'} StudyMode */

/**
 * @param {Record<string, unknown> | null | undefined} session
 * @param {StudyMode} mode
 * @returns {Record<string, unknown> | null}
 */
function getModeSlice(session, mode) {
  const fromModes = session?.modes?.[mode];
  if (fromModes && typeof fromModes === "object") return fromModes;

  if (mode === "slow" && session?.slow && typeof session.slow === "object") {
    return { studyMode: "slow", slow: session.slow };
  }
  if (session?.studyMode === mode) return session;
  return null;
}

/**
 * @param {Record<string, unknown> | null} slice
 * @returns {Record<string, unknown> | null}
 */
function getSlowState(slice) {
  if (!slice || typeof slice !== "object") return null;
  if (slice.slow && typeof slice.slow === "object") return slice.slow;
  if ("phase" in slice || "graphEnrichedUnlocked" in slice) return slice;
  return null;
}

/**
 * @param {unknown} phase
 * @returns {boolean}
 */
function isAtSlowPhase3(phase) {
  return phase === 3 || phase === "phase3" || phase === "complete";
}

/**
 * @param {Record<string, unknown>} block
 * @returns {Array<Record<string, unknown>>}
 */
function getBlockQuestions(block) {
  const qs = Array.isArray(block?.questions) ? block.questions : [];
  return qs.filter((q) => q && typeof q === "object");
}

/**
 * @param {Record<string, unknown>} slice
 * @returns {boolean}
 */
function isBlockSessionComplete(slice) {
  const n = Number(slice.n_blocks) || 0;
  if (n <= 0) return false;
  const blocks = Array.isArray(slice.blocks) ? slice.blocks : [];
  const responses = slice._responses?.blocks;
  if (!responses || typeof responses !== "object") return false;

  for (let bi = 0; bi < n; bi += 1) {
    const block = blocks[bi];
    if (!block || typeof block !== "object") return false;
    const qs = getBlockQuestions(block);
    for (let qi = 0; qi < qs.length; qi += 1) {
      const r = responses[String(bi)]?.questions?.[String(qi)];
      if (!r || r.user_answer == null || !String(r.user_answer).trim()) return false;
    }
  }
  return true;
}

/**
 * @param {Record<string, unknown>} slice
 * @returns {boolean}
 */
function isQuestionsModeComplete(slice) {
  const n = Number(slice.n_blocks) || 0;
  if (n <= 0) return false;
  const blocks = Array.isArray(slice.blocks) ? slice.blocks : [];
  const responses = slice._responses?.blocks;
  if (!responses || typeof responses !== "object") return false;

  for (let bi = 0; bi < n; bi += 1) {
    const blockResponses = responses[String(bi)]?.questions;
    if (!blockResponses || typeof blockResponses !== "object") return false;
    const hasAnswer = Object.values(blockResponses).some(
      (r) => r && typeof r === "object" && r.user_answer != null && String(r.user_answer).trim(),
    );
    if (!hasAnswer) return false;
  }
  return blocks.length >= n;
}

/**
 * @param {Record<string, unknown>} slice
 * @returns {boolean}
 */
function isClozeModeComplete(slice) {
  const direct = slice.studyProgress ?? slice.cloze?.studyProgress;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct >= 0.8;

  const clozeData =
    slice.cloze && typeof slice.cloze === "object" ? slice.cloze : slice;
  const items = Array.isArray(clozeData.items) ? clozeData.items : [];
  if (!items.length) return false;
  const withCorrect = items.filter((it) => Number(it?.times_correct) > 0).length;
  return withCorrect / items.length >= 0.8;
}

/**
 * @param {Record<string, unknown>} session
 * @param {StudyMode} mode
 * @returns {boolean}
 */
function isModeStepComplete(session, mode) {
  if (mode === "review") {
    const docId = session?.docId;
    if (!docId || !getSession(docId)) return false;
    return getSmItemsDueToday(docId).length === 0;
  }

  const slice = getModeSlice(session, mode);
  if (!slice) return false;

  switch (mode) {
    case "slow": {
      const slow = getSlowState(slice);
      if (!slow) return false;
      if (!isAtSlowPhase3(slow.phase)) return false;
      return slow.graphEnrichedUnlocked === true || slow.phase === "complete";
    }
    case "rsvp":
      return isBlockSessionComplete(slice);
    case "cloze":
      return isClozeModeComplete(slice);
    case "questions":
      return isQuestionsModeComplete(slice);
    default:
      return false;
  }
}

/**
 * @param {string[]} completedSteps
 * @param {Array<{ id: string }>} primaryFlow
 * @returns {number}
 */
function computeCurrentStepIndex(completedSteps, primaryFlow) {
  const completed = new Set(completedSteps);
  const idx = primaryFlow.findIndex((step) => !completed.has(step.id));
  return idx < 0 ? primaryFlow.length : idx;
}

/**
 * @param {Record<string, unknown>} recommendation
 * @param {string} stepId
 * @param {number} [completedAt]
 * @returns {Record<string, unknown>}
 */
function applyStepCompleted(recommendation, stepId, completedAt = Date.now()) {
  const completedSteps = Array.isArray(recommendation.completedSteps)
    ? [...recommendation.completedSteps]
    : [];
  if (!completedSteps.includes(stepId)) completedSteps.push(stepId);

  const primaryFlow = (Array.isArray(recommendation.primaryFlow) ? recommendation.primaryFlow : []).map(
    (step) =>
      step.id === stepId ? { ...step, completedAt, skippedAt: step.skippedAt ?? null } : { ...step },
  );

  return {
    ...recommendation,
    primaryFlow,
    completedSteps,
    currentStepIndex: computeCurrentStepIndex(completedSteps, primaryFlow),
  };
}

/**
 * @param {Record<string, unknown>} recommendation
 * @param {Record<string, unknown>} session
 * @returns {Record<string, unknown>}
 */
export function updateFlowProgress(recommendation, session) {
  if (!recommendation || typeof recommendation !== "object") return recommendation;

  const primaryFlow = Array.isArray(recommendation.primaryFlow) ? recommendation.primaryFlow : [];
  const completed = new Set(
    Array.isArray(recommendation.completedSteps) ? recommendation.completedSteps : [],
  );

  let next = { ...recommendation };

  for (const step of primaryFlow) {
    if (!step?.id || completed.has(step.id)) continue;
    if (!isModeStepComplete(session, step.mode)) continue;
    next = applyStepCompleted(next, step.id);
    completed.add(step.id);
  }

  return next;
}

/**
 * @param {Record<string, unknown>} recommendation
 * @param {string} stepId
 * @returns {Record<string, unknown>}
 */
export function markStepCompleted(recommendation, stepId) {
  if (!recommendation || typeof recommendation !== "object") return recommendation;
  if (!stepId) return { ...recommendation };
  return applyStepCompleted(recommendation, stepId);
}

/**
 * @param {Record<string, unknown>} recommendation
 * @param {string} chosenMode
 * @returns {Record<string, unknown>}
 */
export function recordUserOverride(recommendation, chosenMode) {
  if (!recommendation || typeof recommendation !== "object") return recommendation;
  void chosenMode;
  return {
    ...recommendation,
    userOverride: true,
    currentStepIndex: -1,
    primaryFlow: Array.isArray(recommendation.primaryFlow)
      ? recommendation.primaryFlow.map((step) => ({ ...step }))
      : recommendation.primaryFlow,
    quickFlow: Array.isArray(recommendation.quickFlow)
      ? recommendation.quickFlow.map((step) => ({ ...step }))
      : recommendation.quickFlow,
    completedSteps: Array.isArray(recommendation.completedSteps)
      ? [...recommendation.completedSteps]
      : recommendation.completedSteps,
  };
}

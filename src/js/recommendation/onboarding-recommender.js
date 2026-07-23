/**
 * Onboarding questionnaire → mode recommendation (pure, deterministic).
 * @see specs/20260724-mode-recommendation/contracts/compute-mode-recommendation.md
 */

import { findPithImageTokenIds } from "../document-images/tokens.js";

/** @type {number} Placeholder: urgent pace shrinks block count for rsvp/read theory. */
export const PACE_URGENT_BLOCK_MULTIPLIER = 0.7;

/** @type {number} Placeholder: text modality reduces follow-up / total turn caps. */
export const TEXT_MODALITY_TURN_REDUCTION = 1;

/** @type {number} Placeholder: fraction of Socratic slots when preference is "both". */
export const SOCRATIC_RATIO_BOTH = 0.5;

/** @type {number} Placeholder: fraction of Socratic slots when preference is "understand". */
export const SOCRATIC_RATIO_UNDERSTAND = 0.7;

/**
 * Placeholder: min in-scope images to override urgent RSVP → Read (R-FLOW-1b).
 * `shared.images` is document-wide; count only tokens present in scoped markdown.
 */
export const IMAGE_DENSITY_THRESHOLD = 3;

/** RSVP/Read Socratic defaults used as the R-PARAM-3 override base. */
const RSVP_READ_BASE_FOLLOW_UPS = 1;
const RSVP_READ_BASE_TOTAL_TURNS = 2;

/** @typedef {'slow'|'read'|'rsvp'|'practice'|'cloze'|'questions'} OnboardingModeId */

/** @type {Record<string, { label: string, description: string }>} */
const MODE_TEMPLATES = {
  slow: {
    label: "Deep reading with annotations",
    description: "Mark what you do not understand and trace key arguments",
  },
  rsvp: {
    label: "RSVP speed reading",
    description: "Skim the text at a steady pace before self-testing",
  },
  read: {
    label: "Read mode",
    description: "Read full block text with optional diagrams, then answer questions",
  },
  practice: {
    label: "Guided practice",
    description: "Apply concepts with worked examples from a matched practice domain",
  },
  cloze: {
    label: "Cloze practice",
    description: "Fill gaps to consolidate key concepts",
  },
  questions: {
    label: "Comprehension questions",
    description: "Answer questions to check what you remember",
  },
};

/**
 * @param {OnboardingModeId} mode
 * @returns {{ id: string, mode: OnboardingModeId, label: string, description: string, estimatedTimeMin: number, optional: boolean, completedAt: null, skippedAt: null }}
 */
function createModeStep(mode) {
  const template = MODE_TEMPLATES[mode] || {
    label: mode,
    description: mode,
  };
  return {
    id: `step_${mode}_1`,
    mode,
    label: template.label,
    description: template.description,
    estimatedTimeMin: 0,
    optional: false,
    completedAt: null,
    skippedAt: null,
  };
}

/**
 * R-FLOW-1 — Theory mode (before R-FLOW-1b).
 * @param {{ sourceVsExplained: string, pace: string }} responses
 * @returns {'slow'|'rsvp'|'read'}
 */
function resolveTheoryModeBase(responses) {
  if (responses.sourceVsExplained === "original") return "slow";
  return responses.pace === "urgent" ? "rsvp" : "read";
}

/**
 * Count images attributable to the study scope.
 * `shared.images` is document-wide; when `scopedMarkdown` is provided, only
 * `![pith-image:id]` tokens present in that text count (OQ-addendum-1).
 * When `scopedMarkdown` is omitted/null, falls back to document-wide `images.length`.
 *
 * @param {Array<{ imageId?: string }> | null | undefined} images
 * @param {string | null | undefined} scopedMarkdown
 * @returns {number}
 */
export function countScopedImages(images, scopedMarkdown) {
  if (!Array.isArray(images) || images.length === 0) return 0;
  if (scopedMarkdown == null) return images.length;
  const idsInScope = new Set(findPithImageTokenIds(String(scopedMarkdown)));
  if (idsInScope.size === 0) return 0;
  let n = 0;
  for (const img of images) {
    const id = String(img?.imageId || "").trim();
    if (id && idsInScope.has(id)) n += 1;
  }
  return n;
}

/**
 * R-FLOW-1 + R-FLOW-1b — Theory mode with diagram-density override.
 * @param {{ sourceVsExplained: string, pace: string }} responses
 * @param {number} imageCount
 * @returns {{ theoryMode: 'slow'|'rsvp'|'read', diagramOverride: boolean }}
 */
function resolveTheoryMode(responses, imageCount = 0) {
  const base = resolveTheoryModeBase(responses);
  if (
    base === "rsvp" &&
    Number(imageCount) >= IMAGE_DENSITY_THRESHOLD
  ) {
    return { theoryMode: "read", diagramOverride: true };
  }
  return { theoryMode: base, diagramOverride: false };
}

/**
 * R-FLOW-3 — Memorization mode.
 * @param {{ memorizationVsUnderstanding: string }} responses
 * @returns {'cloze'|'questions'}
 */
function resolveMemorizationMode(responses) {
  return responses.memorizationVsUnderstanding === "memorize" ? "cloze" : "questions";
}

/**
 * @param {string | null | undefined} practiceMatchStatus
 * @returns {boolean}
 */
function shouldIncludePractice(practiceMatchStatus) {
  return practiceMatchStatus === "full" || practiceMatchStatus === "partial";
}

/**
 * @param {{ pace: string }} responses
 * @param {'slow'|'rsvp'|'read'} theoryMode
 * @returns {number}
 */
function resolveBlockCountMultiplier(responses, theoryMode) {
  if (responses.pace === "urgent" && (theoryMode === "rsvp" || theoryMode === "read")) {
    return PACE_URGENT_BLOCK_MULTIPLIER;
  }
  return 1;
}

/**
 * @param {boolean} socraticEnabled
 * @param {string} socraticModality
 * @returns {{ followUps: number, totalTurns: number } | null}
 */
function resolveTurnCapOverride(socraticEnabled, socraticModality) {
  if (!socraticEnabled || socraticModality !== "text") return null;
  return {
    followUps: Math.max(0, RSVP_READ_BASE_FOLLOW_UPS - TEXT_MODALITY_TURN_REDUCTION),
    totalTurns: Math.max(1, RSVP_READ_BASE_TOTAL_TURNS - TEXT_MODALITY_TURN_REDUCTION),
  };
}

/**
 * @param {boolean} socraticEnabled
 * @param {'cloze'|'questions'} memorizationMode
 * @param {string} memorizationVsUnderstanding
 * @returns {number | null}
 */
function resolveSocraticRatio(socraticEnabled, memorizationMode, memorizationVsUnderstanding) {
  if (!socraticEnabled || memorizationMode === "cloze") return null;
  if (memorizationVsUnderstanding === "both") return SOCRATIC_RATIO_BOTH;
  if (memorizationVsUnderstanding === "understand") return SOCRATIC_RATIO_UNDERSTAND;
  return null;
}

/**
 * @param {object} ctx
 * @param {OnboardingModeId[]} ctx.flow
 * @param {object} ctx.responses
 * @param {boolean} ctx.socraticEnabled
 * @param {number} ctx.blockCountMultiplier
 * @param {boolean} [ctx.diagramOverride]
 * @returns {string}
 */
function buildReasoning({ flow, responses, socraticEnabled, blockCountMultiplier, diagramOverride }) {
  const parts = [`Recommended flow: ${flow.join(" → ")}.`];
  if (responses.sourceVsExplained === "original") {
    parts.push("Original-text preference → Slow.");
  } else if (diagramOverride) {
    parts.push("Urgent pace with dense figures → Read.");
  } else if (responses.pace === "urgent") {
    parts.push("Urgent pace → RSVP.");
  } else {
    parts.push("Explained/indifferent source → Read.");
  }
  if (flow.includes("practice")) {
    parts.push("Matched practice domain included after theory.");
  }
  if (responses.memorizationVsUnderstanding === "memorize") {
    parts.push("Memorize preference → Cloze.");
  } else {
    parts.push("Understanding focus → Questions.");
  }
  if (!socraticEnabled) {
    parts.push("Socratic avoided — quiz-only path.");
  } else if (responses.socraticModality === "text") {
    parts.push("Text Socratic with reduced turn caps.");
  }
  if (blockCountMultiplier !== 1) {
    parts.push("Urgent pace reduces block count.");
  }
  return parts.join(" ");
}

/**
 * Pure onboarding mode recommendation.
 * @param {{
 *   onboardingResponses: {
 *     socraticModality: 'voice'|'text'|'avoid',
 *     pace: 'deep'|'moderate'|'urgent',
 *     memorizationVsUnderstanding: 'memorize'|'both'|'understand',
 *     sourceVsExplained: 'original'|'explained'|'indifferent',
 *     answeredAt?: number,
 *   },
 *   textMetrics?: object | null,
 *   pedagogicalMeta?: object | null,
 *   practiceMatchStatus?: 'full'|'partial'|'none'|null,
 *   images?: Array<{ imageId?: string }> | null,
 *   scopedMarkdown?: string | null,
 * }} input
 * @returns {{
 *   flow: OnboardingModeId[],
 *   params: {
 *     blockCountMultiplier: number,
 *     socraticEnabled: boolean,
 *     socraticTurnCapOverride: { followUps: number, totalTurns: number } | null,
 *     socraticRatio: number | null,
 *   },
 *   reasoning: string,
 *   computedAt: number,
 * }}
 */
export function computeOnboardingModeRecommendation({
  onboardingResponses,
  textMetrics: _textMetrics,
  pedagogicalMeta: _pedagogicalMeta,
  practiceMatchStatus = null,
  images = null,
  scopedMarkdown = null,
} = {}) {
  if (!onboardingResponses || typeof onboardingResponses !== "object") {
    throw new TypeError("computeOnboardingModeRecommendation requires onboardingResponses");
  }
  const responses = onboardingResponses;
  const imageCount = countScopedImages(images, scopedMarkdown);
  const { theoryMode, diagramOverride } = resolveTheoryMode(responses, imageCount);
  const memorizationMode = resolveMemorizationMode(responses);

  /** @type {OnboardingModeId[]} */
  const flow = [theoryMode];
  if (shouldIncludePractice(practiceMatchStatus)) flow.push("practice");
  flow.push(memorizationMode);

  const socraticEnabled = responses.socraticModality !== "avoid";
  const blockCountMultiplier = resolveBlockCountMultiplier(responses, theoryMode);
  const socraticTurnCapOverride = resolveTurnCapOverride(
    socraticEnabled,
    responses.socraticModality,
  );
  const socraticRatio = resolveSocraticRatio(
    socraticEnabled,
    memorizationMode,
    responses.memorizationVsUnderstanding,
  );

  return {
    flow,
    params: {
      blockCountMultiplier,
      socraticEnabled,
      socraticTurnCapOverride,
      socraticRatio,
    },
    reasoning: buildReasoning({
      flow,
      responses,
      socraticEnabled,
      blockCountMultiplier,
      diagramOverride,
    }),
    computedAt: Date.now(),
  };
}

/**
 * @param {Array<{ mode?: string }>|undefined} primaryFlow
 * @param {OnboardingModeId[]} flow
 * @returns {boolean}
 */
function flowModesAlign(primaryFlow, flow) {
  if (!Array.isArray(primaryFlow) || primaryFlow.length !== flow.length) return false;
  return primaryFlow.every((step, i) => step?.mode === flow[i]);
}

/**
 * Map algorithm result onto existing modeRecommendation shape (additive).
 * @param {ReturnType<typeof computeOnboardingModeRecommendation>} algo
 * @param {Record<string, unknown> | null} [existing]
 * @returns {Record<string, unknown>}
 */
export function mapOnboardingRecommendationToModeRecommendation(algo, existing = null) {
  const primaryFlow = (algo.flow || []).map((mode) => createModeStep(mode));
  const align = flowModesAlign(existing?.primaryFlow, algo.flow);

  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    onboardingFlow: algo.flow,
    params: algo.params,
    reasoning: algo.reasoning,
    computedAt: algo.computedAt,
    method: "onboarding",
    primaryFlow,
    currentStepIndex: align ? Number(existing.currentStepIndex) || 0 : 0,
    completedSteps: align && Array.isArray(existing.completedSteps) ? existing.completedSteps : [],
    userOverride: align ? Boolean(existing.userOverride) : false,
  };
}

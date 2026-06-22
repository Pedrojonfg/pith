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

/** Interview capture — max LLM follow-up rounds after fixed opener (20260620-nodoc-interview-capture). */
export const INTERVIEW_MAX_FOLLOWUP_ROUNDS = 4;

/** Minimum answered turns before interview synthesis (20260620-nodoc-interview-capture). */
export const INTERVIEW_MIN_ANSWERED_TURNS = 2;

/** Registry connection lazy decay threshold in days (20260620-typed-weighted-connections). */
export const CONNECTION_DECAY_DAYS = 30;

/** Vault embedding quality layer (20260629-vault-embedding). */
export const VAULT_EMBEDDING_FLAGS = Object.freeze({
  VAULT_EMBEDDINGS_ENABLED: true,
  VAULT_NOVELTY_SCORING_ENABLED: true,
  VAULT_DEDUP_GATES_ENABLED: true,
  VAULT_CONTRADICTION_CHECK_ENABLED: true,
  DOC_SIMILARITY_ENABLED: true,
  CROSS_PROJECT_DEDUP_ENABLED: false,
  EMBEDDING_OUTPUT_DIMENSIONALITY: 768,
  MAX_CONTRADICTION_CHECKS_PER_DPP_RUN: 20,
});

export function isVaultEmbeddingsFlagEnabled() {
  return VAULT_EMBEDDING_FLAGS.VAULT_EMBEDDINGS_ENABLED === true;
}

export function isVaultNoveltyScoringEnabled() {
  return isVaultEmbeddingsFlagEnabled() && VAULT_EMBEDDING_FLAGS.VAULT_NOVELTY_SCORING_ENABLED === true;
}

export function isVaultDedupGatesEnabled() {
  return isVaultEmbeddingsFlagEnabled() && VAULT_EMBEDDING_FLAGS.VAULT_DEDUP_GATES_ENABLED === true;
}

export function isVaultContradictionCheckEnabled() {
  return (
    isVaultEmbeddingsFlagEnabled() &&
    VAULT_EMBEDDING_FLAGS.VAULT_CONTRADICTION_CHECK_ENABLED === true
  );
}

export function isDocSimilarityEnabled() {
  return isVaultEmbeddingsFlagEnabled() && VAULT_EMBEDDING_FLAGS.DOC_SIMILARITY_ENABLED === true;
}

export function isCrossProjectDedupEnabled() {
  return VAULT_EMBEDDING_FLAGS.CROSS_PROJECT_DEDUP_ENABLED === true;
}

export function getEmbeddingOutputDimensionality() {
  return VAULT_EMBEDDING_FLAGS.EMBEDDING_OUTPUT_DIMENSIONALITY;
}

export function getMaxContradictionChecksPerDppRun() {
  return VAULT_EMBEDDING_FLAGS.MAX_CONTRADICTION_CHECKS_PER_DPP_RUN;
}

/** Adaptive knowledge probing (20260630-adaptive-knowledge-probing). */
export const ADAPTIVE_PROBING_FLAGS = Object.freeze({
  ADAPTIVE_PROBING_ENABLED: true,
  BASE_RATE_PRIOR: 0.25,
  HIGH_CONFIDENCE_SKIP_THRESHOLD: 0.9,
  LOW_CONFIDENCE_SKIP_THRESHOLD: 0.1,
  UPWARD_PROPAGATION_DAMPING: 0.6,
  DOWNWARD_PROPAGATION_DAMPING: 0.8,
  MAX_PROPAGATION_HOPS: 2,
  ADAPTIVE_PROBING_EARLY_STOP: false,
});

export function isAdaptiveProbingEnabled() {
  return (
    ADAPTIVE_PROBING_FLAGS.ADAPTIVE_PROBING_ENABLED === true &&
    isPrePackingAssessmentEnabled()
  );
}

export function getAdaptiveProbingFlags() {
  return ADAPTIVE_PROBING_FLAGS;
}

/** Pedagogical principles layer (20260701-pedagogical-principles). */
export const PEDAGOGICAL_FLAGS = Object.freeze({
  DETERMINISTIC_FACTUAL_QUESTIONS_ENABLED: true,
  MAX_CLASSIFICATION_LLM_CALLS_PER_DOC: 1,
  COMPREHENSION_GATE_ENABLED: true,
  HIGHLIGHT_WORD_BUDGET: 150,
  /** Secondary sort penalty for gap_fill items (Pith-calibrated placeholder). */
  GAP_FILL_PRIORITY_PENALTY: 2.0,
  MAX_GAP_FILL_PER_SESSION: 3,
  NOVELTY_BIASED_PACKING_ENABLED: false,
  TARGET_NOVELTY_RATIO: 0.7,
  NOVELTY_BLEND_WEIGHT: 0.15,
  /** Heuristic confidence below this triggers batched LLM classification. */
  FACTUAL_CLASSIFIER_LLM_THRESHOLD: 0.55,
});

export function isDeterministicFactualQuestionsEnabled() {
  return PEDAGOGICAL_FLAGS.DETERMINISTIC_FACTUAL_QUESTIONS_ENABLED === true;
}

export function isComprehensionGateEnabled() {
  return PEDAGOGICAL_FLAGS.COMPREHENSION_GATE_ENABLED === true;
}

export function isNoveltyBiasedPackingEnabled() {
  return PEDAGOGICAL_FLAGS.NOVELTY_BIASED_PACKING_ENABLED === true;
}

export function getPedagogicalFlags() {
  return PEDAGOGICAL_FLAGS;
}

/** Book-enriched nodoc interview (20260622-book-enriched-nodoc). */
export const BOOK_LOOKUP_FLAGS = Object.freeze({
  BOOK_LOOKUP_ENABLED: true,
  MAX_COVER_SIZE_BYTES: 524288,
  BOOK_LOOKUP_TIMEOUT_MS: 5000,
  BOOK_TOC_MIN_ENTRIES: 3,
  BOOK_DESCRIPTION_MIN_CHARS: 100,
  BOOK_TOC_MAX_OPENING_QUESTIONS: 6,
});

export function isBookLookupEnabled() {
  return BOOK_LOOKUP_FLAGS.BOOK_LOOKUP_ENABLED === true;
}

/** Feature flags — RSVP assessment reposition (20260611-rsvp-assessment-reposition). */

import { LS_ASSESSMENT_BEFORE_PACKING_KEY, LS_SHARED_ASSESSMENT_GATE_KEY, LS_SOURCE_FIDELITY_STRICT_KEY } from "../config.js";

export const ASSESSMENT_FLAGS = Object.freeze({
  /** @deprecated Use getAssessmentBeforePackingPreference / isPrePackingAssessmentEnabled instead. */
  ASSESSMENT_BEFORE_PACKING: true,
  ASSESSMENT_USE_QUESTIONS_UI: true,
  /** Safety ceiling only; count driven by n_test + n_socratic. */
  ASSESSMENT_ITEMS_MAX: 23,
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
    isSharedPreModeAssessmentEnabled() &&
    isAssessmentQuestionsUiEnabled()
  );
}

export function getSharedAssessmentGatePreference() {
  try {
    const pref = localStorage.getItem(LS_SHARED_ASSESSMENT_GATE_KEY);
    if (pref !== null) return JSON.parse(pref) === true;
    const legacy = localStorage.getItem(LS_ASSESSMENT_BEFORE_PACKING_KEY);
    if (legacy !== null) return JSON.parse(legacy) === true;
    return true;
  } catch {
    return true;
  }
}

export function saveSharedAssessmentGatePreference(enabled) {
  try {
    localStorage.setItem(LS_SHARED_ASSESSMENT_GATE_KEY, JSON.stringify(enabled === true));
  } catch {
    // ignore
  }
}

export function getAssessmentBeforePackingPreference() {
  try {
    const pref = localStorage.getItem(LS_ASSESSMENT_BEFORE_PACKING_KEY);
    if (pref === null) return true;
    return JSON.parse(pref) === true;
  } catch {
    return true;
  }
}

export function saveAssessmentBeforePackingPreference(enabled) {
  try {
    localStorage.setItem(LS_ASSESSMENT_BEFORE_PACKING_KEY, JSON.stringify(enabled === true));
  } catch {
    // ignore
  }
}

/** RSVP pre-packing assessment is disabled; knowledge check runs only via the shared pre-mode gate. */
export function isPrePackingAssessmentEnabled() {
  return false;
}

/** Shared pre-mode assessment gate (20260702-shared-pre-mode-assessment). */
export function isSharedPreModeAssessmentEnabled() {
  return getSharedAssessmentGatePreference() === true;
}

export function isAssessmentQuestionsUiEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_USE_QUESTIONS_UI === true;
}

/** Source fidelity strict mode (20260613-source-fidelity Phase C). */
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

/** Minimum concept count floor for viable inventory (20260622-fix-inventory-merge-truncation). */
export const MIN_CONCEPTS_ABSOLUTE = 5;

/** Chars per expected concept for min-viable scaling (unvalidated placeholder). */
export const MIN_CHARS_PER_CONCEPT = 5000;

/**
 * Minimum concepts required before DPP may mark inventory ready.
 * @param {number} [charCount]
 * @returns {number}
 */
export function minViableConcepts(charCount = 0) {
  const chars = Math.max(0, Math.floor(Number(charCount) || 0));
  return Math.max(MIN_CONCEPTS_ABSOLUTE, Math.floor(chars / MIN_CHARS_PER_CONCEPT));
}

/** Max idle time before a stuck DPP run is retried or failed (20260622-fix-dpp-recalculation-guard). */
export const DPP_STALE_TIMEOUT_MS = 10 * 60 * 1000;

/** Auto-retries after STALE_RUN before surfacing failed to the user. */
export const MAX_DPP_STALE_RETRIES = 2;

/** Allow re-run when preparation is still pending with no persisted activity timestamp. */
export const DPP_PENDING_GRACE_MS = 30 * 1000;

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

/** Semantic concept anchoring (20260703-semantic-concept-anchoring). */
export const CONCEPT_ANCHORING_FLAGS = Object.freeze({
  SEMANTIC_ANCHORING_ENABLED: false,
  CONCEPT_ANCHOR_COMPOSITION_ENABLED: true,
});

export function isSemanticAnchoringEnabled() {
  return CONCEPT_ANCHORING_FLAGS.SEMANTIC_ANCHORING_ENABLED === true;
}

/** Embedding-assisted T1.2 inventory merge (20260710-embedding-inventory-dedup). */
export const INVENTORY_MERGE_EMBED_FLAGS = Object.freeze({
  EMBEDDING_ASSISTED_INVENTORY_MERGE_ENABLED: true,
  /** shadow | auto | full — only when ENABLED */
  INVENTORY_MERGE_EMBED_MODE: "shadow",
});

export function isEmbeddingAssistedInventoryMergeEnabled() {
  return INVENTORY_MERGE_EMBED_FLAGS.EMBEDDING_ASSISTED_INVENTORY_MERGE_ENABLED === true;
}

export function getInventoryMergeEmbedMode() {
  const mode = String(INVENTORY_MERGE_EMBED_FLAGS.INVENTORY_MERGE_EMBED_MODE || "shadow").trim();
  return ["shadow", "auto", "full"].includes(mode) ? mode : "shadow";
}

export function isConceptAnchorCompositionEnabled() {
  return CONCEPT_ANCHORING_FLAGS.CONCEPT_ANCHOR_COMPOSITION_ENABLED !== false;
}

/** Adaptive knowledge probing (20260630-adaptive-knowledge-probing). */
export const ADAPTIVE_PROBING_FLAGS = Object.freeze({
  ADAPTIVE_PROBING_ENABLED: true,
  BASE_RATE_PRIOR: 0.25,
  /**
   * Seeded belief at/above this skips the concept from the probe question set.
   * Unvalidated placeholder — pending post-launch calibration (was 0.9; 0.80 excludes green prior 0.85).
   */
  HIGH_CONFIDENCE_SKIP_THRESHOLD: 0.8,
  LOW_CONFIDENCE_SKIP_THRESHOLD: 0.1,
  UPWARD_PROPAGATION_DAMPING: 0.6,
  DOWNWARD_PROPAGATION_DAMPING: 0.8,
  MAX_PROPAGATION_HOPS: 2,
  /** When true, stop quiz once remaining-concept mean entropy is low. */
  ADAPTIVE_PROBING_EARLY_STOP: true,
  /**
   * Mean binary entropy over remaining unasked concepts below which we early-stop.
   * Unvalidated placeholder — pending post-launch calibration.
   * (binaryEntropy(0.92) ≈ 0.40; current upward propagation rarely exceeds ~0.68 belief.)
   */
  ADAPTIVE_EARLY_STOP_MEAN_ENTROPY_THRESHOLD: 0.45,
});

export function isAdaptiveProbingEnabled() {
  return (
    ADAPTIVE_PROBING_FLAGS.ADAPTIVE_PROBING_ENABLED === true &&
    isSharedPreModeAssessmentEnabled()
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
  /** Threshold concepts (20260703-threshold-generative-pedagogy). */
  THRESHOLD_CONCEPTS_ENABLED: true,
  THRESHOLD_TARGET_FRACTION: 0.12,
  THRESHOLD_LLM_CONFIRM_ENABLED: true,
  THRESHOLD_BORDERLINE_LOW: 0.35,
  THRESHOLD_BORDERLINE_HIGH: 0.65,
  THRESHOLD_RSVP_WPM_CAP: 250,
});

export function isThresholdConceptsEnabled() {
  return PEDAGOGICAL_FLAGS.THRESHOLD_CONCEPTS_ENABLED !== false;
}

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

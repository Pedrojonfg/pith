/**
 * Embedding similarity thresholds — placeholders (spec §10).
 * Calibrate against real Pith data before tightening.
 */

export const EMBEDDING_MODEL_VERSION = "gemini-embedding-001";

/** Generation floor for dedup candidate pairs (cosine similarity). */
export const DEDUP_GENERATION_FLOOR = 0.55;

/** Hard gate G3 floor — full merge proposal threshold. */
export const DEDUP_HARD_GATE_THRESHOLD = 0.72;

/** Related document badge threshold (R5.4). */
export const DOC_SIMILARITY_RELATED_THRESHOLD = 0.55;

/** Near-duplicate upload warning threshold (R5.4). */
export const DOC_SIMILARITY_DUPLICATE_THRESHOLD = 0.64;

/** Top concept names joined for document concepts embedding (R5.1). */
export const DOC_SIMILARITY_TOP_CONCEPTS = 10;

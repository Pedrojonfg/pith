/**
 * Inventory merge embedding thresholds — calibrated (spec R8).
 * @see specs/20260710-embedding-inventory-dedup/calibration-results.md
 */

/** Pairs at or above — auto-merge without LLM. */
export const MERGE_AUTO_THRESHOLD = 0.91;

/** Pairs in [REVIEW, AUTO) — LLM entailment arbitration. */
export const MERGE_REVIEW_THRESHOLD = 0.78;

/** Minimum cosine similarity to consider a candidate pair. */
export const INVENTORY_MERGE_PAIR_FLOOR = 0.72;

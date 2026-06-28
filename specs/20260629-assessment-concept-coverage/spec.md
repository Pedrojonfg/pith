# Feature Specification: Concept-Coverage Assessment Generation

**Feature Directory**: `specs/20260629-assessment-concept-coverage/`  
**Status**: Approved — ready for implementation  
**Supersedes**: Truncation-error behavior in `generateHolisticPrePackingAssessmentItems`

## Problem statement

Holistic pre-packing assessment asks the LLM for N questions in one response where N scales with inventory size. Large inventories produce truncated JSON; partial recovery then fails on question-count mismatch and blocks the entire flow. Correctness should be measured by **concept coverage**, not question count.

## Goals

- G1: Assessment generation never throws a hard error due to truncation; partial results are valid.
- G2: Every concept in `conceptInventory` has at most one assessment question.
- G3: After generation, the system knows which concepts were assessed and which were not.
- G4: `knowledge_profile` fed to `packInventoryToBlocks` is keyed by concept id.
- G5: Batch size per LLM call capped at 20 concepts to prevent truncation.
- G6: Uncovered concepts after retry rounds are recorded as `assessed: false`, never a blocking error.

## Non-goals

- No relational (edge) questions — single-concept coverage only.
- No change to question UI format (stem/options) beyond required `concept_id`.
- No SM-2 or vault changes.
- No UI changes to pre-packing assessment or results screens.

## Functional requirements

### R1 — Batch size cap (max 20 concepts per LLM call)

Split inventory into batches of at most 20 concepts; run batches in parallel within concurrency limits.

### R2 — One question per concept per batch

Each batch prompt requests exactly one MCQ per concept with required `concept_id`. Temperature 0.3; `max_tokens` 6000 per batch.

### R3 — Parse, validate, track coverage

After each batch: parse JSON, partial recovery on failure, drop invalid/missing `concept_id`, dedupe by concept (keep first).

### R4 — Retry uncovered (max 2 rounds)

Re-batch uncovered concepts; after round 2, record remaining as not assessed. No error thrown.

### R5 — Build `knowledge_profile` from responses

`byConceptId` map with `{ assessed, correct? }` plus aggregate counts. Uses existing `concept_id` / `item_id` field names.

### R6 — `packInventoryToBlocks` consumes `byConceptId`

Neutral weight (0.5) for unassessed; deprioritize known (0.2); prioritize unknown (0.9).

### R7 — Remove question-count validator

`normalizePrePackingAssessmentQuestions` returns parsed valid questions without minimum count throw. Zero questions → skip assessment, `knowledge_profile` null.

### R8 — No UI changes

Assessment screens render whatever question array is returned.

## Assumptions

- Uses existing field names: `concept_id`, `item_id`, `question`, `answer` (letter A–D).
- Holistic mode (`HOLISTIC_ASSESSMENT_ENABLED`) uses concept-coverage batching; legacy tier-1 path unchanged.
- Pack LLM prompt receives derived `items` array from `byConceptId` for backward compatibility.

## Success criteria

- 70-concept inventory completes assessment without hard error.
- `assessedCount + notAssessedCount === inventory.length`.
- `packInventoryToBlocks` accepts new profile shape and null profile.
- All LLM failure → silent skip with neutral packing weights.

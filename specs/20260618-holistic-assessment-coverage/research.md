# Research: Holistic Pre-Packing Assessment Coverage

**Feature**: `20260618-holistic-assessment-coverage`

## R1 — Why assessment feels "beginning-only"

**Findings**:

1. `ASSESSMENT_ITEMS_MAX: 7` in `flags.js` clamps `resolvePrePackingQuestionConfig` to 2+1 typical.
2. `truncateMaterialExcerpt(text, 12000)` in `buildPrePackingAssessmentSystemPrompt` keeps only document start.
3. Single LLM call with full inventory but tiny material → model anchors on early concepts.
4. Legacy `generateAssessmentQuestions` explicitly sampled first blocks via step distribution (post-pack path; less relevant but same bias pattern).

**Decision**: Holistic path bypasses session n_test cap and uses per-section material via `buildInventoryChunks`.

## R2 — Budget formula

**Decision**:

```text
conceptTest = clamp(ceil(N * 0.5), 6, 40)
edgeTest    = clamp(ceil(E * 0.35), edges>=4 ? 2 : 0, 12)
n_test      = min(conceptTest + edgeTest, HOLISTIC_ASSESSMENT_MAX - n_socratic)
n_socratic  = clamp(ceil(N / 15), 1, 5)
```

Adjust so `n_test + n_socratic ≤ 50` and `n_test + n_socratic ≥ 8` when N ≥ 12.

**Rationale**: ~half concepts probed via MCQ; edges get dedicated quota; socratic scales slowly for depth checks.

## R3 — Map-reduce batches

**Decision**: Reuse `buildInventoryChunks(docHierarchy, rawMarkdown)`. Each batch gets:

- Subset of concept ids whose `source_phrase` / order falls in section offsets, or round-robin if missing
- Subset of edges where both endpoints in batch (plus spillover edges in dedicated edge mini-batch if needed)
- Proportional `n_test` / `n_socratic` from plan

**Parallelism**: Same `INVENTORY_MAX_PARALLEL_CALLS` as inventory.

## R4 — Edge questions in Questions schema

**Decision**: Extend test items with optional `edge: { from, to }` (already in legacy MCQ normalizer). Prompt instructs relationship wording. Evaluator propagates mastery to both endpoints on correct answer (conservative on wrong).

## R5 — Feature flag

**Decision**: `HOLISTIC_ASSESSMENT_ENABLED: true` default when `ASSESSMENT_BEFORE_PACKING && ASSESSMENT_USE_QUESTIONS_UI`. Rollback: flag false → legacy single-call path with old cap.

## R6 — Prefetch key

**Decision**: Extend `buildPrefetchConfigKey` with `planHash` from stable JSON of batch labels + totals.

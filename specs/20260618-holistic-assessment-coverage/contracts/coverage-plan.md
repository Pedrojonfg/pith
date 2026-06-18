# Contract: Assessment Coverage Plan (pure)

**Module**: `src/js/assessment-coverage.js`

## `computeHolisticAssessmentBudget(inventory, edges)`

**Returns**: `HolisticAssessmentBudget`

- Pure, deterministic
- `inventory`: concept rows with `id`/`concept_id`
- `edges`: `{ from, to, type? }[]`

## `buildAssessmentCoveragePlan({ inventory, edges, docHierarchy, rawMarkdown, budget })`

**Returns**: `AssessmentCoveragePlan | null`

- Uses `buildInventoryChunks` when hierarchy present; else single batch with word-split fallback
- Assigns concepts to batches by `order` quantiles or offset overlap
- Assigns edges to batch when both endpoints present; orphan edges → last batch
- Distributes `budget.n_test` / `budget.n_socratic` proportionally to batch concept counts
- Sets `edgeTestQuota` on batches with edges
- `planHash`: SHA-less stable string `v1|labels|totals`

## `mergeHolisticAssessmentQuestions(batchResults, plan)`

- Concatenate question arrays in batch order
- Dedupe: same `concept_id` + normalized question stem → keep first
- Trim to `plan.totals` if LLM over-generated
- Throw if under 50% of expected test count

## `hashCoveragePlan(plan)`

- Export for prefetch key

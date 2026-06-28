# Research: Concept-Coverage Assessment

## Decision: Batch by concept count, not section budget

**Rationale**: Truncation occurs when output tokens exceed model limits. Fixed batch of 20 concepts × ~250 tokens ≈ 5000 tokens, safe under 6000 `max_tokens`.

**Alternatives**: Keep section-based plan with higher merge retries — still fails on count mismatch for large inventories.

## Decision: Use existing `concept_id` field names

**Rationale**: Codebase convention; avoids breaking assessment runner and response scoring.

## Decision: Bridge `byConceptId` → `items` for LLM pack prompt

**Rationale**: `buildConceptPackPrompt` expects mastery items; converting at pack time avoids prompt rewrite.

## Decision: Empty generation skips assessment

**Rationale**: Spec R7; `handlePrePackingSkip` path already packs with null profile.

## Open questions (resolved)

| Question | Answer |
|----------|--------|
| Where is profile built? | `evaluatePrePackingAssessmentResponses` in `api.js`, called from `finishPrePackingAssessment` |
| Pack signature? | `packInventoryToBlocks(..., { knowledgeProfile })` |
| Count-mismatch throws? | Only in `normalizePrePackingAssessmentQuestions` and holistic merge — both removed/replaced |
| Partial recovery shape? | `recoverPartialQuestionArray` returns `object[]` |

# Research: RSVP Pre-Generation Assessment Reliability

**Feature**: `20260616-fix-pregen-assessment`  
**Date**: 2026-06-12

## R1 — Root cause of silent skip

**Decision**: Confirmed bug — `prePackingFlow.itemsPromise` is created in `study.js` generate handler with legacy params (`maxItems` only) while `ASSESSMENT_USE_QUESTIONS_UI` routes `generatePrePackingAssessmentItems` through the Questions path requiring `n_test` + `n_socratic`. Missing values become `NaN`; generation fails; `.catch(() => [])` caches an empty array. `enterPrePackingAssessmentRunner` reuses that resolved promise and calls `handlePrePackingSkip()` without user acknowledgement.

**Rationale**: Reproduced by code inspection; matches user report "no assessment, no option".

**Alternatives considered**:
- Flag accidentally off — `ASSESSMENT_BEFORE_PACKING: true` in `flags.js`; not the issue
- Legacy UI hidden only — partial; pre-packing should replace it but never runs

## R2 — Prefetch strategy

**Decision**: Prefetch MUST call `generatePrePackingAssessmentItems` with the same arguments as the runner: `conceptInventory`, `cleanedText` as `materialText`, `n_test`/`n_socratic` from `resolvePrePackingQuestionConfig()`, `llmModel`, `language`. Remove `.catch(() => [])` — let the runner handle errors with explicit UX.

**Rationale**: FR-005; poisoned prefetch is the direct failure mode.

**Alternatives considered**:
- Disable prefetch entirely — slower UX, doesn't fix stale promise reuse
- Separate prefetch key by params hash — over-engineered; align params instead

## R3 — Failed generation UX

**Decision**: On assessment generation failure, show an error state on the knowledge-check entry (test screen chrome or lightweight interim card) with:
- Human-readable error message
- **Retry** (re-create `itemsPromise` with correct params)
- **Skip assessment** (existing `handlePrePackingSkip` — only on explicit click)

Do NOT auto-call `handlePrePackingSkip()` from catch blocks.

**Rationale**: FR-004, SC-002.

**Alternatives considered**:
- Toast only — easy to miss; user still lands in blocks
- Block entire generate flow — too harsh; skip must remain available

## R4 — Promise reuse guard

**Decision**: In `enterPrePackingAssessmentRunner`, if `itemsPromise` resolves to empty array OR was created without `prePackingFlow.prefetchConfigKey` matching current `resolvePrePackingQuestionConfig()` + inventory fingerprint, discard and regenerate.

**Rationale**: Defensive against race/stale prefetch during development and after retry.

**Alternatives considered**:
- Always null `itemsPromise` before enter — simpler but loses valid prefetch wins

## R5 — API input validation

**Decision**: At start of Questions-path in `generatePrePackingAssessmentItems`, reject non-finite `n_test`/`n_socratic` with clear error before LLM call. Treat `n_test + n_socratic <= 0` and `> ASSESSMENT_ITEMS_MAX` as hard errors.

**Rationale**: Fail fast; prevents NaN prompts.

**Alternatives considered**:
- Default to 2+1 when missing — hides caller bugs; spec requires create-form counts

## R6 — Post-generation assessment

**Decision**: No code changes expected if `goAfterBlocksConfirmed` + `setAssessmentUiDefaults` already gate legacy screen when `isPrePackingAssessmentEnabled()`. Add regression tests only; verify no other path calls `goToInitialAssessment()` in RSVP confirm flow.

**Rationale**: FR-006; owner wants pre-only.

**Alternatives considered**:
- Delete legacy screen HTML — out of scope; gate is sufficient for rollback

## R7 — Import index / resume

**Decision**: No change. Document in quickstart as known limitation per spec out-of-scope.

**Rationale**: Import bypasses inventory by design.

## R8 — Testing approach

**Decision**: New `cursor-tests/20260616_fix-pregen-assessment.mjs`:
- Pure: `resolvePrePackingQuestionConfig` cap logic (if exported or mirrored)
- `generatePrePackingAssessmentItems` throws on missing n_test/n_socratic (mock-free, no LLM)
- Contract: prefetch params builder (extract helper if needed for testability)
- Integration smoke: flag gate `goAfterBlocksConfirmed` behavior documented in test comments

Manual QA: 5× generate → knowledge check visible (quickstart).

**Rationale**: SC-001, SC-002, SC-003.

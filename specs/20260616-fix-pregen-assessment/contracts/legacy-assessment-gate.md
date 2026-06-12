# Contract: Legacy Post-Generation Assessment Gate

**Feature**: `20260616-fix-pregen-assessment`  
**Module**: `src/js/study.js`

## Rule

When `isPrePackingAssessmentEnabled()` returns true:

| Function | Required behaviour |
|----------|-------------------|
| `goAfterBlocksConfirmed(nBlocks)` | MUST call `goToSessionReady(nBlocks)` — MUST NOT call `goToInitialAssessment()` |
| `setAssessmentUiDefaults()` | MUST set `assessmentChoiceWrap.hidden = true` |
| `confirmBlocksBtn` success path | MUST only reach session ready via `goAfterBlocksConfirmed` |

## Unchanged entry points

These MAY still show legacy assessment only when pre-packing flag is **off** (rollback):
- `goToInitialAssessment()` when `!isPrePackingAssessmentEnabled()`

## Regression assertion (tests)

Document in cursor-tests:
- With flag on, `goAfterBlocksConfirmed` never routes to `screenInitialAssessment`
- `assessmentChoiceWrap` hidden when `setAssessmentUiDefaults` runs under flag on

## Out of scope

- Removing `screenInitialAssessment` from DOM
- Changing `generateAssessmentQuestions` / `runAssessment` internals (dead path when flag on)

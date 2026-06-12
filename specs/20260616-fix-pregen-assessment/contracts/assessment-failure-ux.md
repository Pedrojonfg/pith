# Contract: Assessment Generation Failure UX

**Feature**: `20260616-fix-pregen-assessment`  
**Modules**: `src/js/study.js`, `index.html` (minimal)

## Trigger

`generatePrePackingAssessmentItems` rejects OR returns zero questions after normalize.

## Required behaviour

| Step | Behaviour |
|------|-----------|
| 1 | Stay on knowledge-check entry — do NOT call `applyPackedBlocksToEditor` |
| 2 | Show user-visible error (`setTestError`, dedicated error region, or interim card) |
| 3 | Offer **Retry** — clears stale `itemsPromise`, regenerates with current config |
| 4 | Offer **Skip assessment** — existing skip handlers → `handlePrePackingSkip()` |

## Retry handler

```js
async function retryPrePackingAssessmentGeneration() {
  // clear itemsPromise, assessmentGenerationError
  // rebuild itemsPromise with resolvePrePackingQuestionConfig + inventory
  // re-enter runner or await and renderTestQuestion
}
```

## Removed behaviour

```js
// FORBIDDEN in catch paths:
await handlePrePackingSkip(); // without user click
```

Exception: user explicitly clicks skip button (including on error panel).

## Loading state

While `itemsPromise` pending after inventory:
- Show test screen with loading hint OR keep generate status until first question renders
- Skip chrome visible once assessment screen is shown (even during load)

## Copy (English UI default)

- Error: "Could not load knowledge check questions."
- Retry button: "Try again"
- Skip: "Skip assessment" (existing)

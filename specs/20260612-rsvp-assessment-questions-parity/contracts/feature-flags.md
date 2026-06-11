# Contract: Feature Flags (Questions Parity)

**Feature**: `20260612-rsvp-assessment-questions-parity`  
**Module**: `src/js/config/flags.js`

## New flags

```js
ASSESSMENT_USE_QUESTIONS_UI: true,   // use test/socratic screens for pre-packing quiz
ASSESSMENT_LEGACY_MCQ_UI: false,     // rollback to screenPrePackingAssessment + mcq normalizer
```

## Changed semantics

| Flag | Before | After |
|------|--------|-------|
| `ASSESSMENT_ITEMS_MAX` | max question count | safety ceiling only; count = n_test + n_socratic |

## Helpers

```js
export function isAssessmentQuestionsUiEnabled() {
  return ASSESSMENT_FLAGS.ASSESSMENT_USE_QUESTIONS_UI === true
    && !ASSESSMENT_FLAGS.ASSESSMENT_LEGACY_MCQ_UI;
}
```

## Interaction

- `isPrePackingAssessmentEnabled()` unchanged — gates entire pre-packing flow
- Questions UI flag only affects generation shape + runner inside that flow

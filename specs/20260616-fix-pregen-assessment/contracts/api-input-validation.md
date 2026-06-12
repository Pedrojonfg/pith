# Contract: generatePrePackingAssessmentItems Input Validation

**Feature**: `20260616-fix-pregen-assessment`  
**Module**: `src/js/api.js`

## Questions UI path (`isAssessmentQuestionsUiEnabled()`)

Before LLM call:

```js
const nTest = clampFiniteInt(n_test, 0, MAX_N_TEST);
const nSocratic = clampFiniteInt(n_socratic, 0, 3);
if (nTest + nSocratic <= 0) {
  throw new Error("Assessment needs at least one question (n_test + n_socratic).");
}
const cap = ASSESSMENT_FLAGS.ASSESSMENT_ITEMS_MAX;
if (nTest + nSocratic > cap) {
  throw new Error(`Assessment question count ${nTest + nSocratic} exceeds safety cap ${cap}.`);
}
```

`clampFiniteInt` MUST throw or coerce only from finite numbers — `Number(undefined)` must not silently become usable.

## Required caller params (Questions path)

| Param | Required |
|-------|----------|
| `conceptInventory` | yes, non-empty |
| `materialText` | yes, non-empty string |
| `n_test` | yes, finite ≥ 0 |
| `n_socratic` | yes, finite ≥ 0 |
| `llmModel` | yes |
| `language` | yes |

`maxItems` ignored when Questions UI enabled (documented).

## Error messages

Must be stable strings suitable for user-facing retry UI (no stack traces).

# Contract: Pre-Packing Assessment Generation (Questions Parity)

**Feature**: `20260612-rsvp-assessment-questions-parity`  
**Module**: `src/js/api.js`

## `buildPrePackingAssessmentSystemPrompt`

Pure function; mirrors `buildQuestionsOnlySystemPrompt` minus connection/explanation sections.

**Parameters**:
- `language`, `n_test`, `n_socratic`
- `conceptInventory`, `edges`
- `materialExcerpt` — concatenated source chunks referenced by inventory

**Rules** (must include same exports as Questions):
- `MC_OPTION_PARITY_RULES`
- `TEST_FEEDBACK_RULES`
- `QUESTION_PEDAGOGY_RULES`
- Exactly `n_test` test + `n_socratic` socratic
- Each question MUST include `concept_id` from inventory
- Prioritize THESIS, ARGUMENT concepts for coverage
- Order: all test first, then socratic

## `generatePrePackingAssessmentItems` (revised)

```js
/**
 * @returns {Promise<AssessmentQuestion[]>} Questions-mode shape, shuffled test options applied
 */
export async function generatePrePackingAssessmentItems({
  conceptInventory,
  edges,
  materialText,       // NEW — full or scoped cleaned text
  n_test,             // NEW — from resolveBlockQuestionConfig
  n_socratic,         // NEW
  llmModel,
  language,
})
```

### Post-processing pipeline

```text
parseModelJsonValue → normalizePrePackingAssessmentQuestions(raw, { n_test, n_socratic, inventory })
  → shuffleTestQuestionsInList
```

### `normalizePrePackingAssessmentQuestions` (new export)

- Reject if wrong counts after filter
- Validate `concept_id` ∈ inventory ids
- Run `normalizeTestQuestion` on each test item
- Strip invalid socratic fields
- Assign `item_id` if missing

### Deprecation

- `normalizeAssessmentItems` (mcq-only): keep for rollback behind `ASSESSMENT_LEGACY_MCQ_UI`
- `maxItems` param: ignored when Questions parity on; use `n_test + n_socratic`

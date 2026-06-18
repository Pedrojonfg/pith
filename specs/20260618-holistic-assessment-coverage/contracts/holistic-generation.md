# Contract: Holistic Assessment Generation

**Module**: `src/js/api.js`

## `generateHolisticPrePackingAssessmentItems(params)`

```js
/**
 * @param {object} params
 * @param {object[]} params.conceptInventory
 * @param {object[]} params.edges
 * @param {string} params.materialText
 * @param {object} [params.docHierarchy]
 * @param {AssessmentCoveragePlan} [params.plan] — if omitted, built internally
 * @param {function} [params.onProgress]
 * @param {string} params.llmModel
 * @param {string} [params.language]
 * @returns {Promise<object[]>} Questions-mode items
 */
```

### Flow

1. `computeHolisticAssessmentBudget` + `buildAssessmentCoveragePlan`
2. For each batch (parallel capped): `generatePrePackingAssessmentItems` with scoped inventory, edges, `materialExcerpt: batch.materialText`, batch counts, `edgeTestQuota` in prompt
3. `mergeHolisticAssessmentQuestions`
4. `shuffleTestQuestionsInList`

### Prompt additions (`buildPrePackingAssessmentSystemPrompt`)

- When `edgeTestQuota > 0`: require that many test questions with `edge: {from,to}` and relationship-focused stems
- When `materialExcerpt` is full section: do not truncate further if under 24k chars
- Instruction: spread concept coverage across provided inventory subset; avoid duplicate concept_ids

### `truncateMaterialExcerpt`

- Holistic path: `maxChars = 24000` for section chunks; no truncation under 24k

## study.js integration

- `createPrePackingItemsPromise` → `generateHolisticPrePackingAssessmentItems` when `isHolisticAssessmentEnabled()`
- `onProgress` → `setStatus` / pre-packing progress element
- `buildPrefetchConfigKey` includes `planHash`

## Evaluator (`evaluatePrePackingAssessmentResponses`)

- If item has `edge`, on correct test answer set both concepts partial/full; on wrong/none set conservative none/low partial

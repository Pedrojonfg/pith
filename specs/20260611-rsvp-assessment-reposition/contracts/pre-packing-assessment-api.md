# Contract: Pre-Packing Assessment API

**Feature**: `20260611-rsvp-assessment-reposition`  
**Module**: `src/js/api.js`

## `generatePrePackingAssessmentItems`

```js
/**
 * @param {object} params
 * @param {object[]} params.conceptInventory - full inventory (never filtered)
 * @param {object[]} [params.edges] - optional edge list from graph normalization
 * @param {number} [params.maxItems] - default from flags ASSESSMENT_ITEMS_MAX
 * @param {string} params.llmModel
 * @param {string} [params.language]
 * @returns {Promise<AssessmentItem[]>}
 */
export async function generatePrePackingAssessmentItems({ ... })
```

### Prompt rules

- Cover highest-value `concept_id`s and important edges
- Prioritize THESIS, ARGUMENT over TERM
- MCQ with 3–4 options; JSON array only
- Each item references exactly one `concept_id` OR one `edge`

### Parser

- Use existing `parseModelJsonValue` / safe parse patterns
- Validate `item_id`, `question`, `type === 'mcq'`, `options.length >= 2`
- Throw on empty array; caller may fallback to skip assessment

## `evaluatePrePackingAssessmentResponses`

```js
/**
 * @param {object} params
 * @param {AssessmentItem[]} params.items
 * @param {Array<{ item_id: string, answer: string }>} params.responses
 * @param {string} params.llmModel
 * @returns {Promise<KnowledgeProfile>}
 */
export async function evaluatePrePackingAssessmentResponses({ ... })
```

### Evaluator rules

- Map "I don't know" / empty → `mastery: 'none'`, low confidence
- Conservative: `full` requires precision; `partial` requires demonstrated understanding
- Output `coverage` = unique concept_ids in items / total inventory concepts × 100
- Set `assessed_at` to ISO timestamp in normalizer (not LLM)

### Failure

- On parse/LLM error: return `null`; caller continues pack without profile

## Normalizers (export for tests)

```js
export function normalizeAssessmentItems(raw)
export function normalizeKnowledgeProfile(raw, { inventory, items, responses })
```

# Contract: Assessment Evaluation (Questions Parity)

**Feature**: `20260612-rsvp-assessment-questions-parity`  
**Module**: `src/js/api.js`

## `scorePrePackingTestResponses` (new, pure)

```js
/**
 * @param {AssessmentQuestion[]} items
 * @param {Array<{ item_id, userAnswer, questionType }>} responses
 * @returns {Array<{ concept_id, mastery, confidence }>}
 */
export function scorePrePackingTestResponses(items, responses)
```

**Rules**:
- Match `userAnswer` letter to `item.answer` (case-insensitive)
- `PREPACKING_DONT_KNOW` / empty → `none`, confidence 0.1
- Correct → `partial`, confidence 0.65 (conservative default)
- Wrong → `none`, confidence 0.2

## `evaluatePrePackingAssessmentResponses` (revised)

```js
export async function evaluatePrePackingAssessmentResponses({
  items,           // AssessmentQuestion[]
  responses,       // assessmentResponses shape
  conceptInventory,
  llmModel,
  language,
})
```

**Pipeline**:
1. Split responses by `questionType`
2. `scorePrePackingTestResponses` for test items (sync)
3. LLM batch for socratic items only (if any)
4. Merge by `concept_id` (max mastery priority)
5. `normalizeKnowledgeProfile` — extend to accept pre-scored test rows
6. Return `KnowledgeProfile` or `null` on total failure

### Socratic LLM prompt (delta)

- Input: question, student answer, concept_id label, correct rubric hints from inventory
- Output per item: mastery + confidence
- Conservative: `full` requires precision

## Failure

- If socratic LLM fails but test scored: return profile from test only (partial coverage)
- If no scorable data: `null` → pack without profile

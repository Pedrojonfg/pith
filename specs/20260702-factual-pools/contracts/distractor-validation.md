# Contract: Distractor Sourcing and Validation

## sourceDistractorCandidates(concept, conceptInventory, { category, fact })

Returns `string[]` — sibling values excluding `fact`, same subtype rules:

- **date**: other years from inventory, prefer temporal distance
- **number_with_unit**: same normalized unit only
- **proper_noun**: other proper-noun entries (no kind filter in v1)

## validateDistractorBatch(items, options?)

**Input**: `[{ fact, candidateDistractors }]`

**Output**: `[{ fact, approvedDistractors, rejected }]`

- One LLM call for entire batch (options.callLlm injectable for tests).
- Model: DeepSeek default (`DEFAULT_LLM_MODEL` or session `llmModel`).
- Reject reasons: `ambiguous`, `also_correct`, `implausible`.
- `max_tokens`: `DISTRACTOR_VALIDATION_MAX_TOKENS` (~80 tokens per item).

## buildFactualBlockQuestions(params)

Orchestrates stem + sourcing + validation + MCQ assembly.

**Returns**:
```js
{
  questions: BlockTestQuestion[],
  llmFallbackConceptIds: string[],
  validationCallCount: number
}
```

Per-concept LLM fallback when sourced pool < 3 or approved < 3.

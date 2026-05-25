# Contract: Gap Synthesis (Step C)

**Function**: `synthesizeAssessmentGaps({ assessmentResults, questions, responses, blockIndex, language })`  
**Location**: `src/js/api.js`  
**Transport**: DeepSeek Chat Completions, `response_format: { type: "json_object" }`

## Request context (user message)

JSON payload:

```json
{
  "blocks": [{ "id": 1, "title": "...", "classification": "weak|strong|ok" }],
  "responses": [
    {
      "block_id": 1,
      "question": "...",
      "chosen": "A",
      "correct": false,
      "skipped": false
    }
  ]
}
```

## Response schema (model MUST return only this object)

```json
{
  "gaps_by_block": {
    "1": [
      { "label": "Flux through a closed surface", "evidence": "Confused divergence vs flux" }
    ]
  }
}
```

## Prompt rules (system)

- Respond in `{language}`.
- Infer 0–3 gaps per block with wrong/skipped answers; 0 for strong blocks unless clear misconception.
- Labels: short noun phrases (student-facing), no block numbers in label.
- Max 8 gaps total across session.
- No arithmetic remediation tasks—conceptual gaps only.
- `max_tokens`: 1024, `temperature`: 0.2.

## Client behavior

| Outcome | Client action |
|---------|----------------|
| 200 + valid JSON | Store draft in UI state |
| Invalid JSON | Retry once; then `synthesis_status: error` |
| >30s | Abort; `synthesis_status: timeout` |
| No API key | Skip C; `synthesis_status: skipped` |

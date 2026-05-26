# Contract: Questions-Only Block Regeneration

**Functions**: `buildQuestionsOnlySystemPrompt`, `buildQuestionsOnlyUserContent`, `deepSeekRegenerateBlockQuestions`  
**Location**: `src/js/api.js`  
**Orchestrator**: `generateQuestionsOnlyForIndex` in `src/js/session.js`

## When to call

Client calls when:
- Adjust path changes only `n_test` and/or `n_socratic`
- Prefetched block has non-empty `explanation` string
- Material chunk exists for `blockIndex`

Otherwise call `deepSeekGenerateBlockJson` (full block).

## API shape

```javascript
deepSeekRegenerateBlockQuestions({
  llmModel,
  language,
  n_test,
  n_socratic,
  blockTitle,
  explanation,      // fixed — model must NOT rewrite
  materialText,     // chunk for grounding
  gap_focus = [],
})
```

**Returns**: `{ questions: Question[], concepts?: Concept[] }`

## System prompt rules

- MUST NOT modify or return `explanation` or `title`
- Generate exactly `n_test` test + `n_socratic` socratic questions
- Reuse `MC_OPTION_PARITY_RULES`, `QUESTION_PEDAGOGY_RULES`, gap_focus section from full prompt
- Questions MUST be consistent with the provided explanation (test understanding of that text + material)
- LaTeX / JSON escaping rules same as full block generation
- Response schema:

```json
{
  "questions": [ /* same as BLOCK_JSON_SCHEMA.questions */ ],
  "concepts": [ { "term": "...", "definition": "..." } ]
}
```

`concepts` optional; if omitted, client keeps prior `concepts` from prefetched block.

## User content

Includes:
1. Block title
2. **Fixed explanation** (markdown) con instrucción explícita: "Do not rewrite this explanation"
3. Source material chunk
4. Gap list (if any)

## Client merge

```javascript
const merged = {
  ...prefetchedBlock,
  questions: response.questions,
  concepts: response.concepts?.length ? response.concepts : prefetchedBlock.concepts,
};
```

Then `buildBlockConfigKey(newCfg)` → update session + optional prefetch slot.

## Retries

Same as `deepSeekGenerateBlockJson`: 1 retry on JSON parse failure.

## Validation (dev)

- `console.warn` if `questions.length !== n_test + n_socratic`
- `warnBlockGenerationProfileMismatch` adapted for questions-only counts

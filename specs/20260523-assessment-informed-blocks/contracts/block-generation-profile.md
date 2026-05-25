# Contract: Block Generation with Pedagogical Profile

**Function**: `deepSeekGenerateBlockJson({ ..., explanation_profile, gap_focus, n_test, n_socratic })`  
**Location**: `src/js/api.js`

## New parameters

| Param | Type | Default |
|-------|------|---------|
| `explanation_profile` | `"thorough"` \| `"brief_deep"` | `"thorough"` |
| `gap_focus` | `string[]` | `[]` |

## Prompt fragments (system)

### thorough (unchanged baseline)

- 400–600 words; teach; sub-concepts; examples; confusion points.

### brief_deep

- 150–220 words.
- Structure: (1) core definitions, (2) key formula/expression in LaTeX if relevant, (3) one micro-example, (4) one common pitfall.
- Do NOT re-teach the full block linearly.

### gap_focus (appended when `gap_focus.length > 0`)

- List gaps as numbered bullets in user content.
- Generate at least one question per gap (test or socratic).
- Questions must target the gap (application, discriminate common errors).
- If `n_test + n_socratic` < gap count, prioritize gaps with assessment misses first (order in array).

## Caller obligations (`session.js` / `study.js`)

- `resolveBlockQuestionConfig(idx)` returns `{ n_test, n_socratic, explanation_profile, gap_focus }`.
- Prefetch `configKey` becomes: `{n_test}|{n_socratic}|{explanation_profile}|{gap_focus.join(',')}` (hash or joined string).

## Output validation (client, dev)

- Log warning if strong + brief_deep explanation word count outside 120–250.
- Log warning if weak block gap count exceeds generated questions count.

# Contract: Block Generation with Pedagogical Profile

**Function**: `deepSeekGenerateBlockJson({ ..., explanation_profile, gap_focus, n_test, n_socratic })`  
**Location**: `src/js/api.js`

## New parameters

| Param | Type | Default |
|-------|------|---------|
| `explanation_profile` | `"thorough"` \| `"brief_deep"` | `"thorough"` |
| `gap_focus` | `string[]` | `[]` |

## Prompt fragments (system)

### thorough (RSVP baseline)

- RSVP structure: Hook → Core definition → Technical layer → Concrete example → Contrast → Connection.
- Subject-verb-object; ≤15 words per sentence; definition → example → implication; 200–300 words max.
- Transform source; no linear regurgitation.

### brief_deep

- Max 120 words; compressed RSVP (HOOK, CORE DEFINITION, TECHNICAL LAYER, CONTRAST only).
- Do NOT re-teach linearly from source.

### vocabulary (`title` starts with `Key terms:`)

- 6–10 terms; one paragraph per term (definition, why, example).
- No Hook/Core narrative structure.

### gap_focus (appended when `gap_focus.length > 0`)

- List gaps as numbered bullets in user content.
- Generate at least one question per gap (test or socratic).
- Questions must target the gap (application, discriminate common errors).
- If `n_test + n_socratic` < gap count, prioritize gaps with assessment misses first (order in array).

## Caller obligations (`session.js` / `study.js`)

- `resolveBlockQuestionConfig(idx)` returns `{ n_test, n_socratic, explanation_profile, gap_focus }`.
- Prefetch `configKey` becomes: `{n_test}|{n_socratic}|{explanation_profile}|{gap_focus.join(',')}` (hash or joined string).

## Output validation (client, dev)

- Log warning if strong + brief_deep explanation word count outside 60–140 (target max 120).
- Log warning if weak block gap count exceeds generated questions count.

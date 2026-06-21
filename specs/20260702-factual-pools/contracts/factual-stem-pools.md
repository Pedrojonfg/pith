# Contract: Factual Stem Pools and Rotation

## createStemRotator(sessionState?)

Returns `{ selectStem(category, language) => string }`.

- Tracks used indices per category in `sessionState.usedByCategory` or internal map.
- No repeat until pool exhausted; then allows repeat.

## FACTUAL_STEM_POOLS

`Record<language, Record<category, string[]>>` — 8–12 variants each for `date`, `number_with_unit`, `proper_noun`.

## resolveFactualCategory(concept, sourceText)

Returns `FactualCategory`. Returns `null` for definition/enumeration/conceptual.

Uses classifier signals; `defined_as` and `enumeration` → null.

## generateFactualStem(concept, sourceText, language, rotator)

Returns `{ question, answer, category, templateKey } | null`.

- Does not build MCQ options.
- `null` → LLM fallback for this concept.

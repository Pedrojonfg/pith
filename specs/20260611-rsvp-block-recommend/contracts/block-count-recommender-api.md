# Contract: Block Count Recommender API

**Module**: `src/js/recommendation/block-count-recommender.js`

## Public API

```js
/**
 * @param {import('../data-model').BlockCountSignals} signals
 * @returns {import('../data-model').BlockCountRecommendation}
 */
export function computeBlockCountRecommendation(signals)

/**
 * @param {import('../data-model').BlockCountRecommendation} rec
 * @returns {string} — 1–2 sentence EN explanation for UI
 */
export function formatBlockCountReasoning(rec)
```

## Constants

| Name | Value |
|------|-------|
| `MIN_BLOCKS` | `5` |
| `MAX_BLOCKS` | `60` |
| `WORDS_PER_BLOCK_TARGET` | `2200` |
| `BASE_CONCEPTS_PER_BLOCK` | `5` |

## Formula (normative)

1. `targetConceptsPerBlock = 5 - (conceptualLoad - 1) * 0.75`
2. `conceptN = ceil(conceptCount / targetConceptsPerBlock)`
3. `wordN = ceil(wordCount / 2200)`
4. `sectionN = sectionCount > 0 ? sectionCount : 0`
5. `rawN = max(conceptN, wordN, sectionN || conceptN)`
6. Apply `sizeCategory === 'tiny'` → `rawN = min(rawN, 8)`
7. Multiplier (first match):
   - `genre === 'philosophical' || argumentativeDensity >= 4` → `1.15`
   - `genre === 'scientific_theoretical' && conceptualLoad >= 4` → `1.10`
   - `genre === 'lecture_notes' || firstPersonRatio > 0.03` → `0.95`
   - else → `1.0`
8. `nBlocks = clamp(round(rawN * multiplier), 5, 60)`

## Output invariants

- `computedAt` = `Date.now()`
- `factors` populated for tests
- `signalsUsed` lists non-default inputs that affected multiplier or rawN
- `reasoning` mentions `conceptCount` and at least one of `wordCount`, `conceptualLoad`, `genre`

## Tests

`cursor-tests/20260611_rsvp-block-recommend.mjs` — min 12 cases:
- 10 concepts, 3k words → low N (≥5)
- 80 concepts, dense philosophical → higher N
- tiny sizeCategory caps
- clamp 5 and 60 boundaries
- missing meta defaults to conceptualLoad 3

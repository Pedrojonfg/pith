# Contract: Mode Recommender API

**Module**: `src/js/recommendation/recommender.js`

## Public API

```js
/**
 * @param {TextMetrics} textMetrics
 * @param {PedagogicalMeta} pedagogicalMeta
 * @param {{ method?: 'llm_meta' | 'deterministic' }} [options]
 * @returns {ModeRecommendation}
 */
export function computeModeRecommendation(textMetrics, pedagogicalMeta, options = {})

/**
 * @param {TextMetrics} textMetrics
 * @param {ModeStep[]} steps
 * @returns {ModeStep[]} — steps con estimatedTimeMin rellenado
 */
export function computeStepTimes(textMetrics, steps)
```

## Decision table (priority top → bottom)

1. `argumentativeDensity >= 4` OR `genre === 'philosophical'` → Slow → Cloze → Review | quick: RSVP → Questions
2. `genre === 'scientific_theoretical'` AND `conceptualLoad >= 3` → Slow → Cloze → Review | quick: RSVP → Cloze
3. `genre === 'scientific_empirical'` OR (`hasBibliography` AND NOT philosophical) → RSVP → Questions → Cloze | quick: RSVP → Questions
4. `genre === 'lecture_notes'` OR `firstPersonRatio > 0.03` → RSVP → Questions | quick: Questions
5. `genre === 'textbook_chapter'` → RSVP → Cloze → Review | quick: RSVP → Questions
6. `sizeCategory === 'tiny'` → Questions | quick: Questions
7. `primaryLearningGoal === 'learn_procedure'` → RSVP → Questions | quick: Questions
8. **default** → RSVP → Questions | quick: Questions

`isPhilosophical` = genre philosophical OR argumentativeDensity >= 4.

## ModeStep templates

Cada modo tiene `label` y `description` estáticos en español (ver spec). IDs: `step_{mode}_1`.

## Output invariants

- `computedAt` = `Date.now()` al calcular
- `analysis.*` poblado desde inputs
- `reasoning` en español, 1–2 frases
- `currentStepIndex` = 0, `completedSteps` = [], `userOverride` = false en creación

## Tests

`cursor-tests/20260609_flow-recommendation-recommender.mjs`

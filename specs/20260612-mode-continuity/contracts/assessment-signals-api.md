# Contract: Assessment Signals API

**Module**: `src/js/assessment-signals.js` (NEW)

## Types

See `data-model.md` — `AssessmentSignal`.

## `extractSignalsFromBlockSession(slice, sourceMode)`

```js
/**
 * @param {object} slice - RSVP or Questions session slice
 * @param {'rsvp'|'questions'} sourceMode
 * @returns {AssessmentSignal[]}
 */
export function extractSignalsFromBlockSession(slice, sourceMode)
```

### Mapping rules

- Iterate `_responses.blocks[bi].questions[qi]`
- Skip if `user_answer` empty
- Compare `user_answer` vs `correct_answer` (case-insensitive trim) or existing `is_correct` if present
- Map question → concept via:
  1. `block.concepts[qi]` or `block.concept_ids[qi]` if present
  2. Else `block.title` / first concept in `block.concepts`
  3. Else synthetic key `block_${bi}_q_${qi}` with `conceptLabel` from question stem (truncated)

## `mergeAssessmentSignals(existing, incoming)`

Immutable merge into map by `canonicalId` (or `conceptLabel` fallback).

- Increment `wrongCount` / `correctCount`
- Update `lastResult`, `lastAt`
- Recompute `weight` per data-model formula

```js
export function mergeAssessmentSignals(existing, incoming) → AssessmentSignal[]
```

## `syncAssessmentSignalsToShared(docId, slice, sourceMode)`

**Module**: `session-store.js`

```js
export function syncAssessmentSignalsToShared(docId, slice, sourceMode)
```

Calls extract + merge + `saveActiveSession`.

**Call sites** (minimum):
- After RSVP/Questions block assessment submit
- On `updateFlowProgress` / mode exit hook (batch sync)

## `prioritizeByAssessmentSignals(items, signals, options)`

```js
/**
 * @param {object[]} items - cloze items with concept/node refs
 * @param {AssessmentSignal[]} signals
 * @param {{ targetWeakRatio?: number }} [options]  // default 0.6
 * @returns {object[]} reordered items
 */
export function prioritizeByAssessmentSignals(items, signals, options)
```

**Weak concept**: `weight > 0` and `lastResult === 'wrong'` or `wrongCount > correctCount`.

Sort key: `weight` desc, then original index asc.

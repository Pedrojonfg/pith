# Contract: sm2-core

**Module**: `src/js/sm2.js`  
**FR**: FR-001–FR-007, FR-013–FR-014

Pure functions only — no `localStorage`, no DOM, no imports from session-store.

## Constants

```javascript
export const SM2_DEFAULTS = {
  interval: 1,
  easeFactor: 2.5,
  repetitions: 0,
  scheduledDue: /* caller supplies or Date.now() */,
  lastReviewed: null,
  observations: [],
};

export const THRESHOLD_RATIO = 0.7;
export const MS_PER_DAY = 86_400_000;
```

## API

```javascript
createSmItem(params) → SmItem
// params: sourceType, sourceId, docId, title, contentPreview (+ optional overrides)
// assigns id via crypto.randomUUID(), createdAt = now

normalizeSmItem(raw) → SmItem | null
// maps legacy shapes; returns null if unrecoverable

isOnTime(item, now = Date.now()) → boolean

updateSmItem(item, quality, now = Date.now()) → SmItem
// quality: integer 0–5
// always appends observation; mutates SM-2 fields only when on-time

buildReviewQueue(items, now = Date.now()) → SmItem[]
// stable sort scheduledDue asc

getQueueStats(items, now = Date.now()) → { dueNow, dueToday, total }
```

## SM-2 ease update (on-time only)

```javascript
easeFactor = max(1.3, easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
```

## Tests (`cursor-tests/sm2.test.mjs`)

1. First review always on-time
2. Early review does not change interval
3. On-time q≥3 increases interval
4. On-time q&lt;3 resets to interval 1
5. Queue sorts by scheduledDue
6. Ease factor floor 1.3
7. Observation always recorded (early included)
8. normalizeSmItem maps nextReview → scheduledDue

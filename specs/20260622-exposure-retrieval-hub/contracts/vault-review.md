# Contract: vault-review

**Modules**: `src/js/review.js`, `src/js/session-store.js`, `src/js/study.js`  
**FR**: FR-008, FR-009, FR-010, FR-011

## runVaultSm2ReviewSession()

```javascript
export function runVaultSm2ReviewSession()
```

1. `const due = getSmItemsDueToday()` — no docId → all sessions.
2. `sm2ReviewQueue = buildReviewQueue(due)`.
3. `sm2ReviewDocId = ''` (vault mode flag) or track per-item only.
4. Reuse `renderSm2ReviewItem`, `handleSm2QualityClick`, `showSm2ReviewSummary`.

## Per-item write path

On quality rating:

```javascript
const originDocId = item.docId;
upsertSmItem(originDocId, { id: item.id, quality, ... });
```

- Do **not** call `saveActiveSession` on wrong doc.
- Do **not** require `setActiveDocument(originDocId)`.

## UI entry

- `#btnVaultReview` on `screenDocLibrary` with `#vaultReviewBadge` (aggregate due count).
- Remove `#btnReview` from `screenModeSelect`.

## Badge helpers

```javascript
export function getVaultReviewDueCount() {
  return getSmItemsDueToday().length;
}
```

`refreshReviewBadge()` on mode select → remove or repurpose; new `refreshVaultReviewBadge()` on doc library.

## Legacy paths

- `startReviewFromRecommendation()` — update to open vault Review or hub (not per-doc block review fallback).
- `enterModeWithContinuity('review')` — redirect to `runVaultSm2ReviewSession()`.

## Display

Show originating document name on SM-2 card when `item.docId` differs from active doc (optional P2: subtitle under title).

# Quickstart QA: Exposure / Retrieval Hub

**Feature**: `20260622-exposure-retrieval-hub`  
**Branch**: `20260622-exposure-retrieval-hub`

## Prerequisites

- Recall mode merged (`20260621-recall-mode`)
- SM-2 + assessment signals merged
- At least one document with RSVP or Slow completed (warm path)
- Two documents with due `smItems` (vault Review path)

## Automated

```bash
node cursor-tests/20260622_exposure-retrieval-hub.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs   # after JS/HTML/CSS bump
```

## Wave 1 — Taxonomy + hub shell (T01–T02)

1. Import `getDocumentRetrievalModes()` in DevTools → returns 3 modes, no `review`.
2. Hub screen visible via `showScreen('retrievalHub')`; three equal cards, Cloze not disabled.

## Wave 2 — Hub navigation (T03–T04)

1. Active doc → "Practice this document" → hub → pick Recall → enters recall flow.
2. Pick Cloze from cold doc (inventory only) → pipeline runs, no hub generate step.
3. Hub back button returns to mode select.

## Wave 3 — Exposure end (T07)

1. Complete Slow phase 3 → lands on hub (not mode select alone).
2. Complete RSVP all blocks → complete screen CTA → hub.
3. Mid-block RSVP test flow unchanged (no hub interrupt).

## Wave 4 — Assessment signals (T05)

1. RSVP wrong answers on concept X → hub → Questions → block with X appears early.
2. Same doc → Recall → question references X in first half of set.

## Wave 5 — Vault Review (T06–T08)

1. Doc library shows "Review" with badge = sum of due items all docs.
2. Mode select has **no** Review button.
3. Vault Review queue contains items from doc A and doc B.
4. Rate item from doc A while doc B active → doc A `smItems` updated in storage.

## Wave 6 — Migration (T09)

1. Load legacy session JSON with `modes.review` config → migrates without crash; review config unused.

## Wave 7 — Regression

1. `enterModeWithContinuity` for each mode still works from mode select exposure radios.
2. Flow panel on mode select still renders; hub has no recommender badges.
3. Cloze/Recall/Questions resume slices still work.

## ROADMAP closure

Mark T01–T10 `[x]` in `ROADMAP.md` when all waves pass.

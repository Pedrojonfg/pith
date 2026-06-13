# Quickstart QA: SM-2 Priority Queue

**Feature**: `20260620-sm2-priority-queue`  
**Branch**: `20260620-sm2-priority-queue`

## Prerequisites

- Active document session with normalized markdown
- API key not required for SM-2 unit tests; optional for full RSVP flow
- Post A+ vault optional (for vault_concept regression)

## Automated

```bash
node cursor-tests/sm2.test.mjs
node cursor-tests/20260620_sm2-priority-queue.mjs
```

## Wave 1 — Core module (T01)

1. Run `sm2.test.mjs` — all 8 cases green.
2. DevTools: `import { createSmItem, updateSmItem } from './src/js/sm2.js'` — manual early vs on-time check.

## Wave 2 — Session store (T02)

1. `upsertSmItem` with legacy `{ nextReview, sourceMode: 'cloze' }` → read back canonical `scheduledDue`, `sourceType: 'cloze_item'`.
2. `getSmItemsDueToday` returns items with `scheduledDue <= end of today`.

## Wave 3 — RSVP ingestion (T03)

1. Start RSVP, complete one block with correct first-try answer.
2. DevTools → `getSession(docId).shared.smItems` — one `rsvp_block` item.
3. Answer wrong on second block → interval resets on next on-time review.

## Wave 4 — Mode select badge (T04)

1. Seed item with `scheduledDue = now - 1000`.
2. Open mode select → Review badge shows `1`.
3. Set all items future due → badge hidden.

## Wave 5 — Review screen (T05)

1. Click Review on mode select.
2. Items appear soonest-due first.
3. Early item shows chip; submit → interval unchanged, `observations.length` +1.
4. On-time "I knew it" → `interval` grows, `scheduledDue` pushed forward.

## Wave 6 — Cloze + Slow (T06)

1. Complete one Cloze item → `cloze_item` in smItems.
2. Create Slow flashcard → `slow_flashcard` entry.

## Wave 7 — Vault regression (T07)

1. Vault entry with mastery &lt; 0.5 on doc topic.
2. Open mode select (triggers sync) → `vault_concept` item present.
3. Complete review → vault mastery updates; non-vault items preserved.

## Wave 8 — QA closure (T08)

1. Full test suite green.
2. Mark ROADMAP T01–T08 `[x]`.
3. SW update flow validated if assets changed.

## Regression

- Cloze pipeline still writes smItems on generate
- Doc library `smDue` count still works
- LLM "Review session" (`reviewSessionBtn`) still works
- Mode switch does not drop smItems

## Out of scope checks (should NOT be required)

- Review visual redesign
- BKT / FSRS
- User threshold settings
- Supabase sync

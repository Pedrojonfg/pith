# Research: SM-2 Priority Queue

**Feature**: `20260620-sm2-priority-queue` | **Date**: 2026-06-13

## R1 — Non-blocking SM-2 vs classic due-date gating

**Decision**: Sort all items by `scheduledDue` ascending; allow review anytime; advance SM-2 state only when `isOnTime(item, now)` is true.

**Rationale**: Matches product goal ("infinite table" — always something to do, urgent first). Early practice still feeds observation history for future BKT without punishing the user by resetting intervals incorrectly.

**Alternatives considered**:
- Classic hard due-date lock — rejected (blocks productive early review)
- FSRS — rejected (out of scope; SM-2 specified)
- Separate "practice" vs "graded" modes — rejected (extra UX complexity)

## R2 — On-time threshold (THRESHOLD_RATIO = 0.7)

**Decision**: On-time when `now >= scheduledDue - (intervalMs * (1 - THRESHOLD_RATIO))`, i.e. last 30% of the interval before scheduled due. First review (`lastReviewed === null`) always on-time.

**Rationale**: Prevents gaming intervals by reviewing immediately after last session while still allowing meaningful early cramming that is logged but not rewarded.

**Alternatives considered**:
- 50% threshold — too permissive for interval growth
- Hard scheduledDue only — equivalent to classic SM-2 blocking at the algorithm layer
- User-configurable — deferred per spec out-of-scope

## R3 — Legacy SmItem shape migration

**Decision**: Add `normalizeSmItem(raw) → SmItem` in `sm2.js` mapping:

| Legacy field | Canonical field |
|--------------|-----------------|
| `nextReview` | `scheduledDue` |
| `sourceMode` / `source` | `sourceType` (`rsvp`→`rsvp_block`, `cloze`→`cloze_item`, `vault_decay`→`vault_concept`) |
| `reviewCount` | `repetitions` |
| `question` + `answer` | `title` + `contentPreview` |
| `vaultEntryId` | `sourceId` when `sourceType === 'vault_concept'` |
| missing `observations` | `[]` |

Run normalization in `getSession` / `upsertSmItem` read paths; write canonical shape only.

**Rationale**: Cloze pipeline and Post A+ vault bridge already write partial shapes. Normalizing on read avoids one-shot migration scripts and keeps localStorage resilient.

**Alternatives considered**:
- Breaking change + wipe smItems — rejected (data loss)
- Dual-read forever in every consumer — rejected (complexity)

## R4 — Coexistence with vault/spaced-review.js

**Decision**: Update `buildVaultSmItem` to emit canonical shape (`sourceType: 'vault_concept'`, `scheduledDue` derived from priority offset, `title` from `conceptTitle`). Keep `syncVaultToReviewPool` selection logic unchanged.

**Rationale**: Post A+ T13 is complete; this feature consumes the pool with proper SM-2 updates on review. Vault mastery still updates via `applyVaultReviewObservation` when source is vault concept.

**Alternatives considered**:
- Rewrite vault bridge — rejected (scope)
- Ignore vault items in Review UI — rejected (FR-015)

## R5 — Review UI integration point

**Decision**: Add `btnReview` + `reviewBadge` on `screenModeSelect`. Extend `review.js` with `runSm2ReviewSession(docId)` using `buildReviewQueue`; keep existing LLM review session (`reviewSessionBtn`) as separate flow for block summaries.

**Rationale**: Spec calls for minimal UI on mode select; existing `screenReview` DOM can host SM-2 quality buttons without full redesign.

**Alternatives considered**:
- Replace LLM review entirely — rejected (different use case: block synthesis vs spaced items)
- New screen — rejected (unnecessary DOM)

## R6 — Quality mapping from study modes

**Decision**:

| Source | Outcome | Quality |
|--------|---------|---------|
| RSVP/Questions MCQ | Correct first try | 5 |
| RSVP/Questions MCQ | Correct after hesitation | 4 |
| RSVP/Questions MCQ | Correct with hint | 3 |
| RSVP/Questions MCQ | Wrong | 1 |
| RSVP/Questions MCQ | Skip / no answer | 2 |
| Cloze | EASY / MEDIUM / HARD / FAIL | 5 / 4 / 3 / 1 |
| Review self-rating | Perfect / Good / Hard / Forgot | 5 / 4 / 3 / 1 |

**Rationale**: Aligns with SM-2 0–5 scale where ≥3 passes; maps existing telemetry where available.

**Alternatives considered**:
- Always quality 4 — rejected (loses SM-2 signal)

## R7 — upsertSmItem contract

**Decision**: Keep `upsertSmItem(docId, item)`; merge by `id` if present, else by `(sourceType, sourceId)`. Callers use `createSmItem` + `updateSmItem` from `sm2.js` before upsert.

**Rationale**: Matches existing session-store API used by cloze pipeline and tests.

**Alternatives considered**:
- Session-object variant from draft spec — rejected (inconsistent with codebase)

## R8 — getSmItemsDueToday migration

**Decision**: Update `getSmItemsDueToday` to normalize items and filter `scheduledDue <= endOfToday` (keep name for backward compat; semantics align with SC-004 badge).

**Rationale**: `study.js` doc library and recommendation tracker already call this helper.

**Alternatives considered**:
- New `getSmItemsDueNow` only — rejected (duplicate call sites)

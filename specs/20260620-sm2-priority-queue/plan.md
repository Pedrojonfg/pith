# Implementation Plan: SM-2 Priority Queue

**Branch**: `20260620-sm2-priority-queue` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260620-sm2-priority-queue/spec.md`

## Summary

Implement a pure SM-2 module with temporal-threshold gating (early vs on-time reviews), canonical `SmItem` schema with observation history, legacy shape normalization, mode ingestion hooks (RSVP/Questions, Cloze, Slow flashcards), and minimal Review UI (mode-select badge + priority-queue study flow). Vault decay items from Post A+ T13 are migrated to the canonical shape without changing vault logic. Time orders the queue; it never blocks review.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session-store.js` (`upsertSmItem`, `getSmItemsDueToday`), `study.js`, `review.js`, `cloze/study.js`, `cloze/pipeline.js`, `slow/phase3.js`, `vault/spaced-review.js` (read-only bridge extension)

**Storage**: `localStorage['pith_doc_sessions']` → `DocumentSession.shared.smItems[]`

**Testing**: `cursor-tests/sm2.test.mjs` (unit), `cursor-tests/20260620_sm2-priority-queue.mjs` (integration)

**Target Platform**: SPA offline-first PWA

**Project Type**: Web application — vanilla JS modules + DOM

**Performance Goals**: `buildReviewQueue` + `getQueueStats` &lt; 5ms for 500 items; review screen renders next item &lt; 100ms

**Constraints**: Pure `sm2.js` (no side effects); English UI; bump `SW_VERSION` on shipped asset changes; extend existing `upsertSmItem(docId, item)` signature; do not break Post A+ vault review bridge

**Scale/Scope**: ~8 implementation tasks; one new core module; thin wiring in 4 mode files; minimal HTML/CSS for badge and early chip

**External prerequisites**: `20260609-unified-session`, `20260619-knowledge-vault-post-a-plus` T13 (vault → smItems bridge)

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| English prompts / UI | PASS | All new strings in English |
| No frameworks | PASS | Pure JS module + DOM |
| Simplicity / surgical | PASS | Single `sm2.js`; thin hooks |
| PWA versioning | PASS | SW bump when touching `src/js/**`, `index.html`, `src/css/**` |
| Testability | PASS | Pure functions unit-tested first |
| Heuristics in English | PASS | Quality mapping comments in English |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260620-sm2-priority-queue/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── sm2-core.md
│   ├── mode-ingestion.md
│   └── review-ui.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── sm2.js                    # NEW: pure SM-2 + queue (createSmItem, updateSmItem, isOnTime, buildReviewQueue, getQueueStats, normalizeSmItem)
├── session-store.js          # extend: normalize on read; getSmItemsDueToday → scheduledDue
├── sm2-ingest.js             # NEW (optional): registerOrUpdateSmItem, quality mappers
├── study.js                  # RSVP/Questions hooks; mode-select badge; Review nav
├── review.js                 # priority-queue study flow (replace LLM-only path for smItems)
├── cloze/study.js            # answer → smItems
├── cloze/pipeline.js         # persist uses canonical shape
├── slow/phase3.js            # flashcard → smItems
└── vault/spaced-review.js    # buildVaultSmItem → canonical shape

index.html                    # Review button + badge on screenModeSelect
src/css/main.css              # .review-badge, .review-early-chip

cursor-tests/
├── sm2.test.mjs
└── 20260620_sm2-priority-queue.mjs
```

**Structure Decision**: Core algorithm isolated in `sm2.js`; ingestion helpers colocated in `sm2-ingest.js` to keep `study.js` diffs small; vault bridge gets shape-only update.

## Complexity Tracking

No constitution violations requiring justification.

## Phase 0 Output

See [research.md](./research.md) — resolves legacy schema migration, on-time threshold, and coexistence with vault decay bridge.

## Phase 1 Output

- [data-model.md](./data-model.md)
- [contracts/](./contracts/)
- [quickstart.md](./quickstart.md)

## Phase 2

Task breakdown deferred to `/speckit-tasks` and [ROADMAP.md](../../ROADMAP.md).

# ROADMAP — shared-dpp-cache

**Feature:** specs/20260704-shared-dpp-cache | **Spec:** specs/20260704-shared-dpp-cache/spec.md | **Plan:** specs/20260704-shared-dpp-cache/plan.md  
**Created:** 2026-07-04

## Dependency diagram

```
T01 (migration) ─┬─→ T04 (persist) ─→ T06 (pipeline wire)
T02 (pure module) ─┤
T03 (write gate) ──┴─→ T05 (status align)
T07 (dev wipe)  ──────────────── parallel wave 3
T08 (tests QA)  ─── depends T06, T05
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | parallel |
| 2 | T04, T05 | parallel |
| 3 | T06 | sequential |
| 4 | T07, T08 | parallel |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Supabase migration `document_preparation_cache` | — | parallel | [x] |
| T02 | Pure module `shared-dpp-cache.js` | — | parallel | [x] |
| T03 | Write-on-complete gate in `document-preparation.js` | — | parallel | [x] |
| T04 | `shared-dpp-cache-persist.js` fetch/upsert | T01,T02 | parallel | [x] |
| T05 | Align `resolveCreateSessionPrepStatus` | T03 | parallel | [x] |
| T06 | Wire cache lookup/upsert in study.js + dpp-persistence | T04,T03 | sequential | [x] |
| T07 | Dev wipe (`src/js/dev/wipe-user-data.js`) | — | parallel | [x] |
| T08 | cursor-tests + quickstart closure | T06,T05 | parallel | [x] |

## Temporary subagents

Cleanup: 2026-07-04 (none created)

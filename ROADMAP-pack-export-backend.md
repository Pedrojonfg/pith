# ROADMAP — pack-export-backend

**Feature:** specs/20260716-pack-export-backend | **Spec:** specs/20260716-pack-export-backend/spec.md | **Plan:** specs/20260716-pack-export-backend/plan.md  
**Created:** 2026-07-16  
**Completed:** 2026-07-16

## Dependency diagram

```text
T01 (migration)
        \
T02 (snapshot+strip) ----\ 
                          +--> T04 (create+finalize) --> T05 (tests+SW)
T03 (rewrite+jaccard) ---/
```

## Waves

| Wave | Tasks | Mode | Status |
|------|-------|------|--------|
| 1 | T01, T02, T03 | sequential in-chat (pack-export.js conflict) | done |
| 2 | T04 | sequential | done |
| 3 | T05 | sequential | done |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Migration `shared_packs` + RLS + lookup RPC | — | parallel | [x] |
| T02 | Pure `buildPackSnapshot` + `stripSourceBearingFields` | — | parallel | [x] |
| T03 | Export `jaccardOverlap` + `rewritePackExcerpt` + overlap assert | — | parallel | [x] |
| T04 | `createPackDraft` + `finalizePack` + Supabase CRUD | T01,T02,T03 | sequential | [x] |
| T05 | Integration cursor-tests + SW bump + quickstart QA | T04 | sequential | [x] |

## Prompt per task

### T01 — Migration shared_packs
**Spec ref:** FR-003, FR-004, US4 | **Plan ref:** Implementation sequence §1 | **Files:** `supabase/migrations/20260716_shared_packs.sql`
**Success criterion:** Table + owner RLS + `lookup_shared_pack_by_code` SECURITY DEFINER; unique nullable `code`; published immutability trigger (code-only updates).
**On close:** `/validate` and mark `[x]`.

### T02 — Pure snapshot + strip
**Spec ref:** FR-001, FR-002, FR-006 strip steps | **Plan ref:** sequence §2 | **Files:** `src/js/pack-export.js`
**Success criterion:** Deep clone of allowed keys from `shared` + `modes`; strip removes rawMarkdown/slowSlice/cloze/images and inventory anchors.
**On close:** `/validate` and mark `[x]`.

### T03 — Rewrite + Jaccard
**Spec ref:** FR-007, SC-002 | **Plan ref:** sequence §3 | **Files:** `src/js/fidelity-validation.js`, `src/js/pack-export.js`
**Success criterion:** `jaccardOverlap` exported; rewrite via DeepSeek platform chat temp 0.3; gate `< 0.3`.
**On close:** `/validate` and mark `[x]`.

### T04 — createPackDraft + finalizePack
**Spec ref:** FR-005, FR-006, US1–3 | **Plan ref:** sequence §4 | **Files:** `src/js/pack-export.js`
**Success criterion:** Draft insert; finalize true identity; finalize false strip+rewrite+gate; LLM failure leaves draft.
**On close:** `/validate` and mark `[x]`.

### T05 — Tests + SW
**Spec ref:** SC-001–005 | **Plan ref:** sequence §5 | **Files:** `cursor-tests/20260716_pack-export-backend.mjs`, `src/js/sw-update.js`, `index.html`, `sw.js`
**Success criterion:** 63 assertions green; SW_VERSION `20260716_04` + CACHE_NAME `pith-v147`.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-16 — none created (in-chat sequential due to `pack-export.js` file conflict).

## Wave quality gates

- **Code review:** HIGH fixed — published immutability trigger (only `code` may change).
- **Ponytail:** emptied `if (includeSourceDocument)` branch → `if (!includeSourceDocument)`. Lean otherwise.

## Footnotes

- Mistral → DeepSeek per research.md §7.
- Jaccard threshold 0.3 exclusive.
- Modes taken from `session.modes` (not `shared.modes`).

# ROADMAP — book-enriched-nodoc

**Feature:** specs/20260622-book-enriched-nodoc | **Spec:** specs/20260622-book-enriched-nodoc/spec.md | **Plan:** specs/20260622-book-enriched-nodoc/plan.md  
**Created:** 2026-06-22

## Dependency diagram

```
T01 (migration) ──┬──► T03 (book-lookup) ──► T05 (UI) ──► T07 (tests)
T02 (flags+types) ┘         │                    │
                            └──► T06 (interview) ◄┘
T04 (vault tagging) ◄── T02
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03, T04 | parallel |
| 3 | T05 | sequential |
| 4 | T06 | sequential |
| 5 | T07 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Supabase `pith_book_cache` migration | — | parallel | [x] |
| T02 | Flags + session-types bookMeta + config key | — | parallel | [x] |
| T03 | `book-lookup.js` pipeline + cache | T01,T02 | parallel | [x] |
| T04 | Vault source_title/source_author tagging | T02 | parallel | [x] |
| T05 | Book search UI + study.js wiring | T03 | sequential | [x] |
| T06 | Interview opening + follow-up enrichment | T02,T05 | sequential | [x] |
| T07 | Integration tests + SW bump | T04,T05,T06 | sequential | [x] |

## Prompt per task

### T01 — Supabase migration
**Spec ref:** FR-003, data-model | **Plan ref:** Project Structure | **Files:** `supabase/migrations/20260622_pith_book_cache.sql`  
**Success criterion:** Table exists with schema from data-model; RLS disabled.  
**On close:** `/validate` and mark `[x]`.

### T02 — Flags + types + Google Books key
**Spec ref:** FR-006, FR-009 | **Plan ref:** Technical Context | **Files:** `src/js/config/flags.js`, `src/js/session-types.js`, `src/js/config.js`, `index.html`, `src/js/ui.js`, `src/js/main.js`  
**Success criterion:** BOOK_LOOKUP flags exported; bookMeta optional on uploadMeta; Settings field for Google Books key.  
**On close:** `/validate` and mark `[x]`.

### T03 — book-lookup.js
**Spec ref:** FR-002, FR-004, FR-005 | **Plan ref:** contracts/book-lookup.md | **Files:** `src/js/book-lookup.js`  
**Success criterion:** `lookupBook`, `buildCacheKey`, cache read/write, R1→R3 cascade, cover HEAD verify.  
**On close:** `/validate` and mark `[x]`.

### T04 — Vault tagging
**Spec ref:** FR-008 | **Plan ref:** research R2 | **Files:** `src/js/vault/normalization.js`, `src/js/vault/session-close.js`  
**Success criterion:** Book-enriched sessions stamp source_title/source_author on new vault entries.  
**On close:** `/validate` and mark `[x]`.

### T05 — Book search UI
**Spec ref:** US1, US2 | **Plan ref:** contracts/nodoc-book-ui.md | **Files:** `index.html`, `src/css/main.css`, `src/js/ui.js`, `src/js/study.js`, `src/js/session-store.js`  
**Success criterion:** Nodoc flow shows book search; skip/confirm/levelC panels; bookMeta persisted.  
**On close:** `/validate` and mark `[x]`.

### T06 — Interview enrichment
**Spec ref:** FR-007, US3 | **Plan ref:** research R4 | **Files:** `src/js/interview/opening-questions.js`, `src/js/interview/interview-api.js`, `src/js/study.js`  
**Success criterion:** Level A chapter questions; Level B first follow-up context; Level C unchanged.  
**On close:** `/validate` and mark `[x]`.

### T07 — Tests + SW bump
**Spec ref:** §14 testing checklist, quickstart | **Files:** `cursor-tests/20260622_book-enriched-nodoc.mjs`, `src/js/sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** cursor-tests pass; SW_VERSION bumped.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-22 — none created (sequential implementation in parent chat).

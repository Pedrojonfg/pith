# Implementation Plan: Book-Enriched Nodoc Interview

**Branch**: `20260622-book-enriched-nodoc` | **Date**: 2026-06-22 | **Spec**: [spec.md](./spec.md)

## Summary

Optional book metadata lookup enriches nodoc interview sessions: client-side API cascade (Open Library → Google Books → Wikipedia), global Supabase cache, confirmation UI with verified cover, Level A chapter opening questions, Level B LLM context on first follow-up, vault `source_title`/`source_author` tagging.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)  
**Primary Dependencies**: `supabase-client.js`, `session-store.js`, `session-types.js`, `opening-questions.js`, `interview-api.js`, `vault/session-close.js`, `vault/normalization.js`, `study.js`  
**Storage**: Supabase `pith_book_cache` + `uploadMeta.bookMeta` on DocumentSession  
**Testing**: `cursor-tests/20260622_book-enriched-nodoc.mjs`  
**Constraints**: English UI; no LLM for metadata; cover confirmation-only; SW bump on ship

## Constitution Check

| Principle | Status |
|-----------|--------|
| English UI / internal | PASS |
| No LLM on book lookup path | PASS |
| LLM max_tokens on follow-up (existing) | PASS |
| PWA versioning on src changes | PASS (T07) |
| UI minimal — optional sub-step | PASS |

## Project Structure

```text
supabase/migrations/20260622_pith_book_cache.sql
src/js/book-lookup.js
src/js/config/flags.js          # BOOK_LOOKUP_* flags
src/js/config.js                # LS_GOOGLE_BOOKS_KEY
src/js/session-types.js         # bookMeta typedef + validation
src/js/session-store.js         # setUploadMeta bookMeta merge
src/js/interview/opening-questions.js
src/js/interview/interview-api.js
src/js/vault/normalization.js
src/js/vault/session-close.js
src/js/study.js
src/js/ui.js
index.html
src/css/main.css
```

## Phase 0 Output

See [research.md](./research.md).

## Phase 1 Output

See [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).

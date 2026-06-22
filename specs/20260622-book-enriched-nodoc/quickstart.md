# Quickstart: Book-Enriched Nodoc Interview

## Prerequisites

- Nodoc interview capture shipped (`20260620-nodoc-interview-capture`)
- Supabase migration applied (`pith_book_cache`)
- Optional: Google Books API key in Settings

## Manual QA

1. Create session → "I don't have a file" → book search appears.
2. "Continue without search" → generic interview (no bookMeta in session).
3. Search "Sapiens" / "Harari" → confirmation with TOC indicator (Level A).
4. Confirm → opening question references a chapter title.
5. Complete interview → vault entries have `source_title` / `source_author`.
6. Repeat search for same book → instant (cache hit, no network to OL/GB/Wiki).
7. Settings: remove Google Books key → search still works via Open Library / Wikipedia.
8. Set `BOOK_LOOKUP_ENABLED: false` in flags → no book panel.

## Tests

```bash
node cursor-tests/20260622_book-enriched-nodoc.mjs
```

# Contract: book-lookup.js

## Exports

```javascript
export const COVERAGE_LEVELS = { A: 'A', B: 'B', C: 'C' };

export function buildCacheKey(title, author): string;

export async function lookupBook(title, author): Promise<BookMeta>;
```

## BookMeta return shape

Matches `shared.uploadMeta.bookMeta` in data-model.md.

## Pipeline order

1. Read `pith_book_cache` by `cache_key` — if hit, return mapped BookMeta (skip APIs).
2. Open Library search + editions TOC scan → Level A if TOC ≥ `BOOK_TOC_MIN_ENTRIES`.
3. Google Books (if API key) → Level B description + cover fallback.
4. Wikipedia summary → Level B description fallback.
5. Level C if nothing qualifies.
6. Cover HEAD verification before setting `coverUrl`.
7. Upsert cache row (non-blocking on failure).

## Timeouts

Each fetch: `BOOK_LOOKUP_TIMEOUT_MS` (5000ms) via AbortController.

## Side effects

- Supabase upsert only. Does not mutate DocumentSession.

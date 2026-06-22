# Data Model: Book-Enriched Nodoc Interview

## Supabase: `pith_book_cache`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | gen_random_uuid() |
| cache_key | text UNIQUE | `normalize(title)__normalize(author)` |
| title | text | Display title from best match |
| author | text \| null | |
| coverage_level | char(1) | 'A' \| 'B' \| 'C' |
| toc | jsonb \| null | `[{number?: string, title: string}]` |
| description | text \| null | Level B synopsis |
| cover_url | text \| null | Verified thumbnail URL |
| searched_at | timestamptz | default now() |

No RLS. No TTL.

## Session: `shared.uploadMeta.bookMeta`

```typescript
bookMeta?: {
  title: string;              // user-typed
  author: string;             // user-typed (may be empty)
  coverUrl: string | null;
  coverUrlVerified: boolean;
  coverLoadFailed: boolean;
  coverMimeType: string | null;
  coverFormatSupported: boolean;
  coverSizeBytes: number | null;
  coverSizeOk: boolean;
  level: 'A' | 'B' | 'C';
  toc: { number?: string; title: string }[] | null;
  description: string | null;
  cachedAt: number;
}
```

Presence of `bookMeta` = book-enriched session. `undefined` = generic nodoc.

## Vault entry extension

```typescript
source_title?: string;   // bookMeta.title when present at session close
source_author?: string;  // bookMeta.author when present
```

## Feature flags (`config/flags.js`)

| Flag | Default |
|------|---------|
| BOOK_LOOKUP_ENABLED | true |
| MAX_COVER_SIZE_BYTES | 524288 |
| BOOK_LOOKUP_TIMEOUT_MS | 5000 |
| BOOK_TOC_MIN_ENTRIES | 3 |
| BOOK_DESCRIPTION_MIN_CHARS | 100 |
| BOOK_TOC_MAX_OPENING_QUESTIONS | 6 |

## Coverage levels

| Level | Condition | Interview | Vault |
|-------|-----------|-----------|-------|
| A | TOC ≥ 3 entries | Chapter opening questions | source_title, source_author |
| B | description ≥ 100 chars | Generic opener + LLM context on 1st follow-up | source_title, source_author |
| C | No usable API data | Generic nodoc | source_title, source_author (user-typed) |

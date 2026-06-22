-- Book metadata global cache (20260622-book-enriched-nodoc)
-- Anonymous read/write — no user_id; shared across all users.

CREATE TABLE IF NOT EXISTS pith_book_cache (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key      text        UNIQUE NOT NULL,
  title          text        NOT NULL,
  author         text,
  coverage_level char(1)     NOT NULL CHECK (coverage_level IN ('A', 'B', 'C')),
  toc            jsonb,
  description    text,
  cover_url      text,
  searched_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pith_book_cache_cache_key_idx ON pith_book_cache (cache_key);

ALTER TABLE pith_book_cache DISABLE ROW LEVEL SECURITY;

-- Harden shared caches before public repo exposure.
-- Previous migrations left RLS disabled; with a committed anon key that
-- allows unauthenticated PostgREST access to all rows. Spec intent
-- (20260704-shared-dpp-cache): shared across authenticated users only.
-- @see geocode_cache pattern in 20260716152823_geocode_cache.sql

-- ---------------------------------------------------------------------------
-- document_preparation_cache
-- ---------------------------------------------------------------------------
ALTER TABLE public.document_preparation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_preparation_cache_select_authenticated"
  ON public.document_preparation_cache;
DROP POLICY IF EXISTS "document_preparation_cache_insert_authenticated"
  ON public.document_preparation_cache;
DROP POLICY IF EXISTS "document_preparation_cache_update_authenticated"
  ON public.document_preparation_cache;
DROP POLICY IF EXISTS "document_preparation_cache_delete_authenticated"
  ON public.document_preparation_cache;

CREATE POLICY "document_preparation_cache_select_authenticated"
  ON public.document_preparation_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "document_preparation_cache_insert_authenticated"
  ON public.document_preparation_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "document_preparation_cache_update_authenticated"
  ON public.document_preparation_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- No DELETE for authenticated: shared cache is append/upsert only from clients.
-- Service role bypasses RLS for admin/dev wipe tooling.

REVOKE ALL ON TABLE public.document_preparation_cache FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.document_preparation_cache TO authenticated;

-- ---------------------------------------------------------------------------
-- pith_book_cache
-- ---------------------------------------------------------------------------
ALTER TABLE public.pith_book_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pith_book_cache_select_authenticated"
  ON public.pith_book_cache;
DROP POLICY IF EXISTS "pith_book_cache_insert_authenticated"
  ON public.pith_book_cache;
DROP POLICY IF EXISTS "pith_book_cache_update_authenticated"
  ON public.pith_book_cache;

CREATE POLICY "pith_book_cache_select_authenticated"
  ON public.pith_book_cache
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "pith_book_cache_insert_authenticated"
  ON public.pith_book_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "pith_book_cache_update_authenticated"
  ON public.pith_book_cache
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.pith_book_cache FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.pith_book_cache TO authenticated;

-- Speeds llm-proxy per-user hourly rate checks.
CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_user_platform_created
  ON public.llm_usage_logs (user_id, created_at DESC)
  WHERE key_ownership = 'platform';

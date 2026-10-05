-- Shared caches: no direct table access from clients.
-- Reads by cache_key via SECURITY DEFINER RPC; writes via shared-cache-upsert Edge Function (service role).

-- document_preparation_cache
ALTER TABLE public.document_preparation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_preparation_cache_select_authenticated"
  ON public.document_preparation_cache;
DROP POLICY IF EXISTS "document_preparation_cache_insert_authenticated"
  ON public.document_preparation_cache;
DROP POLICY IF EXISTS "document_preparation_cache_update_authenticated"
  ON public.document_preparation_cache;
DROP POLICY IF EXISTS "document_preparation_cache_delete_authenticated"
  ON public.document_preparation_cache;

CREATE OR REPLACE FUNCTION public.get_document_preparation_cache(p_cache_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT artifacts
  FROM public.document_preparation_cache
  WHERE cache_key = p_cache_key
  LIMIT 1;
$$;

REVOKE ALL ON TABLE public.document_preparation_cache FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_document_preparation_cache(text) TO authenticated;

-- pith_book_cache
ALTER TABLE public.pith_book_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pith_book_cache_select_authenticated"
  ON public.pith_book_cache;
DROP POLICY IF EXISTS "pith_book_cache_insert_authenticated"
  ON public.pith_book_cache;
DROP POLICY IF EXISTS "pith_book_cache_update_authenticated"
  ON public.pith_book_cache;

CREATE OR REPLACE FUNCTION public.get_pith_book_cache(p_cache_key text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t)
  FROM public.pith_book_cache t
  WHERE cache_key = p_cache_key
  LIMIT 1;
$$;

REVOKE ALL ON TABLE public.pith_book_cache FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pith_book_cache(text) TO authenticated;

-- geocode_cache: same pattern (writes already service-role only in geocode-proxy)
DROP POLICY IF EXISTS "geocode_cache_select_authenticated"
  ON public.geocode_cache;

CREATE OR REPLACE FUNCTION public.get_geocode_cache(p_place_name_normalized text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT to_jsonb(t)
  FROM public.geocode_cache t
  WHERE place_name_normalized = p_place_name_normalized
  LIMIT 1;
$$;

REVOKE ALL ON TABLE public.geocode_cache FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_geocode_cache(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.lookup_shared_pack_by_code(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.lookup_shared_pack_by_code(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_shared_pack_by_code(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_shared_pack_by_code(text) TO service_role;

-- Pack export: draft/publish snapshots for shareable study packs
-- Spec: specs/20260716-pack-export-backend

CREATE TABLE IF NOT EXISTS public.shared_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_doc_id text NOT NULL,
  title text NOT NULL DEFAULT '',
  status text NOT NULL CHECK (status IN ('draft', 'published')),
  include_source_document boolean,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS shared_packs_owner_idx
  ON public.shared_packs (owner_user_id);

CREATE INDEX IF NOT EXISTS shared_packs_status_idx
  ON public.shared_packs (status);

ALTER TABLE public.shared_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners manage own packs" ON public.shared_packs
  FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

-- Authenticated lookup by share code without granting table-wide SELECT on published packs.
CREATE OR REPLACE FUNCTION public.lookup_shared_pack_by_code(p_code text)
RETURNS SETOF public.shared_packs
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.shared_packs
  WHERE status = 'published'
    AND code IS NOT NULL
    AND code = NULLIF(trim(p_code), '')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_shared_pack_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_shared_pack_by_code(text) TO authenticated;

-- Published packs are immutable except `code` (assigned by import feature).
CREATE OR REPLACE FUNCTION public.shared_packs_enforce_published_immutability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' THEN
    IF NEW.snapshot IS DISTINCT FROM OLD.snapshot
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.include_source_document IS DISTINCT FROM OLD.include_source_document
      OR NEW.source_doc_id IS DISTINCT FROM OLD.source_doc_id
      OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.published_at IS DISTINCT FROM OLD.published_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'published shared_packs rows are immutable (only code may change)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shared_packs_published_immutability ON public.shared_packs;
CREATE TRIGGER shared_packs_published_immutability
  BEFORE UPDATE ON public.shared_packs
  FOR EACH ROW
  EXECUTE FUNCTION public.shared_packs_enforce_published_immutability();

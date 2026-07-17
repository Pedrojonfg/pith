-- Pack import: creator display name for import preview
-- Spec: specs/20260716-pack-import-flow

ALTER TABLE public.shared_packs
  ADD COLUMN IF NOT EXISTS owner_display_name text;

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
      OR NEW.owner_display_name IS DISTINCT FROM OLD.owner_display_name
    THEN
      RAISE EXCEPTION 'published shared_packs rows are immutable (only code may change)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;;

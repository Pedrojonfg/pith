-- Global tier-1 DPP artifact cache (content-keyed, cross-user)
-- @see specs/20260704-shared-dpp-cache

CREATE TABLE IF NOT EXISTS document_preparation_cache (
  cache_key         TEXT PRIMARY KEY,
  doc_id            TEXT NOT NULL,
  pipeline_version  TEXT NOT NULL,
  artifacts         JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_document_preparation_cache_doc_id
  ON document_preparation_cache (doc_id);

CREATE OR REPLACE FUNCTION update_document_preparation_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_preparation_cache_updated_at ON document_preparation_cache;
CREATE TRIGGER trg_document_preparation_cache_updated_at
  BEFORE UPDATE ON document_preparation_cache
  FOR EACH ROW EXECUTE FUNCTION update_document_preparation_cache_updated_at();

ALTER TABLE document_preparation_cache DISABLE ROW LEVEL SECURITY;

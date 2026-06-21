-- Vault embedding quality layer (20260629-vault-embedding)
-- Apply via Supabase SQL editor or CLI: supabase db push

CREATE EXTENSION IF NOT EXISTS vector;

-- concept_embeddings: shared embed cache
CREATE TABLE IF NOT EXISTS concept_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id text,
  scope_type text NOT NULL CHECK (scope_type IN ('concept', 'document')),
  project_id text,
  source_text text NOT NULL,
  source_text_hash text NOT NULL,
  embedding vector(768) NOT NULL,
  model_version text NOT NULL DEFAULT 'gemini-embedding-001',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_text_hash, model_version)
);

CREATE INDEX IF NOT EXISTS concept_embeddings_hnsw_idx
  ON concept_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS concept_embeddings_project_idx
  ON concept_embeddings (user_id, project_id);

ALTER TABLE concept_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY concept_embeddings_user_policy ON concept_embeddings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- dedup_gate_log
CREATE TABLE IF NOT EXISTS dedup_gate_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id_a text NOT NULL,
  concept_id_b text NOT NULL,
  gate_results jsonb NOT NULL DEFAULT '{}',
  outcome text NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dedup_gate_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY dedup_gate_log_user_policy ON dedup_gate_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- merge_rejections (G4)
CREATE TABLE IF NOT EXISTS merge_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id_a text NOT NULL,
  concept_id_b text NOT NULL,
  rejected_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, concept_id_a, concept_id_b)
);

ALTER TABLE merge_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY merge_rejections_user_policy ON merge_rejections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- vault_merge_log
CREATE TABLE IF NOT EXISTS vault_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_concept_id text NOT NULL,
  target_concept_id text NOT NULL,
  gate_results jsonb,
  approved_by text,
  reasoning text,
  applied_at timestamptz NOT NULL DEFAULT now(),
  reference_relink_count int NOT NULL DEFAULT 0,
  reference_relink_detail jsonb NOT NULL DEFAULT '[]'
);

ALTER TABLE vault_merge_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY vault_merge_log_user_policy ON vault_merge_log
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- document_similarity (symmetric pairs: doc_id_a < doc_id_b)
CREATE TABLE IF NOT EXISTS document_similarity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id_a text NOT NULL,
  doc_id_b text NOT NULL,
  score double precision NOT NULL,
  field_scores jsonb NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, doc_id_a, doc_id_b),
  CHECK (doc_id_a < doc_id_b)
);

ALTER TABLE document_similarity ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_similarity_user_policy ON document_similarity
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Nearest-neighbor search scoped to project ids
CREATE OR REPLACE FUNCTION find_nearest_concept_embeddings(
  query_embedding vector(768),
  match_count int DEFAULT 10,
  filter_project_ids text[] DEFAULT NULL,
  exclude_concept_id text DEFAULT NULL
)
RETURNS TABLE (
  concept_id text,
  project_id text,
  source_text text,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    ce.concept_id,
    ce.project_id,
    ce.source_text,
    1 - (ce.embedding <=> query_embedding) AS similarity
  FROM concept_embeddings ce
  WHERE ce.user_id = auth.uid()
    AND ce.scope_type = 'concept'
    AND (exclude_concept_id IS NULL OR ce.concept_id IS DISTINCT FROM exclude_concept_id)
    AND (
      filter_project_ids IS NULL
      OR array_length(filter_project_ids, 1) IS NULL
      OR ce.project_id = ANY(filter_project_ids)
    )
  ORDER BY ce.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
$$;

-- Relink concept_id on embeddings after merge
CREATE OR REPLACE FUNCTION relink_embedding_concept_id(
  p_source_id text,
  p_target_id text
)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  updated_count int;
BEGIN
  UPDATE concept_embeddings
  SET concept_id = p_target_id
  WHERE user_id = auth.uid()
    AND concept_id = p_source_id;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

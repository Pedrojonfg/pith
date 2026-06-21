-- Adaptive knowledge probing (20260630-adaptive-knowledge-probing)

CREATE TABLE IF NOT EXISTS probe_graph_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  doc_id text NOT NULL,
  from_concept_id text NOT NULL,
  to_concept_id text NOT NULL,
  edge_weight float NOT NULL DEFAULT 1.0,
  cycle_path jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS probe_graph_warnings_project_idx
  ON probe_graph_warnings (user_id, project_id, created_at DESC);

ALTER TABLE probe_graph_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY probe_graph_warnings_user_policy ON probe_graph_warnings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS vault_belief_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id text NOT NULL,
  concept_id text NOT NULL,
  belief float NOT NULL CHECK (belief >= 0 AND belief <= 1),
  source text NOT NULL DEFAULT 'prior',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, project_id, concept_id)
);

CREATE INDEX IF NOT EXISTS vault_belief_state_project_idx
  ON vault_belief_state (user_id, project_id);

ALTER TABLE vault_belief_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY vault_belief_state_user_policy ON vault_belief_state
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

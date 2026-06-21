CREATE TABLE document_sessions (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data  JSONB NOT NULL,
  markdown_ref  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE INDEX idx_document_sessions_user_id ON document_sessions(user_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_sessions_updated_at
  BEFORE UPDATE ON document_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE document_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own sessions" ON document_sessions
  FOR ALL USING (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('markdown_files', 'markdown_files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own markdown" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'markdown_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own markdown" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'markdown_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own markdown" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'markdown_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own markdown" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'markdown_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );;

-- Cross-device persistence: projects, vault, concept registry, user prefs + block storage buckets

CREATE TABLE public.user_projects (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version int NOT NULL DEFAULT 1,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_vault (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version int NOT NULL DEFAULT 3,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_concept_registry (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schema_version int NOT NULL DEFAULT 2,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_prefs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active_doc_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vault ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_concept_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own row only" ON public.user_projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own row only" ON public.user_vault
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own row only" ON public.user_concept_registry
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own row only" ON public.user_prefs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('blocks_files', 'blocks_files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('responses_files', 'responses_files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own blocks" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'blocks_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own blocks" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'blocks_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own blocks" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'blocks_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own blocks" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'blocks_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users upload own responses" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'responses_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own responses" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'responses_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users update own responses" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'responses_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own responses" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'responses_files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

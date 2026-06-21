INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('document-images', 'document-images', false, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "document_images_select_own" ON storage.objects;
DROP POLICY IF EXISTS "document_images_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "document_images_update_own" ON storage.objects;
DROP POLICY IF EXISTS "document_images_delete_own" ON storage.objects;

CREATE POLICY "document_images_select_own"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'document-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "document_images_insert_own"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'document-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "document_images_update_own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'document-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "document_images_delete_own"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'document-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE TABLE IF NOT EXISTS public.llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc_id TEXT,
  phase TEXT NOT NULL,
  model TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.llm_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "llm_usage_logs_insert_own" ON public.llm_usage_logs;
DROP POLICY IF EXISTS "llm_usage_logs_select_own" ON public.llm_usage_logs;

CREATE POLICY "llm_usage_logs_insert_own"
ON public.llm_usage_logs FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "llm_usage_logs_select_own"
ON public.llm_usage_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_llm_usage_logs_user_doc
ON public.llm_usage_logs (user_id, doc_id, created_at DESC);
;

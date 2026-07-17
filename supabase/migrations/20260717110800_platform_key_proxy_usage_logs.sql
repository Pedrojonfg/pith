-- Platform key proxy: extend llm_usage_logs for server-side proxy logging.
-- Additive only — preserves existing phase/doc_id/metadata columns.

ALTER TABLE public.llm_usage_logs
  ADD COLUMN IF NOT EXISTS service text,
  ADD COLUMN IF NOT EXISTS input_tokens integer,
  ADD COLUMN IF NOT EXISTS output_tokens integer,
  ADD COLUMN IF NOT EXISTS key_ownership text DEFAULT 'platform';

COMMENT ON COLUMN public.llm_usage_logs.service IS 'deepseek | gemini — set by llm-proxy Edge Function';
COMMENT ON COLUMN public.llm_usage_logs.key_ownership IS 'platform for proxy calls; may be absent on legacy client logs';

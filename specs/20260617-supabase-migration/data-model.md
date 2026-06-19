# Data Model: Supabase Migration

## Postgres: `document_sessions`

| Column | Type | Notes |
|--------|------|-------|
| id | TEXT | docId (PK part 1) |
| user_id | UUID | auth.users FK (PK part 2) |
| session_data | JSONB | DocumentSession minus rawMarkdown |
| markdown_ref | TEXT | Storage path or NULL |
| created_at | TIMESTAMPTZ | default NOW() |
| updated_at | TIMESTAMPTZ | trigger-maintained |

**RLS**: `auth.uid() = user_id` for ALL operations.

## Storage: `markdown_files`

Path: `{user_id}/{docId}.md`  
Bucket: private, authenticated policies on path prefix.

## localStorage (retained)

| Key | Purpose |
|-----|---------|
| `pith_active_doc_id` | Active document UI pointer |
| `pith_supabase_migrated` | One-time migration flag |
| `pith_doc_sessions` | Legacy backup (not deleted Phase 1) |
| `pith_projects` | Project store (unchanged) |

## DocumentSession in `session_data`

Full schema v3 per `session-types.js`, with `rawMarkdown` stripped and `rawMarkdownRef.storageKey` pointing to Storage path after save.

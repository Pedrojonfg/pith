# Data Model: Cross-Device Persistence Completion

## Postgres tables

| Table | PK | Columns |
|-------|-----|---------|
| `user_projects` | `user_id` | `schema_version`, `data` (JSONB), `updated_at` |
| `user_vault` | `user_id` | `schema_version` default 3, `data` (JSONB), `updated_at` |
| `user_concept_registry` | `user_id` | `schema_version` default 2, `data` (JSONB), `updated_at` |
| `user_prefs` | `user_id` | `active_doc_id` (TEXT), `updated_at` |

All tables: RLS `auth.uid() = user_id` for ALL operations.

## Storage buckets

| Bucket | Path | Content |
|--------|------|---------|
| `blocks_files` | `{userId}/{docId}.json` | Externalized RSVP/Questions blocks |
| `responses_files` | `{userId}/{docId}.json` | Externalized `_responses` |

Policies mirror `markdown_files` bucket (authenticated, own `{userId}/` prefix).

## Local cache keys (unchanged)

- `mylearning_projects`
- `pith_knowledge_vault`, `pith_knowledge_vault_data`
- `mylearning_concept_registry`
- `pith_doc_blocks_{docId}`, `pith_doc_responses_{docId}`
- `pith_active_doc_id`

# Contract: User Data Persist Supabase

## Module: `user-data-persist-supabase.js`

### Table operations

| Function | Args | Returns |
|----------|------|---------|
| `fetchUserProjects(userId)` | uuid | `{ data, schema_version } \| null` |
| `upsertUserProjects(userId, data, schemaVersion?)` | | void, throws on hard error |
| `fetchUserVault(userId)` | | same shape |
| `upsertUserVault(userId, data, schemaVersion?)` | | |
| `fetchUserConceptRegistry(userId)` | | |
| `upsertUserConceptRegistry(userId, data, schemaVersion?)` | | |
| `fetchUserPrefs(userId)` | | `{ active_doc_id } \| null` |
| `upsertUserPrefs(userId, activeDocId)` | | |

### Storage operations

| Function | Path |
|----------|------|
| `blocksStoragePath(userId, docId)` | `{userId}/{docId}.json` |
| `uploadBlocksJson(userId, docId, json)` | bucket `blocks_files` |
| `downloadBlocksJson(userId, docId)` | |
| `uploadResponsesJson(userId, docId, json)` | bucket `responses_files` |
| `downloadResponsesJson(userId, docId)` | |

## Module: `user-store-sync.js`

| Function | Behavior |
|----------|----------|
| `hydrateUserStoresFromSupabase()` | Remote→local for projects, vault, registry, active doc |
| `migrateUserStoresToSupabase()` | Idempotent local→remote when remote missing |
| `scheduleUserDataSync(fn)` | Serialized async queue, swallows errors |

## Write-through contract (all stores)

1. Write localStorage synchronously
2. Schedule Supabase upsert (skip if offline / not authenticated)
3. Never throw to caller on network failure

# Contract: Shared DPP Cache Store

**Module**: `src/js/shared-dpp-cache.js` + `src/js/shared-dpp-cache-persist.js`

## Exports

### `DPP_PIPELINE_VERSION`

String constant. Bump when tier-1 phases or artifact schema change.

### `buildSharedDppCacheKey(docId, pipelineVersion?)`

Returns `{docId}:{version}`.

### `extractShareableTier1Artifacts(session)`

Pure. Returns JSON-serializable bundle or `null` if `!isTier1PreparationComplete(session)`.

### `hydrateSessionFromSharedCache(session, artifacts)`

Pure. Merges cache bundle into `session.shared`; does not touch `session.modes` or user-only fields.

### `fetchSharedDppCache(docId)`

Async. Returns `artifacts | null`. Offline → `null`.

### `upsertSharedDppCache(docId, session)`

Async. No-op if `!isTier1PreparationComplete(session)` or offline. Else upsert row.

## Integration points

1. **`startDocumentPreparation`** (before pipeline): `fetchSharedDppCache` → if hit, hydrate + skip to user-specific phases or return if complete.
2. **`persistFinal`** (after success): `upsertSharedDppCache`.
3. **`document-preparation.js` `resolveFinalStatus`**: use `isTier1PreparationComplete(doc)` for ready/partial-final.

## User-specific phases after cache hit

Run phases T1.6, T1.8, T1.9 only when cache hit skipped main tier-1 LLM work.

## Errors

- Supabase fetch failure → treat as cache miss; log warn; continue DPP.
- Upsert failure → log warn; user session still saved; no user-visible error.

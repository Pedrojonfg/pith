# Research: Cross-Device Persistence Completion

## OQ1 — Store API surface

**Decision**: Persistence entry points are:
- Projects: `session-store.js` — `loadProjectStore`, `saveProjectStore`, `getProjectStore`, `persistProjectStore`
- Vault: `vault/vault-store.js` — `loadVault`, `saveVault` (+ all mutators call `saveVault`)
- Registry: `concept-registry/registry-store.js` — `loadRegistry`, `saveRegistry`
- Blocks: `block-store.js` — `stripBlocksForPersist`, `rehydrateBlocks`

No other modules read vault/registry/project keys directly except via these APIs (vault-graph-adapter uses `loadProjectStore` from session-store).

## OQ2 — Concept registry size

**Decision**: Single JSONB blob is acceptable; typical dev usage is well under 300KB. Monitor via `charCount` in persist logs; no split table for v1.

## OQ3 — Vault embeddings

**Decision**: Embeddings stored separately in `embedding-persist.js` / Postgres (`vault_embedding` migration). `pith_knowledge_vault_data` holds oversized entry arrays only. Full vault state synced as merged `loadVault()` output in `user_vault.data`.

## Sync pattern

**Decision**: Match session migration — sync localStorage write, async Supabase upsert, hydrate on boot from remote when authenticated. Use `isOfflineMode()` to skip network.

## Migration flag

**Decision**: Session migration stays gated by `pith_supabase_migrated`. Store migrations run idempotently every boot: push local→remote when local exists and remote row missing (handles users who migrated sessions before this feature).

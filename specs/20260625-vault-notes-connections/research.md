# Research: Vault Personal Notes, Connections & Resumable Upload

## Decision: Vault container schemaVersion 3

**Rationale**: Prior curation feature used schemaVersion 2 for reviewItems; new entry fields warrant bump without rewriting entries wholesale.

**Alternatives considered**: Per-entry schemaVersion only — rejected; vault-level version matches existing vault-store pattern.

## Decision: Lazy entry migration in vault-store (not separate vault-migration.js)

**Rationale**: `migrateEntryV2` and `migrateEntryCuration` already live in vault-store; adding `migrateEntryNotesConnections` keeps one load path.

**Alternatives considered**: Standalone `vault-migration.js` per spec-notes — deferred to keep diff minimal.

## Decision: Queue processes dedup at commit time, curation loads dedup async per concept

**Rationale**: UI needs related candidates before commit; queue re-runs dedup for authoritative merge target at write time (same as today’s commitVaultCuration).

**Alternatives considered**: Store merge decision in queue payload — rejected to avoid stale merge if vault changes between curation and processing.

## Decision: Settings in `pith_vault_settings` localStorage key

**Rationale**: No global settings module exists; small dedicated helper matches vault debug patterns.

**Alternatives considered**: Vault debug panel only — rejected; toggle belongs in upload/settings UX.

## Decision: Sequential queue with immediate saveVault per item

**Rationale**: Prevents duplicate commits and keeps neighbor backlink writes atomic per concept.

**Alternatives considered**: Parallel item processing — rejected due to localStorage write races.

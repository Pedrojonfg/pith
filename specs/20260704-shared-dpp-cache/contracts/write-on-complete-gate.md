# Contract: Write-on-Complete Gate

**Modules**: `document-preparation.js`, `session-types.js`

## Rules

1. `resolveFinalStatus(prep, doc, stopAfterTier)` MUST call `isTier1PreparationComplete(doc)` for tier-1 stop — not inventory length alone.
2. `resolveCreateSessionPrepStatus` MUST NOT say "Document ready" unless `isTier1PreparationComplete(doc)` OR explicit degraded policy documented in spec.
3. Shared cache upsert MUST NOT run unless FR-003 satisfied.
4. Checkpoint persists to user session MAY still occur mid-run; they MUST NOT set `preparation.status` to `ready`.

## Tier-1 complete predicate (unchanged)

`inventory.length > 0 && blockRecommendation.nBlocks > 0 && modeRecommendation object`

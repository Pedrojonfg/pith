# Data Model: Fix DPP Guard Status Race

**Feature**: `specs/20260709-fix-dpp-guard-race`

## Entities

### PreparationState (existing)

| Field | Role in this feature |
|-------|---------------------|
| `status` | `running`/`pending` vs terminal — source of race when lagging behind artifacts |
| `runId` | Stale-run detection on write; guard uses with in-flight registry |
| `updatedAt` | Staleness timeout input |

### Tier-1 gate artifacts (existing)

| Field | Required for gate complete |
|-------|---------------------------|
| `shared.conceptInventory` | Yes (non-empty, meets threshold) |
| `shared.blockRecommendation.nBlocks` | Yes |
| `shared.modeRecommendation` | No for tier-1 gate (T1.5 deferred) |

## State transitions (guard)

```
running + no gate artifacts + inFlight     → waiting
running + no gate artifacts + !inFlight    → waiting (until stale/timeout)
running + gate artifacts + !inFlight       → skip (repair to ready if needed)
ready/partial + gate artifacts             → skip (isTier1PreparationComplete)
```

## Constants

| Name | Value | Location |
|------|-------|----------|
| `DPP_GUARD_POLL_MAX_MS` | 90_000 | `session.js` |
| Poll interval | 2000ms | unchanged |

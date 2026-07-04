# Contract: DPP Concept Inventory Guard

**Feature**: `specs/20260709-fix-dpp-guard-race`  
**Module**: `src/js/session.js`

## `evaluateConceptInventoryGuard(session, options?)`

### Decision table (running/pending branch)

| Gate artifacts | In-flight pipeline | Stale prep | Decision |
|----------------|-------------------|------------|----------|
| yes | no | no | `skip` |
| yes | yes | * | `waiting` |
| no | no | yes | `run` or `failed` per existing rules |
| no | no | no | `waiting` |

**Gate artifacts** = `hasTier1GateArtifacts(session)` (inventory + block recommendation).

### Regression invariants

- Valid ready session → `skip`
- Failed prep → `failed`
- Running empty inventory → `waiting`
- Ready sparse inventory → `degraded`
- `forceRerun: true` → `run`

## `pollUntilConceptInventoryReady(reloadSession, options?)`

- Default `maxWaitMs`: `DPP_GUARD_POLL_MAX_MS` (90000)
- Each tick: `reloadSession()` → `repairStuckRunningPreparationIfNeeded` → guard evaluate
- Timeout returns `{ decision: 'waiting', session }` — caller must surface UX

## `repairStuckRunningPreparationIfNeeded(session)`

- Promote `running`/`pending` → `ready`/`partial` when `hasTier1GateArtifacts(session)` and not in flight
- Persist via `saveDocumentSession`

## `reloadSessionForGuard(docId)` (new)

- Returns fresh session from store after repair pass
- Used by gate entry and poll reload callback

# Contract: DPP Phase Scheduling (updated)

**Module**: `src/js/document-preparation.js`

## Tier 1 gate phases (blocking upload → mode select)

`T0.1`, `T0.2`, `T1.1`, `T1.2`, `T1.4`, `T1.5`

## Tier 1 deferred (background after gate)

`T1.3`, `T1.6`, `T1.7`, `T1.8`, `T1.9`

## Tier 2 (background after gate; T2.1 after T1.3)

| Phase | Depends on |
|-------|------------|
| T2.3 | T1.2, T1.4, T1.5 |
| T2.2 | T1.2, T1.5 |
| T2.1 | T1.3 |

## Wave invariant

No Tier-2 phase ID may appear in the same wave as `T1.2`.

## stopAfterTier

| Value | Phases executed |
|-------|-----------------|
| 1 | Gate Tier-1 only |
| 2 | Gate + deferred + Tier-2 |

# Contract: dedup-gates.js

## Module: `src/js/concept-registry/dedup-gates.js`

### Gate chain (ordered, short-circuit)

| Gate | Function | Default if data absent |
|------|----------|------------------------|
| G1 | `sameLanguageOrTranslatable` | pass |
| G2 | `noConflictingExternalId` | pass |
| G3 | `cosineAboveThreshold` | — |
| G4 | `noUserRejectionHistory` | pass |

### `evaluateDedupPair(conceptA, conceptB, context)`

Returns `{ passed, gateResults, outcome }` where outcome is `proposal` | `suggestion` | `rejected`.

### `generateDedupCandidates(concept, { projectIds, generationFloor })`

Uses `findNearestConcepts` then evaluates each pair.

### Logging

Every evaluation → `dedup_gate_log` insert (best-effort, non-blocking).

### User rejection

`recordMergeRejection(conceptIdA, conceptIdB)` → `merge_rejections` with canonical pair order.

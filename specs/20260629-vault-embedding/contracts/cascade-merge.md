# Contract: cascade-merge.js

## Module: `src/js/concept-registry/cascade-merge.js`

### Reference graph (must grep-verify before ship)

- `shared.smItems[].conceptId`
- `shared.assessmentSignals[].conceptId` / `canonicalId` / `globalConceptId`
- `shared.conceptGraph.edges[].source` / `.target`
- `modes.cloze.items[].conceptIds[]`
- `shared.mnemonicDevices[].conceptIds[]`
- vault entry `related` fields
- registry facet schedules (`global-review.js`)
- `shared.conceptInventory[].globalConceptId`

### `dryRunCascadeMerge(sourceId, targetId)`

Returns `{ relinkDetail: string[], relinkCount: number }` without writes.

### `mergeConceptProposal(sourceId, targetId, { approvedBy, reasoning, gateResults })`

1. Snapshot registry + all sessions
2. Relink all references
3. Merge metadata (notes union, maturity max)
4. Soft-delete source (`merged_into`)
5. Log to `vault_merge_log`
6. On error: restore snapshot

Idempotent if source already `merged_into === targetId`.

### Maturity merge rule

`max(gray, yellow, green)` — never downgrade.

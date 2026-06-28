# Contract: Threshold Tagging

## `scoreThresholdHeuristic(concept, inventory) → number`

Returns 0–1 score. Higher = more likely threshold.

## `selectThresholdIds(inventory, fraction) → string[]`

Returns concept ids for top `max(0, inventory.length < 5 ? 0 : max(1, ceil(n * fraction)))` by score.

## `applyThresholdFlags(inventory, thresholdIds, source) → inventory[]`

Sets `isThreshold`, `thresholdScore`, `thresholdSource` on entries.

## `classifyThresholdConceptsLLM({ candidates, inventory, lang, llmModel })`

- **Input**: ≤ 20 candidate objects `{ id, label, score, dependentCount }`
- **Output**: JSON `{ confirmed: string[], rejected: string[] }`
- **max_tokens**: 2048 (≤20 ids × ~50 tok)
- **Failure**: return `{ confirmed: heuristicTopIds, rejected: [] }`

## DPP hook

After factual classification in `runPhaseT12`, if `THRESHOLD_CONCEPTS_ENABLED`:

1. Run heuristic selection
2. Optional LLM confirm on borderline band
3. Write `doc.shared.conceptInventory`

## Block helpers

- `blockIsThreshold(blockIndexEntry, inventory) → boolean`
- `sortBlockIndexForThresholds(blockIndex, inventory) → blockIndex` (stable topo: threshold blocks before dependents when acyclic)
- `mergeThresholdBlockConfig(cfg, isThreshold) → cfg`

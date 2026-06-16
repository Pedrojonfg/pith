# Contract: Concept Inventory API (Phase 1)

Supersedes Phase 1 sections of `specs/20260526-block-split-dedup/contracts/two-phase-split-api.md`.

## Token budgets

| Call | Constant | Value |
|------|----------|-------|
| Single-pass inventory | `CONCEPT_INVENTORY_MAX_TOKENS` | 12288 |
| Per-chunk inventory | `CONCEPT_INVENTORY_CHUNK_MAX_TOKENS` | 6144 |
| Merge inventories | `CONCEPT_INVENTORY_MERGE_MAX_TOKENS` | 8192 |

All inventory LLM calls MUST pass explicit `max_tokens`. Omitting is a contract violation.

## Retry cascade (each inventory LLM call)

1. Full prompt + `json_object` mode
2. Compact prompt + `json_object` mode
3. Compact prompt, no `json_object`
4. Terse prompt (id, order, title, scope_one_line only)

## Error taxonomy

| Code | Detection | User message |
|------|-----------|--------------|
| `CONCEPT_INVENTORY_TRUNCATED` | `looksLikeTruncatedModelJson(raw)` | Document too long banner (§6.1) |
| Parse error | JSON.parse fails, not truncated | Existing generic message |
| Schema error | Parsed but validation fails | Existing generic message |

## Map-reduce activation

- `wordCount > 8000` AND `docHierarchy.tree.length > 0`
- `buildInventoryChunks` returns `null` if <2 chunks → single-pass
- Chunks dispatched with `Promise.allSettled`; failed chunks listed in `failedChunks`
- Merge: `deepSeekMergeConceptInventories`

## Fallback parity (required entry points)

All MUST call `runConceptInventoryWithFallback`:

- Generate blocks (pre-packing ON)
- Recommend blocks
- `runIngestOnlyPipeline`
- `runConceptInventoryForDoc` (recall/hub)
- `twoPhaseConceptSplit` (inventory leg)

Fallback: `deepSeekSplitIntoBlocks` → `pipeline: 'fallback_mono'`

## Pre-packing assessment gate

When result `kind === 'fallback_mono'`, skip pre-packing assessment entirely.

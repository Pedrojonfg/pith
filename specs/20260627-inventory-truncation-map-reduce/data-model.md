# Data Model: Concept Inventory Truncation Fix + Map-Reduce

## ConceptInventoryItem (unchanged)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| id | string | yes | c1, c2, … |
| order | number | yes | 1-based |
| title | string | yes | |
| scope_one_line | string | yes | |
| source_phrase | string | no | omitted in terse mode |
| anchor_type | cited \| inferred | no | omitted in terse |
| module | string | no | set from chunk label in map-reduce |
| prerequisite_ids | string[] | no | cross-chunk resolved at merge |
| concept_type | string | no | omitted in terse |

## InventoryChunk

| Field | Type | Notes |
|-------|------|-------|
| label | string | Section title for LLM context |
| text | string | Markdown slice |
| wordCount | number | For proportional concept target |

## InventoryRunResult

| Field | Type | Notes |
|-------|------|-------|
| kind | inventory \| fallback_mono | Discriminant |
| inventory | ConceptInventoryItem[] | When kind=inventory |
| inventoryMode | full \| terse \| map_reduce \| map_reduce_terse \| fallback_mono | Provenance |
| chunkCount | number | map_reduce only |
| failedChunks | string[] | chunk labels that failed |
| blockIndex | object[] | When kind=fallback_mono |
| splitRunMeta | object | When kind=fallback_mono |
| concept_count | number | |
| estimatedConceptTarget | number | |
| wordCount | number | |

## Session persistence

- `shared.conceptInventory` — items array (unchanged)
- `modes.rsvp._meta.inventoryMode` — string enum
- `modes.rsvp._meta.inventoryChunkCount` — optional number
- `modes.rsvp._meta.inventoryFailedChunks` — optional string[]

## Validation rules

- `buildInventoryChunks` returns `null` when <2 chunks (caller uses single-pass)
- Terse inventory: `inventoryMode` includes `terse` or `map_reduce_terse`
- Pre-packing assessment skipped when `kind === 'fallback_mono'`

## State transitions

```text
upload → hierarchy ready → runConceptInventoryWithFallback
  → wordCount ≤ 8000 OR no hierarchy → single-pass (4 attempts)
  → wordCount > 8000 AND hierarchy → map-reduce (chunks → merge)
  → all fail → fallback_mono (deepSeekSplitIntoBlocks)
```

# Data Model — Embedding-Assisted Inventory Merge

## Runtime telemetry (per DPP run)

| Field | Type | Description |
|-------|------|-------------|
| `autoMerged` | number | Pairs merged at ≥ AUTO threshold |
| `llmArbitrated` | number | Review-band pairs sent to LLM |
| `rejectedDistinct` | number | Pairs below REVIEW threshold |
| `finalConceptCount` | number | Post-merge inventory size |
| `shadowDecisions` | object[] | `{ idA, idB, similarity, decision }` when mode=shadow |
| `auditAutoMerges` | object[] | `{ idA, idB, similarity }` for auto merges |

## Inventory entry extension (non-persisted)

| Field | Type | Description |
|-------|------|-------------|
| `_embedding` | number[] | Cached gemini vector from T1.2 merge step |

## Flags (`INVENTORY_MERGE_EMBED_FLAGS`)

| Flag | Default | Description |
|------|---------|-------------|
| `EMBEDDING_ASSISTED_INVENTORY_MERGE_ENABLED` | false | Master gate |
| `INVENTORY_MERGE_EMBED_MODE` | `shadow` | `shadow` \| `auto` \| `full` |

## Thresholds (`inventory-merge-thresholds.js`)

| Constant | Value | Role |
|----------|-------|------|
| `MERGE_AUTO_THRESHOLD` | 0.91 | Auto-merge without LLM |
| `MERGE_REVIEW_THRESHOLD` | 0.78 | LLM review band floor |
| `INVENTORY_MERGE_PAIR_FLOOR` | 0.72 | Min similarity to consider pair |

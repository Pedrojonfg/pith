# Data Model: Block Split Deduplication

**Feature**: `20260526-block-split-dedup`

## Entities

### ConceptInventoryItem (LLM phase 1, ephemeral)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `string` | yes | Stable id within inventory (`c1`, `c2`, …) |
| `order` | `number` | yes | Learning order (1-based) |
| `title` | `string` | yes | Short teachable concept name |
| `scope_one_line` | `string` | yes | What this concept covers in one line |
| `module` | `string` | no | Thematic module label |
| `prerequisite_ids` | `string[]` | no | References to other `id`s |

**Validation**: Unique `id`; `order` strictly increasing after sort.

### ConceptPackPlan (LLM phase 2 partial, ephemeral)

| Field | Type | Description |
|-------|------|-------------|
| `target_n` | `number` | User-requested N |
| `merges` | `object[]` | `{ concept_ids: string[], block_title: string }` when concepts > N |
| `final_block_count` | `number` | Blocks after pack (may be < N) |

### BlockIndexEntry (persisted through confirm → session)

Existing shape; invariants extended:

| Field | Type | Notes |
|-------|------|-------|
| `id` | `number` | Sequential 1..M after renumber |
| `title` | `string` | Block 1 MUST match overview pattern |
| `summary` | `string` | |
| `signature` | `string[]` | 3–10 terms; unique per concept block |
| `chunk` | `string` | Filled locally post-split |

**Block 1 invariant**: `title` matches `/^(overview|mapa del curso|course map)/i` OR summary contains module roadmap language (validated in quickstart).

### DedupMergeRecord (runtime)

| Field | Type | Description |
|-------|------|-------------|
| `keep_id` | `number` | Surviving block id |
| `absorb_ids` | `number[]` | Removed ids |
| `reason` | `"signature_overlap" \| "title_duplicate"` | |
| `overlap_terms` | `string[]` | Intersection for UI/debug |

### SplitRunMeta (optional on `state` during generate)

| Field | Type | Description |
|-------|------|-------------|
| `requested_n` | `number` | User input |
| `final_n` | `number` | After pack + dedup |
| `pipeline` | `"two_phase" \| "fallback_mono"` | |
| `concept_count` | `number` | Raw inventory size |
| `dedup_merges` | `DedupMergeRecord[]` | |

## State transitions

```text
[generateBlocks submit]
  → phase1: inventario conceptos
  → phase2: empaquetar → blockIndex (chunks "")
  → assignChunksLocally(material, finalCount)
  → deterministicDedup → renumber
  → UI blocks screen + SplitRunMeta

[fallback]
  → deepSeekSplitIntoBlocks → normalize → chunks → (skip dedup or light dedup only)
```

## Deterministic dedup rules

1. Normalize term: `trim().toLowerCase()`; drop empty.
2. Signature overlap: `|A ∩ B| >= 3` → merge B into A (lower id keeps).
3. Title duplicate: `normalizeTitle(a) === normalizeTitle(b)` → merge (strip punctuation, lowercase).
4. A block id appears in at most one absorb set.
5. No merge on thematic similarity alone.

## Storage

No new localStorage keys. `state.lastBlockIndex`, `state.lastNBlocks`, existing split summary DOM.

## Flutter portability note

Pure functions target: `parseConceptInventory`, `packConceptsToBlockIndex` validation, `findDeterministicDuplicateMerges`, `renumberBlockIndexSequential` — keep in `session.js` without DOM.

# Inventory Merge Embedding — Contract

## `runEmbeddingAssistedInventoryMerge(partials, options)`

**Input**
- `partials`: `{ label, concepts[] }[]` — same shape as `deepSeekMergeConceptInventories`
- `options.mode`: `shadow` | `auto` | `full`
- `options.llmModel`, `options.language` — for review-band arbitration

**Output**
```js
{
  status: 'skipped' | 'success',
  reason?: string,
  concepts?: object[],      // merged inventory (when not shadow)
  telemetry: { autoMerged, llmArbitrated, rejectedDistinct, finalConceptCount, auditAutoMerges, shadowDecisions },
  inventoryMode?: string,   // e.g. embed_auto, embed_full, embed_shadow
}
```

**Behavior**
- Skip when `partials.length < 2` or embeddings disabled
- Shadow: compute triage, populate telemetry, return `status: skipped`
- Auto: apply auto merges only; return reduced concepts for downstream LLM if needed
- Full: apply auto + arbitrated merges; may return complete merge

## `triagePairSimilarity(similarity, thresholds?)`

Returns `'auto' | 'review' | 'distinct'`.

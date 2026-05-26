# Contract: Deterministic Block Dedup

**Module**: `src/js/session.js`

## `normalizeSignatureTerms(signature)`

**Input**: `string[] | string`  
**Output**: `Set<string>` of normalized terms (lowercase, trimmed, non-empty).

## `signatureOverlapCount(sigA, sigB)`

Returns `|intersection|`.

## `normalizeBlockTitle(title)`

Lowercase, collapse whitespace, strip leading `key terms:` prefix for comparison only (overview titles NOT stripped).

## `findDeterministicDuplicateMerges(blockIndex)`

**Input**: `BlockIndexEntry[]` sorted by id.

**Output**: `DedupMergeRecord[]` (merge plans, not yet applied).

**Algorithm**:

```
for each pair (i, j) where i < j:
  if normalizeTitle(title_i) === normalizeTitle(title_j):
    emit merge(keep=i, absorb=j, reason=title_duplicate)
  else if signatureOverlapCount(sig_i, sig_j) >= 3:
    emit merge(keep=i, absorb=j, reason=signature_overlap, overlap_terms)
skip if either id already scheduled for absorb
```

**Exclusions**:

- Do not compare block 1 (overview) with Key terms blocks unless title_duplicate exact match.
- Do not merge if `keep` already absorbing another in same pass (enforce uniqueness).

## `applyDeterministicDedup(blockIndex, { llmModel })`

1. `plans = findDeterministicDuplicateMerges(blockIndex)`
2. For each plan: `mergeChunks({ keepBlock, absorbBlocks, ... })` (existing LLM merge for chunk text)
3. Remove absorbed blocks; `renumberBlockIndexSequential`
4. Return `{ blockIndex, dedup_merges, merged_count }`

**Performance**: O(n²) on block count; n ≤ ~30 typical — acceptable.

## UI contract

`renderSplitMergeSummary` MUST show:

- `Pediste {requested_n}; el material sustentó {final_n} bloques.` when `final_n < requested_n`
- `Dedup: {merged_count} bloques fusionados por firmas duplicadas` when `merged_count > 0`

## Tests (cursor-tests)

Synthetic index:

```js
[
  { id: 1, title: "Overview: Test", signature: ["a","b","c"], chunk: "..." },
  { id: 2, title: "Topic A", signature: ["flux", "divergence", "curl", "field"], chunk: "..." },
  { id: 3, title: "Topic B", signature: ["flux", "divergence", "curl", "theorem"], chunk: "..." }
]
```

Expect merge 3 → 2 (overlap ≥ 3). Pair with signatures overlap 2 only → no merge.

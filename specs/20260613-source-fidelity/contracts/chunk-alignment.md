# Contract: Aligned Chunk Assignment

**Module**: `src/js/chunk-alignment.js` (NEW), wired from `src/js/session.js` → `packInventoryToBlocks`

## API

```javascript
/**
 * @param {string} materialText - full cleaned material
 * @param {import('../session.js').BlockIndexEntry[]} blockIndex
 * @param {import('../session.js').ConceptInventoryItem[]} inventory
 * @param {{ docHierarchy?: object }} opts
 * @returns {import('../session.js').BlockIndexEntry[]}
 */
export function assignAlignedChunks(materialText, blockIndex, inventory, opts = {});
```

## Algorithm (deterministic)

1. Normalize material to word array with char offsets (reuse word-split pattern from `splitMaterialIntoBlockChunks`).
2. Per block `b`:
   - Collect search terms: tokenize `b.title`, `b.signature`, titles/`source_phrase` of concepts whose `id` ∈ `b.concept_ids`.
   - Score each candidate window of size `targetWords ≈ ceil(totalWords / blockCount)` sliding by `step = max(50, targetWords/4)`.
   - Score = count of distinct terms found (case/accent insensitive) + bonus if window contains full `source_phrase` substring.
3. Pick highest-scoring window; expand/shrink to `targetWords` centered on match.
4. If `docHierarchy.tree` present: snap window edges to nearest section boundaries within ±15% of target length when possible.
5. Set `anchor_quality`:
   - `strong`: ≥2 term hits OR `source_phrase` match
   - `weak`: 1 term hit only
   - `proportional_fallback`: 0 hits → use `splitMaterialIntoBlockChunks` slice for index `b.id-1` and set quality explicitly

## Overview block (id === 1)

Title matches `/^(overview|mapa del curso|course map)/i` → chunk = introduction slice (first `targetWords` words) OR union of section titles from hierarchy summary.

## Integration

Replace in `packInventoryToBlocks`:

```javascript
// BEFORE
const chunks = splitMaterialIntoBlockChunks(materialText, finalCount);
blockIndex = normalized.map((b, i) => ({ ...b, chunk: chunks[i] || "" }));

// AFTER
blockIndex = assignAlignedChunks(materialText, normalized, inventory, { docHierarchy });
```

Same for `twoPhaseConceptSplit` fallback paths that currently call `splitMaterialIntoBlockChunks` directly.

## Tests

- Fixture: material capítulos 1-3 reordered blocks → block titled "Capítulo 3 concept" chunk contains "Capítulo 3" heading text
- Zero-match block → `anchor_quality === "proportional_fallback"`
- `chunk_match_terms` populated on strong/weak

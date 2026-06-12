# Contract: Chunk Alignment Levers (L1, L8, L9, L10, L11)

**Feature**: `20260617-pipeline-levers` | **Levers**: L1, L8, L9, L10, L11

## L1 — Hierarchy delimiters

Extend normalization to detect section markers in plain text:
- `❖` → level 1 section
- `➔`, `➢` → level 2 subsection
- Existing `<h1>`–`<h6>` unchanged

Output: `docHierarchy` with `{ title, level, startOffset, endOffset }[]`

**Module**: `src/js/normalization/` or `src/js/hierarchy.js`

## L9 — Mandatory section snap

When `docHierarchy.length > 0`:
- `assignAlignedChunksSequential` MUST snap chunk boundaries to section edges
- Development block crossing > 2 sections → force re-split at most relevant section
- Key terms chunk MUST start at first section of module

**Module**: `src/js/chunk-alignment.js`

## L8 — Term overlap penalty

```javascript
const OVERLAP_PENALTY_TERM_THRESHOLD = 0.4;
// If candidate chunk contains ≥40% of source_phrases already assigned → score *= 0.3
```

## L10 — Minimum chunk words

```javascript
const MIN_CHUNK_WORDS = pipelineLevers.minChunkWords ?? 400;
// If assigned chunk < MIN → expand to next section boundary
// Still < MIN → flag for pack merge (L7, optional)
```

## L11 — Dedup signature threshold

```javascript
const SIGNATURE_OVERLAP_THRESHOLD =
  session._meta.pipelineLevers?.dedupSignatureOverlapThreshold
  ?? (strictMode ? 2 : 3);
```

Secondary merge rule: `sharedConceptIds >= 1 && sharedSignatureTerms >= 2` → merge candidate.

**Module**: `src/js/session.js` — `findDeterministicDuplicateMerges`

## Tests

- Plain text with ❖ markers → docHierarchy sections ≥ 1
- Snap enabled → chunk startOffset aligns with section start
- Dedup with 2 shared terms in strict → merge plan generated

# Contract: Export Concept Dictionary & Block Sections

**Feature**: `20260527-zero-latency-blocks`  
**Covers**: FR-011, FR-011a, SC-005, SC-006

## `collectExportConcepts(session)`

Returns sorted `Concept[]` for markdown table.

### Sources (union, FR-011)

1. `localStorage.session_concepts` (legacy / commit-on-finish path)
2. `localStorage.session_concepts_by_block` — all values flattened
3. `session.blocks[i].concepts` for each index `i`

### Dedup rules

| Rule | Detail |
|------|--------|
| Key | `term.trim().toLowerCase()` |
| Winner | Prefer non-empty `definition`; if tie, longer `definition` wins |
| Output | Sorted `localeCompare` on `term` |

## Block sections in `buildMarkdown` (FR-011a)

For each `bi` in `0 .. nBlocksExport-1`:

```text
include "## Block {bi+1}" section iff:
  hasGeneratedBlockContent(blocks[bi])
```

`hasGeneratedBlockContent` matches `session.js` / prefetch contract (explanation non-empty OR questions.length > 0).

- Ungenerated blocks: omitted from body (plan section may still list them — existing Session Plan behavior).
- Prefetched-but-unstudied blocks: **included** when write-through populated `explanation` / `questions`.

## Mid-session export

Manual **Save session** and `beforeunload` use the same `buildMarkdown` — no separate code path.

## Acceptance probes

| ID | Probe |
|----|-------|
| SC-005 | After block-2 prefetch ready during block 1, `collectExportConcepts` length increases |
| SC-006 | `buildMarkdown` contains `## Block 2:` with non-empty explanation before user opens block 2 |

# Contract: source-provenance

**Module**: `src/js/source-provenance.js`

## Exports

| Function | Purpose |
|----------|---------|
| `MAX_SOURCE_FILES` | 5 |
| `assignSourceFileIds(fileCount)` | Build `SourceFileMeta[]` from File list |
| `buildSourceFileBreak(fileId)` | Sentinel string between files |
| `parseSourceFileRegions(markdown)` | `{ fileId, start, end }[]` |
| `resolveSourceFileIdForExcerpt(markdown, excerpt)` | Match excerpt to region |
| `annotateBlocksWithSourceFileIds(blocks, materialText)` | Set `sourceFileIds` on blocks with `chunk` |
| `getSourceFileBoundaryCharPositions(markdown)` | Char offsets for packing snap |
| `sliceMarkdownForSourceFile(markdown, fileId)` | Text slice for Slow scope |

## Invariants

- Sentinels never appear in RSVP display text (stripped at render if needed).
- Packing must not assign chunk char ranges crossing boundary positions.

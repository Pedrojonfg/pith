# Research — Multi-File Upload

## Q1: Block packing chunk boundaries

**Decision**: Treat `<!-- source: {fileId} -->` sentinels as hard boundaries in `assignAlignedChunksSequential` via a new `getSourceFileBoundaries(materialText)` helper in `source-provenance.js`, merged with `getSectionBoundaries` when snapping char ranges.

**Rationale**: Packing flows through `packInventoryToBlocks` → `assignAlignedChunksSequential` in `chunk-alignment.js`. Sentinels survive `emitMarkdown` as HTML comments.

**Alternatives considered**: Post-hoc block splitting after pack (rejected — may violate concept alignment).

## Q2: Normalization chunk shape

**Decision**: Pipeline returns flat markdown only. Use sentinel markers + char-offset `SourceMap` stored on `uploadMeta.sourceMap` (chunk index optional; primary lookup by offset).

**Rationale**: `normalizeStudyMaterial` returns `normalizedContent` string; no structured chunk array exposed.

## Q3: Create session wiring

**Decision**: Handlers in `study.js`: `handleCreateSessionStartFilePicked` becomes staging-only; `handleCreateSessionStartContinue` runs `normalizeMultipleFiles` + DPP.

**Rationale**: Confirmed grep — no dedicated create-session module.

## Q4: Slow scope section extraction

**Decision**: Filter `slow.normalizedTextFull` to selected file's slice (between sentinels) before `buildScopeOptions`. Store `slow.selectedSourceFileId` on session slice.

**Rationale**: `renderSlowScopeScreen` calls `buildScopeOptions(slow.normalizedTextFull, ...)`. Sentinel comments are stripped from display text in reader but remain in `normalizedTextFull` for offset math.

# Research: Read Mode

## Block section provenance for images

**Decision**: Use `block.chunk` from `assignAlignedChunksSequential` and `findPithImageTokenIds(chunk)` — no new provenance threading.

**Rationale**: Images are anchored in `rawMarkdown` via `![pith-image:ID]`; aligned chunk retains tokens overlapping the block's word range.

## Prefetch trigger

**Decision**: Hook visual resolution in `setOnPrefetchReady` (after `applyPrefetchReadySideEffects`) and on `beginReadForCurrentBlock` for the active block.

**Rationale**: Matches existing `triggerPrefetch(N+1)` on block enter; covers first-block edge case.

## Text renderer reuse

**Decision**: Reuse `markdownToHtml` + paced-reader typography defaults in `read-mode.js` (not Slow reader annotations/pagination).

**Rationale**: Read mode needs single-scroll explanation text, not paginated slow reader.

## Image zero-candidate fallback

**Decision**: Fall back to diagram generation when `visualNeed.type === "image"` but no token match.

**Rationale**: Simpler than silent drop; spec allows either — diagram fallback preserves value.

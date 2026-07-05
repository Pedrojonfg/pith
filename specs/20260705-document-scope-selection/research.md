# Research: Universal Document Scope Selection

## Q1: Non-contiguous multi-select in screenSlowScope?

**Decision**: Not supported today — single-select only (`selectSlowScope` replaces selection).

**Rationale**: `slow.readingScope` stores one `{ charStart, charEnd }` range.

**Action**: Build multi-select on new `screenScopeSelection` with `ScopeSelection.sectionIds[]`.

## Q2: Node-to-markdown span mapping?

**Decision**: Reuse `HierarchyNode.startOffset` / `endOffset` via new `buildScopedMarkdown()`.

**Rationale**: `finishChunk`, `buildInventoryChunks`, and `scopeOptionFromHierarchyNode` already slice by offset.

## Q3: rawMarkdownRef size threshold?

**Decision**: Mirror current persist behavior — always externalize inline markdown on save; no separate threshold for `scopedMarkdown`.

**Rationale**: `DOC_SESSION_SIZE_THRESHOLD` exists but is unused; scoped text is typically smaller than full doc.

## Q4: Slow-specific options on screenSlowScope?

**Decision**: Relocate fillable map, checkpoints, file select, section edit to `screenSlowPhase0`.

**Rationale**: Those are Slow reading options, not universal scope.

## Q5: UI-gated DPP phase pattern?

**Decision**: Model on `maybeEnterSharedAssessmentGate` in `study.js`, not in `PHASE_RUNNERS`.

**Rationale**: All DPP runners are non-interactive. Run `ensureScopeStructurePreparation` (T0.1–T1.1), show gate screen, then `ensureTier1Preparation`.

# Feature Specification: Slow Mode Native Viewer & Annotation Redesign

**Feature Branch**: `20260808-slow-mode-native-viewer`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: `20260808-slow-mode-native-viewer-spec.md` (repo-root draft)

**Supersedes (partial):**
- `specs/20260528-slow-mode/` — Wave 1 viewport-measured pagination for Slow Mode only. Annotation type registry, hotkeys, tier system remain governed by that spec.
- `specs/20260533-slow-reader-desktop/` — pagination/offset sections of `data-model.md`. Full-bleed layout contract remains in force.

**Explicitly NOT touched:** scope-gated generation, document hierarchy building, paced-reader consumption of `pagination.js`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PDF fidelity reading (Priority: P1)

A learner opens a Slow Mode session from a PDF upload and reads the original page layout (columns, tables, images, captions, orientation) without clipping or reflow artifacts.

**Why this priority**: Fixes confirmed FM-01/FM-02; primary motivation for the feature.

**Independent Test**: Create a Slow session from a PDF with a tall embedded image and multi-column layout; verify pages render without bottom clipping and layout matches the source PDF.

**Acceptance Scenarios**:

1. **Given** a PDF-sourced Slow session, **When** the reader opens, **Then** pages render as native PDF pages (not reflowed markdown pages).
2. **Given** a PDF page with a tall figure, **When** the user views that page, **Then** the full figure is visible without vertical clipping.
3. **Given** a PDF with multi-column or merged-table layout, **When** the user views those pages, **Then** original layout is visible as authored.

---

### User Story 2 - Scroll reading for non-PDF sources (Priority: P1)

A learner opens a Slow Mode session from HTML/TXT/MD and reads continuous scroll content with images rendered correctly and no artificial page slicing.

**Why this priority**: Non-PDF is the other half of the dual-viewer architecture; ships first in implementation sequence as lower risk.

**Independent Test**: Create a Slow session from markdown with images; verify continuous scroll, no fixed-height page wraps, images display at real size.

**Acceptance Scenarios**:

1. **Given** a non-PDF Slow session, **When** the reader opens, **Then** content is continuous scroll (not viewport-paginated).
2. **Given** markdown with image tokens, **When** rendered, **Then** images appear with correct dimensions (no "Image unavailable" measurement placeholder affecting layout).
3. **Given** the user scrolls and resumes later, **When** the session reopens, **Then** reading position restores near the prior block/offset.

---

### User Story 3 - Stable, repairable annotations (Priority: P1)

A learner selects text, creates any of the 14 annotation types (plus IA query), and highlights remain correct after resume; if text drifts, the system repairs via stored snippet or marks orphaned.

**Why this priority**: Fixes FM-03; annotations are core Slow Mode value.

**Independent Test**: Create annotations in scroll and PDF modes; reload; verify highlight positions. Force block removal in scroll fixtures and verify repair/orphan behavior.

**Acceptance Scenarios**:

1. **Given** a text selection, **When** the user picks an annotation type, **Then** an annotation is stored with unit-local anchor + non-empty snippet.
2. **Given** saved annotations, **When** the session reloads, **Then** highlights render at the same PDF rects or scroll blocks.
3. **Given** a scroll annotation whose block was removed, **When** the reader re-renders, **Then** snippet search re-anchors nearby or marks `orphaned` with distinct sidebar UX.
4. **Given** all annotation types and tiers, **When** critical mode / secondary visibility toggles, **Then** visibility rules match pre-feature behavior.

---

### User Story 4 - Checkpoints at natural boundaries (Priority: P2)

A learner progresses through sections and sees checkpoint prompts when leaving a section (PDF: last overlapping page; scroll: heading exits viewport), not mid-unit.

**Why this priority**: Preserves pedagogy without depending on old page-fit pagination.

**Independent Test**: Fixture docs with known section boundaries; advance past section end; assert checkpoint chip timing/trigger.

**Acceptance Scenarios**:

1. **Given** PDF viewerMode, **When** the user advances past the last page of a section, **Then** a checkpoint may show for that undismissed section.
2. **Given** scroll viewerMode, **When** a section heading scrolls out the top of the viewport, **Then** a checkpoint may show for that undismissed section.
3. **Given** a dismissed section, **When** the user re-crosses it, **Then** no checkpoint reappears for that section id.

---

### User Story 5 - Phase 3 / graph / Ask-AI still work (Priority: P2)

After reading and annotating, Module A coverage, Module B retrieval shells, graph enrichment links, steel-man nudges, and Ask-AI context still behave correctly under the new proximity model.

**Why this priority**: Regression guard for downstream Slow features.

**Independent Test**: Existing Phase 3 / graph behavioral tests updated for new anchors; fixtures assert hits/misses without char-global math.

**Acceptance Scenarios**:

1. **Given** Phase 0 argument map + annotations, **When** Module A runs, **Then** coverage uses viewer-mode proximity (page/block), not global char radius.
2. **Given** critical annotations, **When** Module B builds questions, **Then** context slices come from page/block neighbors.
3. **Given** graph-linkable annotations, **When** enriched graph builds, **Then** it reads `session.slow.annotations` (no shared dual-write).
4. **Given** flashcard conversion, **When** SM-2 ingest runs, **Then** behavior is unchanged (type + userText only).

---

### User Story 6 - Migration of legacy annotations (Priority: P2)

On first load after deploy, existing scroll-session annotations migrate to the new shape; PDF-session legacy annotations are dropped with a one-time notice.

**Why this priority**: Prevents silent data corruption; D-MIG(a) locked.

**Independent Test**: Fixture old-shape sessions → migrate once → assert new shape, snippets, orphaned flags, PDF drop + notice flag.

**Acceptance Scenarios**:

1. **Given** a scroll session with old `charStart`/`charEnd` annotations, **When** first loaded post-feature, **Then** annotations become `block-offset` with snippet backfill.
2. **Given** a PDF session with old annotations, **When** first loaded, **Then** those annotations are dropped and a one-time non-blocking notice is shown.
3. **Given** a session already migrated (`annotationSchemaVersion`), **When** loaded again, **Then** migration does not re-run.

---

### Edge Cases

- Annotation spanning a block boundary during migration → mark `orphaned`, do not guess.
- Missing `blockId` at render → repair via snippet (±3 blocks, expand) or orphan.
- Legacy `normalizedFormat: "html_min"` → scroll viewerMode with plain-text rendering (no crash).
- `shared.annotations` shadow copy → deleted, not migrated.
- RSVP paced-reader still uses `pagination.js` unchanged.
- Fillable-map blanks keyed to viewer-mode position (page/rect or block/offset) after call-site inspection.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST set `session.slow.viewerMode` once at session create from `uploadMeta.originalFormat` (`"pdf"` → `"pdf"`, else `"scroll"`) and NEVER recompute it.
- **FR-002**: For `viewerMode === "pdf"`, system MUST render original PDF pages via pdf.js canvas + text layer; pagination unit is the PDF page.
- **FR-003**: For `viewerMode === "scroll"`, system MUST render full scoped markdown as continuous document flow (no viewport page-fit slicing for Slow Mode).
- **FR-004**: System MUST NOT delete `src/js/slow/pagination.js`; paced-reader remains a consumer. Slow Mode MUST stop calling Slow page-fit APIs (`computePageBreakpoints`, etc.).
- **FR-005**: Annotations MUST use shape `{ id, type, anchor, snippet, userText, createdAt, aiReply, graphLinks, isIAQuery?, orphaned? }` with `anchor.kind` of `"pdf-rect"` or `"block-offset"`.
- **FR-006**: `snippet` MUST be mandatory and non-empty for every newly created annotation.
- **FR-007**: Scroll blocks MUST receive deterministic `data-block-id` (`b0`, `b1`, …) at render; block-offset anchors are local to that block's textContent.
- **FR-008**: PDF annotation anchors MUST store 1-indexed page + normalized 0–1 rects from text-layer selection.
- **FR-009**: All 14 annotation types + `ia-query` MUST keep symbol, hotkey, tier, and color mapping unchanged.
- **FR-010**: Steel-man nudge proximity MUST be viewer-mode aware (pdf: same/adjacent page near edges; scroll: within N blocks, N=3 placeholder).
- **FR-011**: IA query read-head and anti-spoiler limits MUST use `currentPdfPage`/`maxReadPdfPage` (pdf) or `scrollAnchorBlockId`/`maxReadCharEnd` (scroll).
- **FR-012**: System MUST migrate scroll annotations once (schema version flag); MUST drop PDF legacy annotations with one-time notice (D-MIG option a).
- **FR-013**: System MUST remove `shared.annotations` dual-write (`addAnnotationToShared` / `mapSharedAnnotations`); graph MUST read `session.slow.annotations`.
- **FR-014**: Checkpoints MUST trigger at section boundaries per viewer mode (PDF page leave; scroll heading IntersectionObserver); 10s delay and dismissed-set unchanged.
- **FR-015**: Phase 0 generation prompts/schemas MUST remain unchanged; verify-only for fillable blank position keys.
- **FR-016**: Phase 3 Module A/B position/context math MUST be viewer-mode aware; flashcard→SM-2 path MUST remain untouched beyond type compatibility.
- **FR-017**: Graph proximity MUST use page-delta or block-index-delta scoring (placeholders marked unvalidated).
- **FR-018**: Ask-AI context slice MUST come from page/block text, not global char radius.
- **FR-019**: Reading position restore MUST persist `currentPdfPage` (pdf) or `scrollAnchorBlockId` + `scrollAnchorOffset` (scroll).
- **FR-020**: Dead fields MUST NOT be reintroduced: `headingOverrides`, `structureWarnings`, `fallbackSections`, `scopeEditMode`, `scopeCollapsedParents`, `breakpoints`, `readingScope`. `currentPageIndex` retired app-wide as position field.
- **FR-021**: Full-bleed Slow reader layout contract (`#screenSlowReader` outside `.container`, `body.slow-reader-active`) MUST remain in force.
- **FR-022**: Scope gate / DPP handoff (`scopedMarkdown` + mini-hierarchy) MUST remain unchanged.
- **FR-023**: PDF zoom UI is OUT OF SCOPE for v1.
- **FR-024**: Module A scroll labels MUST show section title (not a fabricated page number).
- **FR-025**: Orphaned annotations MUST surface distinctly in the sidebar.

### Key Entities

- **SlowSessionSlice**: `viewerMode`, annotations[], position fields (`currentPdfPage`/`pdfPageCount`/`maxReadPdfPage` or `scrollAnchorBlockId`/`scrollAnchorOffset`/`maxReadCharEnd`), `annotationSchemaVersion`, checkpointsDismissed.
- **Annotation**: typed mark with viewer-specific `anchor` + mandatory `snippet`.
- **PdfRectAnchor**: page + normalized rects[].
- **BlockOffsetAnchor**: blockId + local charStart/charEnd.
- **SectionBoundary**: unchanged hierarchy-derived ranges used for checkpoint triggers.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Fixture PDF with tall image shows zero content clipping in Slow reader (FM-01 regression guard passes).
- **SC-002**: 100% of new annotations persist a non-empty snippet and restore visual highlight on session reload (pdf-rect and block-offset round-trips).
- **SC-003**: Legacy scroll annotation fixtures migrate with correct local offsets + snippet in one pass; PDF legacy fixtures drop with notice exactly once.
- **SC-004**: All 14 types + ia-query retain menu/hotkey/tier parity vs pre-feature behavioral tests.
- **SC-005**: Existing paced-reader pagination test (`20260610_paced-reader-pagination.mjs`) passes unmodified.
- **SC-006**: Checkpoint triggers fire at section boundaries in both viewer modes on fixture docs (no mid-unit false positives beyond accepted D3 worst case).
- **SC-007**: Phase 3 Module A/B and graph enrichment behavioral contracts pass after anchor-model updates (same hit/miss intent).
- **SC-008**: Users can resume reading within one viewport of prior position for both viewer modes.

## Assumptions

- **D-MIG (a)**: Auto-migrate scroll annotations; drop PDF-bound legacy annotations with one-time notice. (Locked from draft; options b/c rejected.)
- **OQ-1**: No PDF zoom control in v1 (nice-to-have deferred).
- **OQ-2**: Fillable-map blank keys will be finalized after call-site inspection during planning/implementation; shape will be `(page, rect)` for pdf and `(blockId, offset)` for scroll.
- **OQ-3**: Proximity constants use marked placeholders (steel-man N=3 blocks; PDF edge ~15%; graph distance weights unvalidated).
- **OQ-4**: `html_min` legacy → scroll viewerMode plain-text path, preserve current non-crash behavior.
- **OQ-5**: Module A scroll page-label replacement = section title (product default under hands-off mode).
- Annotation type registry / tiers from `20260528-slow-mode` remain authoritative.
- LLM prompt templates in `api.js` are not modified; only context-slice inputs change.
- Implementation sequence follows draft §15 risk order: data model → migration → scroll viewer → scroll annotations → PDF viewer → PDF annotations → checkpoints → Phase 3 → graph → cleanup.

## Architecture notes (planning input)

Dual viewer behind immutable `viewerMode`. Detailed field tables, annotation shape, PDF/scroll rules, migration, checkpoints, Phase 3, and graph rules from the input draft §§5–14 are normative for implementation and MUST be reflected in `plan.md` / `data-model.md` / contracts. Non-goals NG1–NG6 from the input draft are binding.

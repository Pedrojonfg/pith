# Feature Specification: Native Viewer Post-Ship Fixes 01

**Feature Branch**: `20260809-native-viewer-fixes-01`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: `20260808-slow-mode-native-viewer-fixes-01.md` (repo-root draft) + audit `audit/20260808-native-viewer-post-ship.md`

**Corrects / extends:** `specs/20260808-slow-mode-native-viewer/` — R-PDF source availability, R-MIG persistence, R-ANN ai-context wiring, R-MIG-3 drop notice, orphaned-annotation consumers.

**Does not reopen:** viewer architecture (pdf.js vs scroll, anchor model, checkpoint triggers). Those remain as shipped in T01–T10.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PDF reader works on every entry path (Priority: P1)

A learner uploads a PDF and enters Slow Mode via any route (direct create → mode select → Slow, recommend-upload → Slow, or RSVP/Questions → Slow) and sees the native PDF pages render — not a “re-upload” failure message.

**Why this priority**: Confirmed blocker; breaks the primary entry paths for the native PDF viewer.

**Independent Test**: For each of the three entry paths, open a PDF-sourced Slow session and confirm the PDF renders with source available.

**Acceptance Scenarios**:

1. **Given** a PDF upload completed via the primary create flow, **When** the learner opens Slow without passing through the legacy Slow generate path, **Then** the native PDF viewer renders pages (no “PDF source unavailable” message).
2. **Given** a PDF entered via recommend-upload, **When** Slow opens, **Then** the PDF viewer has a resolvable source and renders.
3. **Given** a PDF session started in RSVP or Questions then switched to Slow, **When** Slow opens, **Then** the PDF viewer has a resolvable source and renders.
4. **Given** a PDF whose original bytes were never retained (legacy sessions before this fix), **When** Slow opens, **Then** the existing graceful “re-upload” message still appears (no crash).

---

### User Story 2 - Ask AI respects PDF read progress (Priority: P1)

A learner reading a PDF asks an IA question after reaching page N; the assistant only uses content from pages 1..N, and the feature works (non-empty context when pages have been read).

**Why this priority**: Confirmed blocker — Ask AI / IA on PDF sessions currently receives empty “text read so far,” so answers are blind.

**Independent Test**: Fixture PDF session with `maxReadPdfPage = N`; run an IA query; assert context includes only content through page N and is non-empty when N ≥ 1 and those pages have extractable text.

**Acceptance Scenarios**:

1. **Given** a PDF Slow session with read progress at page N, **When** the learner asks IA a question, **Then** context handed to the model does not include content from pages beyond N.
2. **Given** a PDF Slow session with at least one page read, **When** the learner asks IA, **Then** context is non-empty (feature is usable, not blank).
3. **Given** a scroll Slow session, **When** the learner asks IA, **Then** behavior remains based on character read progress (unchanged).

---

### User Story 3 - Annotation migration persists once (Priority: P2)

A learner with an older Slow session loads it twice; annotation migration runs once effectively, persists its completion marker with the migrated annotations, and produces identical results on the second load (no double-transform artifacts).

**Why this priority**: Latent correctness bug; must land before real PDF annotations accumulate.

**Independent Test**: Load a fixture with old-shape annotations twice; assert identical annotation set and schema version persisted after first load.

**Acceptance Scenarios**:

1. **Given** a session with old-shape annotations, **When** it is loaded, **Then** migrated annotations and the schema version flag are persisted together in one save.
2. **Given** that session loaded again, **When** migration would run, **Then** it is a no-op and annotations are unchanged (idempotent).
3. **Given** already-migrated (new-shape) annotations with the version flag missing (simulating failed persist), **When** migration runs twice, **Then** results remain identical with no duplicates or corruption.

---

### User Story 4 - One-time PDF drop notice (Priority: P3)

A learner whose legacy PDF highlights could not be migrated sees a one-time notice explaining that highlights could not be carried over after the reader upgrade, then does not see it again.

**Why this priority**: Spec’d in parent feature (R-MIG-3) but never wired to UI; no current real-data impact.

**Independent Test**: Fixture session with drop-notice flag set; open Slow; assert notice once; reopen; assert absent.

**Acceptance Scenarios**:

1. **Given** a session where PDF legacy annotations were dropped and the notice flag is set, **When** the learner next opens that Slow reader, **Then** a one-time notice appears with agreed copy (reader upgraded; PDF highlights could not be carried over).
2. **Given** the notice was shown, **When** the session is opened again, **Then** the notice does not reappear.

---

### User Story 5 - Orphaned annotations do not poison position-sensitive features (Priority: P2)

A learner with orphaned annotations still sees them in the sidebar and can convert text-only uses (e.g. flashcards), but position-sensitive features (Module A proximity, devil’s-advocate context, graph proximity linking, jump-to-source) do not treat orphans as valid positions.

**Why this priority**: Audit found partial handling; fix only where orphaned status causes bad outcomes.

**Independent Test**: Fixture with orphaned annotations; run Module A / graph proximity / navigate; assert orphans skipped; flashcard path still includes orphan `userText`.

**Acceptance Scenarios**:

1. **Given** an orphaned annotation, **When** Phase 3 Module A compares annotations to Phase 0, **Then** the orphan does not contribute false proximity matches.
2. **Given** an orphaned annotation, **When** devil’s-advocate / context slice runs, **Then** it does not use an invalid position as document context.
3. **Given** an orphaned annotation, **When** graph proximity auto-linking runs, **Then** the orphan is not used for position-based links (text-only node usage may remain).
4. **Given** an orphaned annotation, **When** the learner converts flashcards or views depth/findings that only need type/text, **Then** the orphan remains eligible.
5. **Given** an orphaned annotation, **When** the learner activates jump-to-source, **Then** the app does not silently jump to a dummy/wrong position (no-op or clear orphan UX).

---

### Edge Cases

- PDF upload where encoding/stashing original bytes fails → keep graceful re-upload message; do not crash mode entry.
- Very large PDFs → base64 stash may grow session size; accept same approach as legacy Slow generate path for this fix set (no new binary IndexedDB).
- Scroll sessions must remain unaffected by PDF IA / pdfSource changes.
- Migration on empty annotations list → still persist schema version so re-entry stops.
- Drop notice with no UI shell available → defer until reader init; never block reading.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST retain original PDF bytes on the document’s shared layer at upload time for every PDF upload path that creates or updates a study document (not only the legacy Slow generate path), using the same durable shape already used by the legacy path (`shared.pdfSource` as a base64 payload object).
- **FR-002**: System MUST treat PDF source as a document property: Slow bootstrap MUST copy `shared.pdfSource` into the Slow slice when entering Slow, independent of which mode ran first.
- **FR-003**: System MUST only show “PDF source unavailable / re-upload” when bytes truly cannot be resolved after upload-time retention and bootstrap copy.
- **FR-004**: Ask AI / IA context builder MUST branch on viewer mode: scroll continues to use character read progress; PDF MUST limit context to content through the recorded max PDF page read.
- **FR-005**: For PDF sessions with progress ≥ 1 and extractable page text, IA context MUST be non-empty (no blank “text read so far” solely because character progress is unset).
- **FR-006**: After annotation-schema migration runs, the schema version flag and migrated annotations MUST be persisted in the same session save.
- **FR-007**: Annotation migration MUST remain idempotent on already-migrated data (safe no-op / identity).
- **FR-008**: When the PDF legacy-annotations-dropped notice flag is set, the Slow reader MUST show a one-time dismissible notice with agreed copy, then persist that it was shown so it does not repeat.
- **FR-009**: Position-sensitive consumers of annotations (Module A proximity, devil’s-advocate / annotation context slice, graph proximity linking, navigate-to-annotation) MUST not treat `orphaned` annotations as valid positions.
- **FR-010**: Text-only consumers (flashcard conversion eligibility, gamification depth/findings that use type/userText only, Module C text lists) MUST NOT blanket-skip orphaned annotations solely for being orphaned.

### Key Entities

- **PdfSource**: Durable shared reference to original PDF bytes (`kind` + `data`), owned by the document shared layer; copied into Slow for the viewer.
- **AnnotationSchemaVersion**: Integer flag on the Slow slice indicating migration completion (current target version = 2).
- **PdfLegacyAnnotationsDroppedNotice**: Boolean (plus shown/dismissed state as needed) gating the one-time user notice after non-migratable PDF highlights were dropped.
- **Orphaned annotation**: Annotation that retains type/userText/snippet but has no reliable document position; sidebar-visible; excluded from position-sensitive features.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On all three previously broken entry paths, a new PDF upload reaches Slow with a working native PDF render (≥95% of fixture runs; zero “source unavailable” on fresh uploads where stash succeeded).
- **SC-002**: For PDF sessions with max read page = N, 100% of IA context fixtures exclude pages > N and include non-empty context when pages 1..N have text.
- **SC-003**: Double-load of old-shape annotation fixtures yields identical annotation sets and a persisted schema version after the first load (0 double-transform artifacts).
- **SC-004**: Drop-notice fixtures show the notice exactly once across two consecutive Slow opens.
- **SC-005**: Orphan fixtures produce 0 false Module A proximity matches and 0 erroneous navigate jumps; flashcard eligibility still includes orphan text.
- **SC-006**: Existing native-viewer regression suite (`20260808_t0X`) remains green after each fix lands.

## Assumptions

- **Upload-time retention required:** Inspection confirmed original PDF bytes are not kept after markdown extraction except on the legacy Slow generate path. DPP-only resolution is impossible today. This fix set therefore adds upload-time `shared.pdfSource` stashing on all PDF upload paths (same base64 shape as legacy), not a DPP-only stash. Lazy resolve without prior stash still falls through to re-upload.
- **IA severity:** Current PDF IA behavior is empty context (broken feature), not unbounded full-document spoiler. Fix restores bounded, non-empty context via `maxReadPdfPage`.
- **Schema flag name:** `annotationSchemaVersion` (target 2). Drop notice field: `pdfLegacyAnnotationsDroppedNotice`.
- **Orphan fix scope:** Patch Module A, devil’s-advocate/context slice, graph proximity, and navigate; do not blanket-skip flashcards/depth/Module C.
- **Copy/locale:** Match existing Slow / inventory banner patterns for the drop notice (English app UI per project rules).
- **Out of scope:** New binary IndexedDB for originals; changing pdf.js vs scroll architecture; re-auditing real user data until after FR-001 lands and PDF sessions accumulate.
- **Parent feature code** already on the working tree / branch is the baseline; this feature only patches the five gaps above.

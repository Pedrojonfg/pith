# Feature Specification: Cross-Document Concept Vault & Global Concept Registry

**Feature Branch**: `20260626-cross-doc-vault`

**Created**: 2026-06-15

**Status**: Draft

**Input**: User description: "Cross-Document Concept Vault & Global Concept Registry — A global concept registry above per-document shared data, gray/yellow/green maturity, automatic population from study modes (no curation gate), global SM-2 per facet, vault graph view, ingest-only document path."

**Depends on**: Recall mode, Study Projects, Unified Session, existing graph rendering and SM-2 infrastructure.

**Supersedes (partial)**: Knowledge Vault Curation commit/curation gate — population becomes automatic.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Concepts mature as I study (Priority: P1)

When I answer questions about a concept in any study mode (RSVP, Questions, Cloze, Recall, Slow), the system recognizes that concept across all my documents. Concepts I have never been asked about stay local to each document (gray). Concepts I have engaged with appear in a global registry (yellow). Concepts where I have written meaningful recall responses become vault pages with my own words (green).

**Why this priority**: This is the core differentiator — the vault emerges from active recall, not manual note-taking or speculative generation.

**Independent Test**: Upload a document, answer one MCQ tagged to a concept → concept appears yellow in global registry with a review schedule; no manual "upload to vault" step required.

**Acceptance Scenarios**:

1. **Given** a document with concept inventory and no prior engagement, **When** the user answers an MCQ tagged to concept X, **Then** identity resolution runs once, a global concept row is created or matched, and the concept becomes yellow with an initial recognition-facet schedule.
2. **Given** the same concept name in two documents (both gray), **When** the user is asked about it in only one document, **Then** only that document's entry links to the global concept; the other remains gray until engaged.
3. **Given** a yellow concept, **When** the user submits a qualifying Recall synthesis/relational/argumentative response (or Slow Phase 3 steel-man/devil's-advocate), **Then** maturity becomes green and user-authored content is stored append-only with supersession history.
4. **Given** a green concept whose mastery has decayed, **When** the user views it, **Then** it remains green (content exists) but shows a review prompt — distinct from yellow (no content) and gray (never engaged).

---

### User Story 2 - One review schedule per concept across documents (Priority: P1)

Review surfaces due items from a global schedule per concept and facet, not duplicated per document. Answering a review item updates the global facet schedule and mastery decay.

**Why this priority**: Eliminates duplicate SM-2 entries when the same concept appears in multiple documents.

**Independent Test**: Study concept X in doc A and doc B → Review shows one queue entry per facet, not two.

**Acceptance Scenarios**:

1. **Given** a concept exercised in RSVP (recognition facet) and later in Recall (synthesis facet), **When** Review runs, **Then** both facet schedules appear independently in the global queue.
2. **Given** legacy per-document smItems for a resolved concept, **When** migration runs, **Then** schedules move to global ConceptFacetSchedule rows and local smItems become read-through only during transition.
3. **Given** a review answer with quality rating, **When** saved, **Then** the matching global facet schedule updates SM-2 interval/ease/due date and a VaultObservation is recorded for mastery decay.

---

### User Story 3 - Vault graph shows what I have engaged with (Priority: P2)

From App Home Vault tab (cold start), I see a graph of yellow and green concepts — what I have actually studied. When viewing from within a document, gray concepts from that document appear as contextual neighbors (same as existing gap-node convention).

**Why this priority**: Makes cross-document knowledge visible without speculative concept pages.

**Independent Test**: Open Vault with no document focused → only yellow/green nodes; open Vault from document context → gray neighbors overlay.

**Acceptance Scenarios**:

1. **Given** yellow and green concepts in the registry, **When** the user opens Vault cold, **Then** the graph shows only yellow/green nodes with maturity-appropriate styling.
2. **Given** a focused document with gray inventory concepts, **When** Vault opens in document context, **Then** gray nodes appear as gap-style neighbors alongside global yellow/green nodes.
3. **Given** co-occurring concepts in the same document, **When** the vault graph renders, **Then** weak co-occurrence edges connect them; prerequisite edges from document hierarchy are preserved.
4. **Given** a green node with low mastery, **When** rendered, **Then** a review badge appears; clicking opens consolidated content with expandable history.

---

### User Story 4 - Study a yellow concept via Recall (Priority: P2)

From a yellow node in the vault graph, I can start Recall mode scoped to that concept across documents.

**Why this priority**: Closes the loop from vault discovery to deep recall authoring (green promotion).

**Independent Test**: Click yellow node → Recall opens pre-scoped to that global concept.

**Acceptance Scenarios**:

1. **Given** a yellow concept in the vault graph, **When** the user chooses "Study this", **Then** Recall mode opens with optional focus on that global concept ID.
2. **Given** Recall completes with qualifying content, **When** saved, **Then** the concept promotes to green and content blocks are visible on the concept page.

---

### User Story 5 - Ingest documents without full study (Priority: P3)

I can upload a file that runs inventory-only processing so gray concepts populate the vault graph context without entering a study mode.

**Why this priority**: Enables corpus building and recommendation flows without forcing full study.

**Independent Test**: Upload via ingest path → document in library with inventory only, all concepts gray with null globalConceptId.

**Acceptance Scenarios**:

1. **Given** a file upload via ingest entry point, **When** pipeline completes, **Then** a DocumentSession exists with conceptInventory populated, no mode slices, and all entries have globalConceptId null.
2. **Given** an ingest-only document, **When** opened in Vault with document context, **Then** its gray concepts appear as graph neighbors.

---

### User Story 6 - No manual curation gate (Priority: P1)

The previous "Upload to vault" curation screen and commit gate are removed. Vault population is automatic per promotion rules.

**Why this priority**: Aligns product with recall-driven vault emergence.

**Independent Test**: Complete a study session → concepts promote automatically; no curation screen blocks commit.

**Acceptance Scenarios**:

1. **Given** study activity that triggers gray→yellow, **When** the session ends, **Then** global registry updates without user curation step.
2. **Given** Session Hub, **When** viewed, **Then** "Upload to vault" curation flow is removed or replaced with informational link to Vault graph.

---

### Edge Cases

- Identity resolution ambiguous match (e.g., "Laplace Transform" vs "Inverse Laplace Transform"): default to split (new concept), store related hint — bias toward false negatives over false merges.
- Same concept engaged before resolution completes: assessmentSignals backfilled with globalConceptId once resolved.
- Applicative Recall responses: update facet schedule but do not alone promote to green (content blocks only for synthesis/relational/argumentative).
- Slow checkpoint dismissed without quality signal: does not promote gray→yellow.
- Manual merge/split of misidentified concepts: deferred — API hooks only, no UI in this feature.
- Registry size stays small (hundreds of yellow/green); linear scan for identity resolution acceptable in Phase 1.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST maintain a global concept registry separate from per-document conceptInventory, storing only yellow and green concepts (gray stays local).
- **FR-002**: Each global concept MUST have canonicalName, slug, aliases, maturity (yellow|green), cached mastery scalar (0–1), sourceDocIds, and timestamps.
- **FR-003**: Per-document conceptInventory entries MUST gain nullable globalConceptId, populated when gray→yellow promotion occurs.
- **FR-004**: System MUST run identity resolution (embedding/similarity + slug/alias fuzzy match) once per concept at first gray→yellow trigger, reusing high-confidence matches or creating new rows; medium-confidence matches MUST default to split.
- **FR-005**: Gray→yellow MUST trigger on first assessmentSignal, smItem-equivalent schedule event, Cloze completion, Recall submission (any facet), or Slow checkpoint with explicit quality signal.
- **FR-006**: Yellow→green MUST trigger on qualifying Recall synthesis/relational/argumentative responses (tutor quality ≥ threshold) or Slow Phase 3 steel-man/devil's-advocate responses.
- **FR-007**: System MUST store ConceptContent as append-and-supersede blocks per facet, retaining history with supersededBy links.
- **FR-008**: System MUST maintain ConceptFacetSchedule per (concept, facet) with SM-2 fields; facets include recognition, synthesis, relational, argumentative, applicative.
- **FR-009**: Non-Recall modes MUST write schedule updates to recognition facet by default; quality mapping MUST reuse existing per-mode SM-2 quality values.
- **FR-010**: shared.smItems MUST be deprecated with read-through migration to global ConceptFacetSchedule during transition.
- **FR-011**: shared.assessmentSignals MUST gain globalConceptId, backfilled after resolution.
- **FR-012**: VaultObservation records MUST reference globalConceptId and feed mastery decay (lambda = 0.05, uncalibrated).
- **FR-013**: Mastery MUST be monotonic in maturity state — decay affects mastery scalar only, not gray/yellow/green status.
- **FR-014**: Vault graph MUST reuse existing graph rendering; node styling MUST distinguish gray (gap), yellow (desaturated accent), green (full accent + low-mastery badge).
- **FR-015**: Vault graph edges MUST include co-occurrence (shared documents), prerequisites (from document hierarchy), and explicit links from Recall content mentioning other concepts.
- **FR-016**: Review MUST aggregate due ConceptFacetSchedule entries globally, not per document.
- **FR-017**: Ingest-only upload path MUST create DocumentSession with inventory only (no mode slices, all gray).
- **FR-018**: System MUST remove automatic curation/commit gate from Knowledge Vault Curation; population is automatic per promotion rules.
- **FR-019**: Study Projects projectId MAY filter vault graph view to concepts from documents in project subtree (read-only filter).
- **FR-020**: Recall mode MUST accept optional focusConceptId to scope session to a global yellow concept from vault navigation.
- **FR-021**: Global registry persistence MUST use concept-registry-store.js as single seam (localStorage Phase 1, Supabase-ready interface Phase 2).
- **FR-022**: DocumentSession.schemaVersion MUST bump with migration for globalConceptId fields per existing session-migration convention.

### Key Entities

- **Concept**: Global registry entry for yellow/green concepts; canonical identity, maturity, mastery cache, facet schedules, optional content, source documents.
- **ConceptFacetSchedule**: SM-2 state per (concept, facet) — interval, repetitions, easeFactor, dueDate, lastReviewedAt, lastQuality.
- **ConceptContent / ConceptContentBlock**: User-authored text per facet with supersession history; green concepts only.
- **ConceptInventoryEntry (extended)**: Per-document concept with nullable globalConceptId linking to registry when resolved.
- **VaultObservation**: Timestamped quality observation per global concept and facet for decay computation.
- **ConceptLink hints**: Related concept candidates from ambiguous resolution (not merged).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users who answer a question about a concept see it in the global registry within one session action — no manual vault upload step.
- **SC-002**: Duplicate review queue entries for the same concept across documents drop to zero after migration (one entry per facet globally).
- **SC-003**: 95% of gray→yellow promotions complete identity resolution in under 3 seconds (single resolution call per concept).
- **SC-004**: Vault cold graph loads yellow/green nodes in under 2 seconds for registries up to 500 concepts.
- **SC-005**: Green concept pages show non-superseded content blocks by default; history expandable in one click.
- **SC-006**: Ingest-only upload produces a browsable document with inventory in under 60 seconds for typical documents (inventory phase only).
- **SC-007**: Zero concepts promote to green without user-authored qualifying content (no speculative pages).

## Assumptions

- Recall mode and unified session infrastructure are available; this feature extends rather than replaces them.
- Identity resolution uses embedding + fuzzy slug/alias match; linear registry scan acceptable until Supabase/pgvector Phase 2.
- Single mastery scalar per concept retained; per-facet schedules exist for SM-2 timing only, not per-facet mastery scores.
- PACER taxonomy and BKT remain out of scope.
- Obsidian import/export and manual merge UI are deferred to future specs.
- Facet weighting in mastery aggregation uses simple average for v1; residuals logged for future tuning.
- Applicative facet excluded from green content promotion until usage data warrants change.
- English UI and English internal heuristics per project conventions.

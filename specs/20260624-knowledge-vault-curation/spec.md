# Feature Specification: Knowledge Vault Curation

**Feature Branch**: `20260624-knowledge-vault-curation`

**Created**: 2026-06-14

**Status**: Draft

**Input**: User description: "Knowledge Vault Curation — Navigation, Facets, Upload & Review Loop. Closes the bidirectional loop between document sessions and the Global Knowledge Vault: manual curation of definitions and facet-tagged review items from studied concepts; Review responses update mastery decay and SM-2 scheduling. App Home bifurcates Vault vs Sessions navigation."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - App Home navigation (Priority: P1)

After API setup, the learner lands on a top-level home with two branches: **Vault** (Knowledge Vault browse + Review) and **Sessions** (project library and document study). Session Hub is reached only from the library for a specific document—not as the app home.

**Why this priority**: Without clear top-level navigation, vault curation and session study remain conflated; this is the structural prerequisite for all other flows.

**Independent Test**: Complete API setup → see App Home with Vault and Sessions → Vault opens vault branch menu → Sessions opens project library.

**Acceptance Scenarios**:

1. **Given** a configured API key, **When** the app loads, **Then** the user sees App Home with `Vault` and `Sessions` actions (not mode picker).
2. **Given** App Home, **When** the user chooses Sessions, **Then** they reach the project library to browse projects and documents.
3. **Given** App Home, **When** the user chooses Vault, **Then** they see Knowledge Vault and Review entry points.
4. **Given** a document opened from the library, **When** Session Hub appears, **Then** it shows mode picker scoped to that document with breadcrumb context—not global Continue/Library/Review hub buttons.

---

### User Story 2 - Upload studied concepts to vault (Priority: P1)

From Session Hub, the learner taps **Upload to vault**, reviews LLM-suggested definitions and facet-tagged review items for concepts they actually studied in this session, edits selections, and commits curated content to the Global Knowledge Vault.

**Why this priority**: This is the primary session→vault curation loop and delivers immediate value for long-term retention.

**Independent Test**: Study at least one concept in RSVP → open Session Hub → Upload to vault → accept one definition → commit → verify vault entry has definition and optional review item.

**Acceptance Scenarios**:

1. **Given** a session with studied concepts, **When** the user taps Upload to vault, **Then** only interacted concepts appear as candidates (not full inventory).
2. **Given** candidate screen, **When** suggestions load, **Then** each concept shows editable definition and 0–3 facet-tagged review item cards with checkboxes.
3. **Given** default selection, **When** the screen opens, **Then** definitions are checked only if no prior definition from this document exists; review items are unchecked by default.
4. **Given** accepted selections, **When** the user commits, **Then** vault entries merge via normalization, definitions append idempotently per source document, and accepted review items get SM-2 schedule with immediate due date.
5. **Given** a repeat upload from the same session, **When** the user commits again, **Then** duplicate definitions from the same source document are not created.

---

### User Story 3 - Facet-tagged vault review closes decay loop (Priority: P1)

During Review, curated vault review items (distinct facets: synthesis, relational, argumentative, applicative, cloze) appear alongside session smItems. Answering updates vault mastery, resets decay clock, updates facet coverage metadata, and advances per-item SM-2.

**Why this priority**: Without review→vault feedback, curated items do not improve long-term scheduling or mastery accuracy.

**Independent Test**: Commit a vault review item → run scoped Review → answer item → verify vault entry masteryLastUpdated refreshed and facetCoverage updated.

**Acceptance Scenarios**:

1. **Given** vault review items in project scope, **When** Review runs, **Then** both session smItems and vault reviewItems appear in the queue with distinguishable source.
2. **Given** a vault review item answer, **When** the user rates quality, **Then** vault observation types review_correct/partial/wrong apply with specified signal weights.
3. **Given** a vault review answer with facet, **When** mastery recalculates, **Then** scalar mastery updates (not per-facet mastery) and facetCoverage records verification timestamp.
4. **Given** a vault review item, **When** SM-2 updates, **Then** item interval/ease/due date follow the same quality mapping as Recall mode.

---

### User Story 4 - Session Hub utilities (Priority: P2)

Session Hub exposes **Download session MD** (existing export) and **Upload to vault** alongside the mode picker for the active document.

**Why this priority**: Surfaces existing export and new curation without leaving the document context.

**Independent Test**: Open Session Hub for a document with material → Download session MD produces file → Upload to vault navigates to candidate screen.

**Acceptance Scenarios**:

1. **Given** Session Hub with active document, **When** user taps Download session MD, **Then** markdown export runs as today.
2. **Given** Session Hub, **When** user taps Upload to vault without studied concepts, **Then** a clear empty-state message appears.

---

### Edge Cases

- Upload to vault with no API key: show actionable error, allow cancel back to Session Hub.
- LLM extraction fails: show retry and cancel; no partial commit without user action.
- Vault review item references deleted session: exclude from scoped review pool.
- Review queue empty after scope filter: show existing empty state.
- Legacy vault (no definitions/reviewItems): migration adds empty arrays without data loss.
- Multiple review items same facet: allowed; LLM de-duplicates suggestions only at extraction time.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show App Home (`Vault`, `Sessions`) as first screen after API setup when a key is stored.
- **FR-002**: System MUST route Vault branch to Knowledge Vault browse and Review with project scope picker.
- **FR-003**: System MUST route Sessions branch to project library; document selection MUST open Session Hub for that document only.
- **FR-004**: System MUST remove global home-hub buttons (Continue, Library, Review) from Session Hub when no document context; hub buttons MUST NOT appear as app entry.
- **FR-005**: Session Hub MUST include `Download session MD` and `Upload to vault` actions for the active document.
- **FR-006**: System MUST compute upload candidates as union of concept IDs the user interacted with across RSVP, Questions, assessment signals, Cloze progress, and answered Recall questions.
- **FR-007**: System MUST call a single batch LLM extraction per upload action returning per-concept definition and 0–3 facet-tagged review suggestions prioritizing uncovered facets.
- **FR-008**: Candidate screen MUST allow edit/select per definition and review item before commit.
- **FR-009**: Commit MUST use existing vault normalization (merge/alias/new), append definitions idempotently per sourceDocId, and create VaultReviewItem records with SM-2 due immediately.
- **FR-010**: Global Knowledge Vault MUST persist `reviewItems`, per-entry `definitions`, and `facetCoverage` with additive migration from prior vault data.
- **FR-011**: Review scope aggregation MUST merge session `smItems` and vault `reviewItems` filtered by project scope, tagging each item with `source: session|vault`.
- **FR-012**: Review answers on vault items MUST create observations `review_correct` (+1.0), `review_partial` (+0.3), `review_wrong` (-0.5), update scalar mastery, reset `masteryLastUpdated`, update `facetCoverage` when facet present, and update item SM-2.
- **FR-013**: System MUST log decay calibration entries (predicted vs observed) to capped local instrumentation storage without changing decay formula.
- **FR-014**: UI strings MUST be English per product convention (facet badges: Synthesis, Relational, Argumentative, Applicative, Cloze).

### Key Entities

- **ConceptFacet**: One of synthesis, relational, argumentative, applicative, cloze — reuses Recall question taxonomy.
- **VaultDefinition**: User/source-authored definition text tied to sourceDocId and optional sourceChunk.
- **VaultReviewItem**: Curated prompt/answer card per facet with independent SM-2 state linked to vaultEntryId.
- **facetCoverage**: Per-entry map of facet → last verified timestamp (metadata only, not parallel mastery).
- **DecayCalibrationLogEntry**: Instrumentation record comparing predicted decay mastery to observed review signal.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users reach App Home and open either branch in under 10 seconds after launch.
- **SC-002**: 90% of upload attempts with studied concepts show at least one candidate within one LLM call.
- **SC-003**: Committed vault review items appear in scoped Review queue on the next Review session without app restart.
- **SC-004**: After answering a vault review item, vault entry mastery decay recalculates from review time (user-visible via debug vault panel or export).
- **SC-005**: Repeat upload from same session does not duplicate definitions from the same document in 100% of idempotent test cases.
- **SC-006**: Project-scoped Review includes vault items whose source documents belong to scope in 100% of integration test fixtures.

## Assumptions

- Knowledge Vault A+, Study Projects, Recall mode, and SM-2 priority queue features are already shipped.
- Scalar mastery model from A+ remains; per-facet mastery is explicitly out of scope.
- Knowledge Vault bulk edit/merge (Post-A+) remains out of scope; vault browse stays read-only except curation additions.
- BKT activation thresholds unchanged from Post-A+; decay calibration log is instrumentation only in v1.
- `cloze` facet is included in ConceptFacet per draft spec (extends Recall's four types).
- Existing `exportSessionMarkdown` satisfies Download session MD without functional changes.

## Dependencies

- `20260618-knowledge-vault-a-plus` — vault store, normalization, mastery model
- `20260623-study-projects` — project library, scoped review, breadcrumbs
- `20260621-recall-mode` — facet taxonomy and SM-2 quality mapping
- `20260620-sm2-priority-queue` — review queue and SM-2 update helpers

## Out of Scope

- Proactive facet gap suggestions based on facetCoverage age
- Multi-concept vault review items
- Lambda recalibration from calibration log
- Bulk vault entry editing/merging (Post-A+ Block 1)

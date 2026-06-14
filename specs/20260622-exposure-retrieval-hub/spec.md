# Feature Specification: Exposure / Retrieval Architecture & Retrieval Hub

**Feature Branch**: `20260622-exposure-retrieval-hub`

**Created**: 2026-06-14

**Status**: Draft

**Input**: Formalize exposure vs retrieval mode taxonomy; introduce a per-document Retrieval Hub offering Questions, Cloze, and Recall as neutral choices; reposition Review as a vault-level entry aggregating spaced-review items across all documents. Does not change the embedded RSVP block test/socratic sub-flow.

**Prerequisites**: Unified document sessions with shared learning data (`20260609-unified-session`); mode continuity and assessment signals (`20260612-mode-continuity`); SM-2 priority queue (`20260620-sm2-priority-queue`); Recall mode (`20260621-recall-mode`).

**Related follow-up (out of scope for v1)**: Capture spontaneous learner questions from guide chat and Slow Mode AI sidebar as `exposureSignals` for hub targeting; recommender badges on hub options; flow panel suggesting a specific hub choice.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Choose retrieval practice after exposure (Priority: P1)

As a learner who just finished reading a document (RSVP or Slow Mode), I want to pick how I practice retrieval—Questions, Cloze, or Recall—instead of being pushed toward a single default, so consolidation matches my learning goal.

**Why this priority**: Fixes the main post-exposure decision point; delivers the Retrieval Hub value immediately after the highest-intent moment.

**Independent Test**: Complete the last RSVP block or Slow Mode phase 3; land on the Retrieval Hub; choose any of the three options and enter that mode successfully.

**Acceptance Scenarios**:

1. **Given** the learner completed RSVP on a document, **When** the session ends, **Then** they see the Retrieval Hub with three equally presented options: Questions, Cloze, and Recall—not a direct jump to Review or a generic mode selector alone.
2. **Given** the learner completed Slow Mode phase 3, **When** they finish, **Then** they land on the same Retrieval Hub screen with the same three options.
3. **Given** the hub is shown, **When** the learner selects an option, **Then** they enter that retrieval mode for the active document without an extra intermediate "generate" screen for Cloze.
4. **Given** shared concept inventory exists from exposure, **When** the learner picks any hub option, **Then** that mode reuses existing shared data rather than asking for re-upload.

---

### User Story 2 — Start retrieval on a document without prior exposure (Priority: P1)

As a learner opening a document from my library, I want a clear "practice this document" path that leads to Questions, Cloze, or Recall even if I never ran RSVP or Slow, so retrieval works as a cold entry point.

**Why this priority**: The hub must work for both warm (post-exposure) and cold (library) entry with identical UI.

**Independent Test**: Open a document from the library that has source material but no prior modes; use "Practice this document"; pick Recall; system prepares inventory and starts retrieval without RSVP reading.

**Acceptance Scenarios**:

1. **Given** a document with uploaded material and no prior study modes, **When** the learner chooses practice/retrieval from the document library or mode area, **Then** they see the Retrieval Hub with all three options enabled and equally visible.
2. **Given** no concept inventory yet, **When** the learner selects Cloze, **Then** generation runs transparently inside that mode—no separate "generate items" step on the hub.
3. **Given** no block structure yet, **When** the learner selects Questions, **Then** the system builds what it needs from the document and starts the quiz path without RSVP reading.
4. **Given** a document with no source material, **When** the learner attempts retrieval, **Then** they are guided to upload material first with a clear message—not a broken hub option.

---

### User Story 3 — Retrieval modes use exposure weak spots (Priority: P2)

As a learner who missed concepts during RSVP or embedded block tests, I want Questions, Cloze, and Recall to prioritize what I struggled with, so practice time focuses on gaps.

**Why this priority**: Generalizes assessment-signal targeting beyond Cloze alone; increases learning efficiency after exposure.

**Independent Test**: Complete RSVP with known wrong answers on concepts A and B; open hub and start Questions; items touching A or B appear earlier in the session order.

**Acceptance Scenarios**:

1. **Given** assessment signals record weak concepts from RSVP or Questions, **When** the learner starts Questions from the hub, **Then** blocks or items involving those concepts are prioritized in study order.
2. **Given** the same weak signals, **When** the learner starts Recall from the hub, **Then** generated questions weight weak concepts more heavily.
3. **Given** the same weak signals, **When** the learner starts Cloze from the hub, **Then** existing prioritization behavior continues to apply.
4. **Given** no assessment signals exist, **When** any hub option is chosen, **Then** the mode uses its default ordering without error.

---

### User Story 4 — Review across all documents from the library (Priority: P1)

As a learner with spaced-review items from multiple documents, I want to start Review from the document library without picking a single document first, so "what's due today" reflects my whole learning vault.

**Why this priority**: Review is pedagogically vault-scoped; misplacing it inside one document hides cross-document due items.

**Independent Test**: Create due spaced-review items in two different documents; open document library; start Review from vault entry; queue includes items from both documents; completing an item updates the originating document's review pool.

**Acceptance Scenarios**:

1. **Given** due spaced-review items exist across multiple documents, **When** the learner opens Review from the vault/library level, **Then** the queue aggregates all due items regardless of which document is currently active.
2. **Given** the learner is reviewing an item from document A while document B is active, **When** they rate the item, **Then** the result is saved to document A's shared review pool without corrupting document B's session.
3. **Given** no items are due, **When** the learner opens vault Review, **Then** they see a friendly empty state—not an error.
4. **Given** the learner is inside a single document's mode selector, **When** they look for Review, **Then** Review is not presented as a peer study mode alongside RSVP and Slow—vault Review is reachable from the library instead.

---

### User Story 5 — Neutral hub without recommendation pressure (Priority: P2)

As a learner at the hub, I want three equal choices without badges or default highlighting from the flow recommender, so I stay in control of how I retrieve.

**Why this priority**: Explicit product decision—hub is a choice screen, not a second recommender surface.

**Independent Test**: Complete exposure with an active flow recommendation; open hub; no option is pre-selected, badged, or visually ranked by the recommender.

**Acceptance Scenarios**:

1. **Given** a flow recommendation exists for the document, **When** the Retrieval Hub is shown, **Then** none of the three options displays recommender badges or "recommended" styling.
2. **Given** the hub is visible, **When** displayed, **Then** Cloze is never shown as disabled or "not generated"—it looks the same as Questions and Recall.

---

### Edge Cases

- Learner backs out of hub → returns to document library or previous screen without losing shared data.
- Learner has in-progress retrieval slice for one mode → hub may show resume hints or entering that mode resumes; hub does not wipe progress.
- Very long document with partial exposure → hub options still work; cold paths generate proportionally.
- Only one retrieval mode has resumable progress → user can still choose any of the three; non-resumable modes start fresh or bootstrap per existing mode rules.
- Vault Review item references deleted document → skip or show graceful message; do not crash queue.
- Legacy sessions with old per-document Review configuration → migration preserves spaced items in shared; no user-visible regression.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST classify each study mode by pedagogical role (`exposure` or `retrieval`) and scope (`document` or `vault`) as declarative metadata available to navigation and UI builders.
- **FR-002**: System MUST provide a Retrieval Hub screen per document presenting exactly the document-scoped retrieval modes (Questions, Cloze, Recall) with neutral, equal presentation—no recommender badges or priority ordering on v1.
- **FR-003**: System MUST route learners to the Retrieval Hub after completing an exposure mode (RSVP last block, Slow Mode phase 3 completion) instead of defaulting them toward Review or an undifferentiated mode selector alone.
- **FR-004**: System MUST provide a library/mode entry path ("Practice this document" or equivalent) that opens the Retrieval Hub for the selected document, with or without prior exposure on that document.
- **FR-005**: System MUST NOT require a separate hub-level generation step for Cloze; selecting Cloze from the hub MUST delegate to that mode's existing generate-or-reuse pipeline transparently.
- **FR-006**: System MUST NOT change the embedded RSVP per-block test and socratic sub-flow; only post-exposure and library decision points are in scope.
- **FR-007**: Questions, Cloze, and Recall started from the hub MUST read shared assessment signals when present and prioritize weak concepts in study or question order (generalizing behavior already present for Cloze).
- **FR-008**: Review MUST be accessible as a vault-level action from the document library (or equivalent top-level navigation) without requiring document selection first.
- **FR-009**: Vault Review MUST build its queue from due spaced-review items aggregated across all stored document sessions.
- **FR-010**: Vault Review MUST persist rating outcomes to the originating document's shared review pool identified on each item.
- **FR-011**: Review MUST NOT appear as a peer radio option alongside exposure and retrieval modes on the per-document mode selector.
- **FR-012**: System MUST preserve backward compatibility for existing sessions: spaced-review items remain in shared storage; legacy per-document Review mode slots may remain empty internally without user-facing exposure.
- **FR-013**: Shared data shape for optional future `exposureSignals` MUST be documented as reserved extension space without implementing capture in v1.

### Key Entities

- **Mode taxonomy entry**: Declarative descriptor for a study mode—role (`exposure` | `retrieval`), scope (`document` | `vault`), and display identity. Used to build hub options and navigation rules; not persisted per session.
- **Retrieval Hub context**: Transient navigation state tying the hub to one active document, including whether entry was post-exposure or from library (same UI; richer shared data may exist post-exposure).
- **Assessment signal**: Existing shared record of concept-level weak/strong results from exposure or retrieval; consumed by all three hub retrieval modes for prioritization.
- **Spaced-review item (`smItem`)**: Shared schedulable retrieval unit with due date, quality history, source mode, and originating document identifier; aggregated for vault Review.
- **Vault review queue**: Ordered list of due `smItem` records from all documents, presented in the existing Review study UI with cross-document metadata shown to the learner where helpful.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of post-exposure session completions in user testing land on the Retrieval Hub before any other study screen (RSVP and Slow paths).
- **SC-002**: Learners can reach any of the three retrieval modes from the hub in no more than two taps/clicks from hub display.
- **SC-003**: When assessment signals exist, weak concepts appear in the first half of Questions block order or Recall question set in at least 80% of seeded test scenarios.
- **SC-004**: Vault Review queue includes due items from all documents in integration tests; zero items lost when switching active document during review.
- **SC-005**: Learners report (or task success shows) they can find vault Review from the library without first opening a document—in under 15 seconds in moderated usability checks.
- **SC-006**: No regression in RSVP embedded block test completion rate or time compared to pre-change baseline in automated smoke tests.

## Assumptions

- Recall, Cloze, and Questions mode internals (generation APIs, tutor loops, pipelines) remain as implemented; this feature changes navigation, taxonomy, and signal consumption—not core retrieval mechanics.
- Per-document Review UI screens (`config → generating → study → summary`) are reused for vault Review with a different data source query.
- Legacy `modes.review` slots may remain as empty compatibility shells rather than schema deletion, avoiding a storage version bump.
- During vault Review, the system writes results to each item's origin document without requiring that document to become the active document.
- Flow recommender and flow panel continue to operate on mode select and exposure flows; they do not decorate the Retrieval Hub in v1.
- Optional `exposureSignals` capture from guide chat and Slow sidebar is deferred; shared schema documentation reserves the field name only.

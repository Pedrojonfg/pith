# Feature Specification: Global Knowledge Vault (Post A+)

**Feature Branch**: `20260619-knowledge-vault-post-a-plus`

**Created**: 2026-06-13

**Status**: Draft

**Input**: Extensions to the Global Knowledge Vault after Phase A+ is validated with real use. A+ proves cross-document mastery calibration works; Post A+ adds manual vault management, external knowledge import, misconception detection, finer mastery modeling, a richer prerequisite graph, navigable graph visualization, vault-driven spaced review, and (later) multi-device sync and collaborative calibration. **Guiding principle:** do not build Post A+ layers until A+ shows measurable learning benefit; each block has its own readiness signal.

**Prerequisites**: Phase A+ (`20260618-knowledge-vault-a-plus`) complete and validated — vault has meaningful concept count, normalization works, packing reflects mastery, decay behaves as expected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Correct and curate the knowledge vault manually (Priority: P1)

As a learner whose vault contains naming errors, duplicates I want to merge, or knowledge from outside the app, I want to view and edit my vault directly so my personal knowledge model stays accurate without relying only on study sessions.

**Why this priority**: Highest UX return for lowest effort once the vault has real data; unblocks trust in the system when normalization is imperfect.

**Independent Test**: Open vault management UI; edit a concept title, merge two entries, add a manual concept with topic and initial mastery, delete an entry, and edit prerequisite list — changes persist and appear in debug view and downstream calibration.

**Acceptance Scenarios**:

1. **Given** an existing vault entry, **When** the user edits its canonical title, **Then** the new title is saved and shown everywhere that concept is referenced.
2. **Given** two vault entries the user considers the same concept, **When** they choose merge and pick which entry survives, **Then** aliases, observations, sources, prerequisites, and dependents from the removed entry are reassigned to the surviving entry without data loss.
3. **Given** the user wants to record knowledge from a book or class, **When** they add a concept manually with topic and initial mastery, **Then** it appears in the vault and participates in assessment pre-fill and packing like session-derived entries.
4. **Given** an entry with prerequisites, **When** the user adds or removes prerequisite links, **Then** the graph stays consistent (dependents updated inversely).
5. **Given** an entry the user no longer wants, **When** they delete it with confirmation, **Then** it is removed and dangling prerequisite references are cleaned up.

---

### User Story 2 — Import prior knowledge without studying in the app (Priority: P2)

As a learner who already knows material from other courses, books, or years of experience, I want to declare what I know so the app does not re-teach basics or run unnecessary assessment.

**Why this priority**: Unlocks value for returning learners and external study paths once manual vault editing exists.

**Independent Test**: Import knowledge via free text, via a document marked as already known, or via structured file; vault gains entries with appropriately high initial mastery; next document on the same topic shows shorter assessment and lighter packing.

**Acceptance Scenarios**:

1. **Given** the user pastes a description of what they know, **When** import completes, **Then** extracted concepts are added to the vault with configurable default mastery (high for self-declared knowledge).
2. **Given** the user uploads a document and marks it as already mastered, **When** processing completes, **Then** concepts are extracted into the vault without creating a study session.
3. **Given** a power user with a structured export, **When** they import CSV or JSON, **Then** entries are created or updated according to the file schema with validation errors surfaced clearly.
4. **Given** imported concepts overlap existing vault entries, **When** import runs, **Then** normalization rules merge or alias rather than creating obvious duplicates.

---

### User Story 3 — Detect and address systematic misconceptions (Priority: P2)

As a learner who repeatedly makes the same kind of mistake on a concept, I want the system to recognize that I hold a misconception (not mere ignorance) so explanations directly confront my wrong mental model.

**Why this priority**: High pedagogical value; wrong prior knowledge is more harmful than no prior knowledge.

**Independent Test**: After sufficient negative observations on one concept with a consistent wrong pattern, a misconception is recorded; the next generated explanation for that concept explicitly addresses the misconception.

**Acceptance Scenarios**:

1. **Given** at least three negative observations on the same concept with a recurring wrong choice or articulated error, **When** a session closes, **Then** a misconception record is created with description, confidence, and linked evidence.
2. **Given** an active misconception on a concept, **When** study material for that concept is generated, **Then** scaffolding instructions include the known misconception so the explanation contrasts correct vs. incorrect understanding.
3. **Given** the user later answers correctly on that concept multiple times, **When** mastery updates, **Then** the misconception can be marked resolved while history is retained.
4. **Given** insufficient evidence (fewer than three related failures), **When** session closes, **Then** no misconception is inferred (avoid false positives).

---

### User Story 4 — Finer mastery: declarative vs procedural knowledge (Priority: P3)

As a learner who can define a concept but struggles to apply it (or vice versa), I want the vault to track declarative and procedural mastery separately so the app reinforces the right skill type.

**Why this priority**: Improves calibration quality once basic mastery is trusted; depends on task-type signals from study modes.

**Independent Test**: Answer definition-style and application-style questions on the same concept; vault shows separate declarative and procedural levels; combined mastery uses a weighted blend favoring procedural.

**Acceptance Scenarios**:

1. **Given** a multiple-choice question about definitions, **When** the user responds, **Then** the observation updates declarative mastery for that concept.
2. **Given** a problem-solving or application task, **When** the user responds, **Then** the observation updates procedural mastery.
3. **Given** both mastery dimensions exist, **When** overall mastery is read for packing or assessment, **Then** a weighted combination is used (procedural weighted higher than declarative).
4. **Given** only one dimension has evidence, **When** overall mastery is computed, **Then** the system falls back gracefully without breaking calibration.

---

### User Story 5 — Smarter prerequisite graph (Priority: P3)

As a learner building knowledge across many documents, I want prerequisite relationships to stay coherent, include cross-document links, and highlight structurally important concepts so review and scaffolding prioritize what matters most.

**Why this priority**: Makes the vault graph actionable for teaching order and review priority.

**Independent Test**: Introduce a cyclic prerequisite pair — system marks co-prerequisites instead of an invalid graph; after several documents in one topic, LLM suggests new cross-document links; concepts with many dependents rank higher for review urgency.

**Acceptance Scenarios**:

1. **Given** two concepts that would form a prerequisite cycle, **When** relationships are saved, **Then** they are stored as bidirectional co-prerequisites and scaffolding treats them as mutually reinforcing.
2. **Given** vault entries from multiple documents in the same topic, **When** periodic enrichment runs, **Then** new prerequisite suggestions appear with confidence scores for user or automatic acceptance per policy.
3. **Given** a concept with high topological centrality and unstable mastery, **When** review scheduling runs, **Then** it is prioritized over peripheral concepts with similar mastery alone.

---

### User Story 6 — Explore the vault as an interactive knowledge graph (Priority: P4)

As a learner with a large vault, I want a visual graph of concepts and prerequisites so I can understand my knowledge landscape at a glance.

**Why this priority**: Valuable when vault size makes lists unwieldy; lower priority than calibration features.

**Independent Test**: Open graph view with 50+ concepts; nodes show labels and mastery; edges show prerequisites; selecting a node shows detail; pan and zoom work smoothly.

**Acceptance Scenarios**:

1. **Given** a vault with prerequisite links, **When** the user opens the knowledge graph, **Then** each concept appears as a node sized or colored by mastery and linked by prerequisite edges.
2. **Given** the user selects a node, **When** detail panel opens, **Then** title, topic, mastery, prerequisites, and misconceptions (if any) are visible.
3. **Given** a vault with fewer than a threshold of concepts, **When** the user opens graph view, **Then** a helpful empty or low-density state explains when the graph becomes useful.

---

### User Story 7 — Spaced review driven by vault decay and graph importance (Priority: P3)

As a learner who wants long-term retention, I want concepts whose mastery is decaying — especially central ones in my knowledge graph — to enter my review queue automatically.

**Why this priority**: Connects vault to retention outcomes; depends on robust spaced-repetition infrastructure.

**Independent Test**: After time passes, decaying concepts appear in review pool; central unstable concepts appear more frequently than peripheral ones with similar decay.

**Acceptance Scenarios**:

1. **Given** a concept whose mastery has decayed below the partial threshold, **When** review scheduling runs, **Then** it is added to the review pool automatically.
2. **Given** two concepts with similar decay, **When** one has much higher graph centrality, **Then** the central concept is scheduled for review sooner or more often.
3. **Given** the user completes a review session, **When** observations are recorded, **Then** vault mastery updates and the concept may leave or defer from the urgent pool.

---

### User Story 8 — Sync vault across devices (Priority: P5)

As a learner who studies on phone and desktop, I want one unified knowledge vault backed up to my account so I do not maintain separate knowledge states per device.

**Why this priority**: High adoption impact but requires backend and auth — deferred until general backend phase.

**Independent Test**: Study on device A; sign in on device B; vault matches; concurrent edits resolve per-entry without wiping the whole vault.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** vault changes on one device, **Then** changes sync to the account within a reasonable time window.
2. **Given** conflicting edits to different entries on two devices, **When** sync runs, **Then** each entry resolves independently (last write per entry wins).
3. **Given** the user is offline, **When** they study, **Then** local vault updates queue and sync when connectivity returns.

---

### User Story 9 — Improve estimates from aggregate learner patterns (Priority: P5)

As part of a user community, I want the system to use anonymized patterns from similar learners to improve initial mastery estimates for new concepts — without exposing my private data.

**Why this priority**: Requires backend, privacy design, and user mass — last phase.

**Independent Test**: With sufficient aggregate data, new users on a familiar document receive better initial mastery priors; individual vault data is not exposed to other users.

**Acceptance Scenarios**:

1. **Given** aggregate data shows a common struggle pattern, **When** a similar new learner starts the same material, **Then** initial mastery priors reflect community difficulty (conservatively).
2. **Given** privacy requirements, **When** aggregate features run, **Then** no other user can read another user's individual vault or session content.

---

### Edge Cases

- Merging vault entries that reference each other in prerequisites — merge must produce a valid acyclic or co-prerequisite structure.
- Import declares mastery for a concept that contradicts recent session observations — most recent trustworthy signal wins or user is prompted to reconcile.
- Misconception detection with sparse data — no misconception created below evidence threshold.
- BKT-style modeling with fewer than ~15 observations per concept — system continues using weighted-average mastery from A+ without pretending higher precision.
- Graph view with hundreds of nodes — performance remains usable or progressive loading applies.
- Spaced review pool grows very large — cap or prioritize by centrality and decay severity.
- Sync conflict on the same entry from two devices — last-write-wins per entry with optional conflict notice in debug UI.
- User clears vault while review queue references vault ids — queue cleans orphaned references.

## Requirements *(mandatory)*

### Functional Requirements

**Readiness gate (all blocks)**

- **FR-000**: Post A+ features MUST NOT ship until A+ readiness signals are met: vault has substantial concept count after normal use, normalization produces no obvious duplicates, repeat-document packing is noticeably shorter, decay behaves on week-old concepts, and users subjectively feel the app remembers what they know.

**Block 1 — Manual vault management**

- **FR-101**: Users MUST be able to edit the canonical title of any vault entry.
- **FR-102**: Users MUST be able to merge two entries, choosing the surviving canonical entry; the other becomes an alias with observations, sources, prerequisites, and dependents reassigned.
- **FR-103**: Users MUST be able to delete individual vault entries with confirmation.
- **FR-104**: Users MUST be able to add concepts manually with topic, title, and initial mastery.
- **FR-105**: Users MUST be able to view and edit the prerequisite list for an entry.

**Block 2 — External import**

- **FR-201**: Users MUST be able to import knowledge by pasting free text; the system extracts concepts and adds them with configurable default mastery (default high for self-declared knowledge).
- **FR-202**: Users MUST be able to upload a document marked as already known; concepts extract to vault without creating a study session.
- **FR-203**: Users MUST be able to import vault data from CSV or JSON for bulk control.
- **FR-204**: Import MUST deduplicate against existing vault entries using the same normalization principles as session-close.

**Block 3 — Misconception detection**

- **FR-301**: Observations from wrong answers MUST capture what was chosen or articulated when available.
- **FR-302**: When at least three negative observations on the same concept show a systematic pattern, the system MUST infer a misconception record with description, confidence, evidence links, and detection timestamp.
- **FR-303**: Active misconceptions MUST be included in scaffolding context when generating material for that concept.
- **FR-304**: Misconceptions MUST support a resolved state when later evidence indicates correction.

**Block 4 — Mastery refinement**

- **FR-401**: Vault entries MUST support separate declarative and procedural mastery dimensions derived from task-type signals.
- **FR-402**: Overall mastery MUST combine dimensions with procedural weighted higher than declarative.
- **FR-403**: When average observations per concept exceed ~15, the system MAY switch to Bayesian Knowledge Tracing for that concept; below that threshold, weighted-average mastery from A+ MUST remain the source of truth.

**Block 5 — Prerequisite graph**

- **FR-501**: On persist, the system MUST detect prerequisite cycles and represent conflicting pairs as bidirectional co-prerequisites rather than invalid one-way edges.
- **FR-502**: The system MUST infer prerequisite relationships between vault concepts that never appeared in the same document, with confidence scores, on a periodic trigger (e.g., after N documents in a topic).
- **FR-503**: The system MUST compute topological importance (e.g., dependent count / centrality) per concept for review and scaffolding priority.

**Block 6 — Graph UI**

- **FR-601**: Users MUST be able to open an interactive graph of vault concepts and prerequisite edges.
- **FR-602**: Nodes MUST reflect mastery visually; selecting a node MUST show concept detail.

**Block 7 — Spaced review**

- **FR-701**: Concepts whose mastery decays below the partial threshold MUST enter the review pool automatically.
- **FR-702**: Review frequency MUST factor in topological importance, not decay alone.
- **FR-703**: Review completions MUST write observations back to the vault.

**Block 8 — Multi-device sync**

- **FR-801**: Authenticated users MUST sync vault data across devices with per-entry conflict resolution.
- **FR-802**: Offline changes MUST queue and sync when online.

**Block 9 — Collaborative filtering**

- **FR-901**: With sufficient aggregate data, the system MAY improve initial mastery priors using anonymized community patterns.
- **FR-902**: Collaborative features MUST NOT expose individual user vaults to other users.

### Key Entities

- **Knowledge Vault Entry (extended)**: Canonical concept with aliases, topic, declarative/procedural mastery (or combined), sources, prerequisites, dependents, observations, optional misconceptions list.
- **Misconception**: Description of systematic wrong understanding, confidence, linked observation evidence, detection time, resolved flag.
- **Vault Observation (extended)**: Performance signal with optional wrong-answer content and optional misconception pattern label; task type for declarative vs procedural routing.
- **Co-prerequisite Link**: Bidirectional relationship when strict prerequisite ordering would cycle.
- **Inferred Prerequisite**: Suggested from-to link between vault entries with confidence score.
- **Review Queue Item**: Concept scheduled for spaced review based on decay and graph importance.
- **Import Job**: User-initiated import from text, document, or file with status and validation errors.
- **Sync Snapshot**: Per-entry version metadata for multi-device merge (future).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can correct a vault naming error or merge duplicates in under 2 minutes without developer tools.
- **SC-002**: After external import of prior knowledge, pre-packing assessment on a related new document shows at least 30% fewer questions for imported high-mastery concepts (compared to empty vault baseline).
- **SC-003**: When misconception detection triggers, users report (or A/B metrics show) improved comprehension on the targeted concept in the next session versus generic explanations.
- **SC-004**: For concepts with both dimensions tracked, packing skips or compresses declarative-only content when procedural mastery is low but declarative is high — and vice versa — in at least 80% of applicable cases.
- **SC-005**: Prerequisite cycle detection prevents invalid graphs in 100% of test cases; co-prerequisite pairs appear in scaffolding as mutually reinforcing topics.
- **SC-006**: Graph view remains navigable (pan, zoom, select) with 100 vault concepts without unacceptable lag on typical learner hardware.
- **SC-007**: Concepts decaying below partial mastery appear in review within one scheduling cycle; central concepts are scheduled at least 2× more often than peripheral peers with equal decay in simulation tests.
- **SC-008**: Multi-device sync achieves vault parity within 5 minutes of connectivity under normal conditions (when Block 8 ships).
- **SC-009**: Zero cross-user vault data leaks in collaborative filtering privacy review (when Block 9 ships).

## Assumptions

- Phase A+ is complete, deployed, and validated with real study sessions before any Post A+ block ships.
- Blocks ship incrementally in priority order (1 → 3 → 2 → 4a → 5 → 7 → 6 → 4b → 8 → 9) unless usage data dictates otherwise; the table in the source roadmap is advisory.
- Default import mastery for self-declared knowledge is high (~0.7) but user-configurable.
- Misconception inference requires at least three related negative observations to reduce false positives.
- BKT is opt-in by data sufficiency, not a global replacement for A+ mastery on day one.
- Spaced repetition infrastructure ("SM v1") must be hardened before Block 7; if not ready, Block 7 waits.
- Blocks 8 and 9 depend on a future backend/auth initiative already on the general product roadmap.
- Manual vault UI extends the existing settings/debug vault surface from A+ rather than a wholly separate product area.
- English UI strings for all new surfaces.

## Out of Scope (Post A+ document, explicit deferrals)

- Replacing A+ session-close normalization pipeline — Post A+ extends, not rewrites, A+.
- Full Obsidian-grade graph authoring (manual edge drawing) in v1 of Block 6 — read/navigate first.
- Real-time collaborative editing of vault between users.
- Medical/legal compliance certifications for stored knowledge data.

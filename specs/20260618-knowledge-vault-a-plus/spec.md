# Feature Specification: Global Knowledge Vault (Phase A+)

**Feature Branch**: `20260618-knowledge-vault-a-plus`

**Created**: 2026-06-13

**Status**: Draft

**Input**: The AI starts from zero on every document. Pre-packing assessment detects what the user knows *about the current document*, but not that they studied derivatives last week, have worked through three thermodynamics documents, or consistently fail chain rule questions. Global Knowledge Vault (GKV) is a persistent, cross-document store that models the user's knowledge state over time. It complements per-document assessment with historical context the system can use to skip scaffolding on consolidated concepts, reinforce unstable prerequisites before new material, personalize explanation depth, and surface recurring error patterns. **Guiding principle:** the vault is a calibration tool, not a verification oracle — it need not be perfect; it must be more useful than not having it.

**Prerequisites**: Unified session model (`20260609-unified-session`), pre-packing assessment (`20260611-rsvp-assessment-reposition`), source fidelity baseline (`20260613-source-fidelity`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Cross-document memory after multiple study sessions (Priority: P1)

As a learner who studies related material across several documents, I want the app to remember which concepts I have already mastered or struggled with so that a new document on the same topic does not treat me like a complete beginner.

**Why this priority**: Without cross-document memory, every upload resets personalization; this is the core value proposition of GKV.

**Independent Test**: Study two documents on the same topic; open the vault debug view; shared concepts appear as a single entry (not duplicates) with combined history.

**Acceptance Scenarios**:

1. **Given** the user completed study on document A covering "Chain rule", **When** they later study document B that also covers chain rule, **Then** the vault shows one consolidated concept entry linked to both documents.
2. **Given** the user answered assessment and practice questions across sessions, **When** they view a concept in the vault, **Then** recent performance signals are reflected in its mastery level.
3. **Given** the user has not revisited a concept for 7+ days, **When** mastery is read, **Then** the displayed level is lower than at last study (temporal decay).

---

### User Story 2 — Shorter, smarter pre-packing assessment (Priority: P1)

As a returning learner opening a third document in a familiar topic, I want the pre-packing assessment to pre-mark concepts I likely already know so the quiz focuses on what is genuinely uncertain.

**Why this priority**: Reduces friction on repeat topics while preserving user override — direct daily UX win.

**Independent Test**: After mastering concepts in two prior docs, start a third doc on the same topic; assessment UI shows presumed-known markers for high-mastery vault entries; user can contradict them.

**Acceptance Scenarios**:

1. **Given** vault entries with high historical mastery for concepts in the new document's topic, **When** pre-packing assessment loads, **Then** those concepts appear as presumed known with visible affordance to change the answer.
2. **Given** the user contradicts a presumed-known marker, **When** they submit assessment, **Then** the contradiction is recorded as a new observation in the vault.
3. **Given** an empty vault, **When** assessment loads, **Then** behavior matches today's experience (no presumed-known markers).

---

### User Story 3 — Personalized block packing and explanations (Priority: P2)

As a learner generating RSVP blocks, I want packing and block explanations calibrated to my historical mastery so mastered material is compressed or skipped and weak prerequisites get reinforcement.

**Why this priority**: Makes vault data actionable during generation, not just stored metadata.

**Independent Test**: Pack a third document after two prior sessions; output contains fewer or thinner blocks for vault-mastered concepts and mentions unstable prerequisites in generation context.

**Acceptance Scenarios**:

1. **Given** vault shows "Chain rule" as mastered, **When** a new document is packed into blocks, **Then** packing favors skipping or compressing content primarily about that concept.
2. **Given** a prerequisite concept is unstable (low mastery) but dependents are new, **When** blocks are generated, **Then** generation context prioritizes reinforcing the prerequisite before dependents.
3. **Given** no vault data for concepts in a block, **When** a block explanation is generated, **Then** default depth applies (no regression vs. current behavior).

---

### User Story 4 — Inspect and reset personal knowledge store (Priority: P2)

As a learner or developer validating the feature, I want a settings-area view of my knowledge vault so I can verify concepts, mastery, sources, and reset or export data when needed.

**Why this priority**: A+ ships no other user-facing vault UI; debug visibility is required to validate and trust the system.

**Independent Test**: Open Settings → Knowledge Vault; table lists concepts with mastery bars, topics, last seen, source count; Clear and Export work with confirmation.

**Acceptance Scenarios**:

1. **Given** at least one completed study session, **When** the user opens Knowledge Vault from settings, **Then** they see a filterable list of concepts with mastery, topic, last seen, and document count.
2. **Given** the user selects a concept, **When** detail view opens, **Then** aliases, prerequisites, and recent observations are visible.
3. **Given** the user chooses Clear vault, **When** they confirm, **Then** all vault data is removed and the UI reflects an empty state.
4. **Given** the user chooses Export JSON, **When** export completes, **Then** they receive a complete dump of vault data for offline inspection.

---

### User Story 5 — Prerequisite graph accumulates across documents (Priority: P3)

As a learner building knowledge in a domain, I want prerequisite relationships from individual documents merged into a cross-document graph so the system knows structural dependencies beyond a single upload.

**Why this priority**: Enables smarter reinforcement ordering; builds on concept normalization without extra user effort.

**Independent Test**: Study two documents sharing base concepts; vault entries show prerequisite links elevated from both documents' concept graphs.

**Acceptance Scenarios**:

1. **Given** document A states concept X requires Y, **When** both map to vault entries after session close, **Then** X's vault entry lists Y as a prerequisite.
2. **Given** conflicting prerequisite directions across documents, **When** relations are merged, **Then** both directions may exist (cycle resolution deferred); generation still proceeds.

---

### Edge Cases

- What happens when local storage is full or vault exceeds size threshold (~300KB)? System migrates to split storage pattern (metadata key + data key) without data loss.
- What happens when the user closes a session with no new concepts or observations? Vault update is a no-op; no LLM normalization call.
- What happens when LLM normalization fails or returns invalid JSON? Vault still persists observations and raw concept names; normalization can retry on next session close.
- What happens when topic tags do not exactly match between documents? Flexible substring topic matching includes related vault entries (false positives acceptable vs. missing matches).
- What happens on first document ever studied? Vault populates with document-local concept names; debug UI shows entries; no presumed-known assessment markers.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST persist a global knowledge vault locally across browser sessions, independent of any single document session.
- **FR-002**: System MUST update the vault when the user closes a study session (leaves study screen or app with saveable state), not continuously during study.
- **FR-003**: System MUST record observations from assessment signals and answered practice (MCQ, Socratic, cloze, pre-packing assessment outcomes) with typed signal strength.
- **FR-004**: System MUST compute concept mastery on read using stored base value, last update time, and time-based decay.
- **FR-005**: System MUST classify mastery into bands: unknown, partial, acquired, mastered (derived from numeric ranges).
- **FR-006**: System MUST assign 2–5 thematic topic tags to each document during existing hierarchy analysis (no extra user-facing step).
- **FR-007**: System MUST normalize new document concepts against existing vault entries in the same topic via one bounded LLM call per session close, merging duplicates and aliases.
- **FR-008**: System MUST elevate per-document prerequisite links into cross-document vault prerequisite relations when concepts map to vault entries.
- **FR-009**: System MUST inject vault context into block packing and per-block explanation generation prompts for relevant concepts.
- **FR-010**: System MUST pre-fill pre-packing assessment with presumed-known markers for vault concepts at or above high mastery threshold; user MUST be able to override.
- **FR-011**: System MUST provide a settings-accessible Knowledge Vault debug view with list, filter by topic, detail, clear-all (with confirmation), and JSON export.
- **FR-012**: System MUST NOT require manual vault editing, visual graph navigation, external import, multi-device sync, or probabilistic BKT models in Phase A+.
- **FR-013**: Normalization MUST succeed gracefully when the vault is empty (all concepts treated as new).
- **FR-014**: Vault size after first document SHOULD remain under 5KB for typical inventories.

### Key Entities

- **KnowledgeVaultEntry**: A normalized learning concept with canonical title, aliases, topic, mastery state, sources (document + original concept id), prerequisite/dependent links, and observation history.
- **VaultObservation**: A timestamped performance signal (type + raw strength) tied to a document session.
- **GlobalKnowledgeVault**: Versioned container of all entries with last-updated metadata.
- **DocumentTopicTags**: 2–5 thematic labels attached to a document session's shared layer for vault filtering.
- **NormalizationMapping**: Per-concept decision (merge, alias, or new) linking document concepts to vault entry ids.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After studying two documents on the same topic, 90%+ of clearly identical concepts appear as a single vault entry (verified via debug UI or export).
- **SC-002**: A concept unused for 7+ days shows lower displayed mastery than immediately after last successful practice (decay observable in debug UI).
- **SC-003**: Packing a third document in a familiar topic produces measurably fewer or compressed blocks for vault-mastered concepts compared to packing without vault history (same source material, same user profile).
- **SC-004**: Pre-packing assessment with populated vault reduces count of questions the user must actively answer by at least 20% for repeat-topic documents (presumed-known accepted or skipped).
- **SC-005**: Session-close vault update completes without blocking the user; normalization LLM call occurs at most once per session close.
- **SC-006**: First-document vault footprint stays under 5KB for a typical concept inventory (50–80 concepts).
- **SC-007**: Clear vault and export actions complete in under 2 seconds for vaults up to 1000 concepts.

## Assumptions

- Users study primarily in one browser profile; cross-device sync is out of scope for A+.
- Existing unified session, assessment signals, and concept inventory schemas remain the ingestion source.
- LLM normalization quality is "good enough" for deduplication within a topic; perfect ontology is not required.
- Prerequisite cycle resolution is deferred; generation prompts ignore obvious cycles heuristically.
- English is the primary language for prompts and new UI strings per project conventions.
- Temporal decay parameters (learning rate, daily decay) use fixed defaults tuned for A+; user configuration is post-A+.

## Out of Scope (Phase A+)

- Manual concept editing in vault
- Navigable visual prerequisite graph
- Bayesian Knowledge Tracing (BKT)
- Prerequisite cycle resolution
- External knowledge import
- Multi-device synchronization (requires backend)
- Declarative vs. procedural knowledge type estimation

# Feature Specification: Recall Mode

**Feature Branch**: `20260621-recall-mode`

**Created**: 2026-06-13

**Status**: Draft

**Input**: Guided active retrieval through synthesis-level open-ended questions spanning the full document (or existing concept inventory). Learners write free-form answers, receive tutor feedback with a quality rating, and results feed spaced review and downstream study modes. Cold vs warm retrieval is implicit from when the user enters the mode (before exposure, after RSVP/Slow, or days later for retention).

**Prerequisites**: Unified session with shared concept inventory and assessment signals (`20260612-mode-continuity`); SM-2 review pool (`20260620-sm2-priority-queue`); optional Knowledge Vault for mastery observations (`20260618-knowledge-vault-a-plus`).

**Related follow-up (out of scope for v1)**: Retrofit RSVP embedded socratic questions with the same tutor context pattern; section-only scope picker; voice/oral answers; cross-document comparative recall.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Synthesis retrieval with tutor feedback (Priority: P1)

As a learner who has read or studied a document, I want open-ended questions that ask me to reconstruct arguments, relate concepts, and apply ideas—not multiple choice—so I practice real retrieval and get constructive feedback on what I missed.

**Why this priority**: Delivers the core Recall experience: synthesis-level active recall with a tutor loop.

**Independent Test**: Start Recall on a document with generated questions; answer one question in a paragraph; receive critique, a model answer, and a quality label; advance to the next question until session summary.

**Acceptance Scenarios**:

1. **Given** Recall questions are ready, **When** the user opens Recall, **Then** they see one open-ended question at a time with a generous text area and progress such as "3 / 6" without a countdown timer.
2. **Given** the user submits a written answer, **When** evaluation completes, **Then** they see critique, a suggested complete answer, and a quality rating (`strong`, `adequate`, `partial`, or `insufficient`).
3. **Given** a completed answer, **When** the user continues, **Then** the next question appears until all questions are done, then a session summary is shown.
4. **Given** a question of type synthesis, relational, argumentative, or applicative, **When** displayed, **Then** the prompt requires integration beyond a single definition and references specific concepts from the document inventory.

---

### User Story 2 — Fast entry when concept inventory already exists (Priority: P1)

As a learner who finished RSVP or Slow Mode on a document, I want to start Recall without re-uploading the file or re-running concept discovery, so consolidation feels like the natural next step.

**Why this priority**: Recall sits in the recommended flow after exposure modes; friction here breaks the learning sequence.

**Independent Test**: Complete RSVP (or Slow) so shared concept inventory exists; choose Recall from mode select; questions generate from existing inventory without a second upload or full re-inventory.

**Acceptance Scenarios**:

1. **Given** shared concept inventory for the active document, **When** the user enters Recall, **Then** the system generates or reuses Recall questions without asking for the file again.
2. **Given** prior assessment signals from RSVP, Questions, or Cloze, **When** Recall questions are generated, **Then** weak concepts receive greater weight in question selection.
3. **Given** an in-progress Recall session, **When** the user returns to the document later, **Then** they can resume at the last unanswered question.

---

### User Story 3 — Results strengthen the shared learning record (Priority: P2)

As a learner completing Recall, I want my performance to update spaced review and weak-concept tracking so Cloze and Review focus on what I still struggle to synthesize.

**Why this priority**: Recall is the bridge between exposure and atomic retrieval; without downstream writes it stays an isolated quiz.

**Independent Test**: Answer Recall questions with mixed quality; verify weak concepts appear in shared assessment signals and corresponding spaced-review items are created or updated.

**Acceptance Scenarios**:

1. **Given** tutor quality `partial` or `insufficient` for a question touching concepts A and B, **When** the answer is saved, **Then** assessment signals mark A and B as recall-weak for downstream modes.
2. **Given** tutor quality `strong` or `adequate`, **When** the answer is saved, **Then** assessment signals record recall-strong for the touched concepts.
3. **Given** each evaluated answer, **When** saved, **Then** spaced-review items for the question's concepts are created or updated using a quality mapping consistent with other study modes.
4. **Given** Knowledge Vault is enabled, **When** Recall completes, **Then** vault observations of type recall-strong, recall-partial, or recall-insufficient are recorded for applicable concepts.

---

### User Story 4 — Start Recall on a document without prior modes (Priority: P2)

As a learner opening Recall first on a new document, I want the system to prepare the material and concept inventory before questions appear, so cold retrieval still works as a diagnostic entry point.

**Why this priority**: Supports "empty the mind before reading" without requiring RSVP first.

**Independent Test**: Upload a document, choose Recall as the first mode; after normalization and concept inventory, Recall questions appear without block packing or RSVP reading.

**Acceptance Scenarios**:

1. **Given** a document with no concept inventory, **When** the user starts Recall, **Then** the system normalizes the document, builds concept inventory, then generates Recall questions.
2. **Given** no source material on the document, **When** the user tries Recall, **Then** they are guided to upload material first with a clear message.
3. **Given** a short document, **When** questions are generated, **Then** the session contains a proportionally smaller set (roughly 3–4 questions) rather than a fixed long quiz.

---

### User Story 5 — Flow recommender suggests Recall at the right moment (Priority: P3)

As a learner following the recommended study path, I want Recall suggested after exposure modes when synthesis practice is valuable, so I know when to consolidate before atomic Cloze or Review.

**Why this priority**: Positions Recall in the product narrative without blocking manual mode choice.

**Independent Test**: Complete RSVP on an argumentative document; flow panel or recommender surfaces Recall as a suggested next step; user can accept or override without losing document context.

**Acceptance Scenarios**:

1. **Given** RSVP completed on a document with high argumentative density, **When** the flow panel updates, **Then** Recall appears as a recommended next step before Cloze.
2. **Given** Slow Mode completed, **When** the flow panel updates, **Then** Recall is recommended for consolidation.
3. **Given** sparse assessment signals before Cloze, **When** recommendations are computed, **Then** Recall may be suggested to seed weak-concept signals.

---

### Edge Cases

- User submits an empty or very short answer → tutor still responds; quality reflects completeness; user can revise or continue.
- Question generation fails (network, provider error) → visible error with retry; partial session not marked complete.
- Concept inventory becomes stale after document edit → system detects hash mismatch and offers regenerate vs continue with warning.
- User opens optional "view concept" sidebar → dictionary definition shown, not full source text (no answer leakage).
- Document is very long → question count caps at an upper bound (roughly 7–10) for a single session.
- User exits mid-session → progress persisted; resume restores current index and prior answers.
- No assessment signals exist → generation uses learning-goal distribution only, not weighted weak concepts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a standalone Recall study mode accessible from the mode selector for an active document session.
- **FR-002**: System MUST generate open-ended Recall questions only (no multiple-choice options) spanning the document's concept inventory, not per-block RSVP scope.
- **FR-003**: Each Recall question MUST declare a recall type: `synthesis`, `relational`, `argumentative`, or `applicative`.
- **FR-004**: Question generation MUST include at least one synthesis question and MUST distribute remaining types according to the document's primary learning goal (`understand_argument`, `memorize_facts`, `learn_procedure`, `survey_field`).
- **FR-005**: Each question MUST reference one to three concept identifiers from the shared inventory and MUST be answerable from source material attached to the question metadata.
- **FR-006**: System MUST resolve Recall entry state as: resume (in progress), bootstrap (inventory exists), generate fresh (inventory missing), or upload required (no source text).
- **FR-007**: Bootstrap path MUST NOT require re-upload or block packing when shared concept inventory already exists.
- **FR-008**: Generate-fresh path MUST run concept inventory before Recall question generation and MUST NOT require RSVP block structure.
- **FR-009**: Recall study UI MUST show one question at a time, a multi-line answer field, progress count, and MUST NOT show a countdown timer.
- **FR-010**: After answer submission, system MUST present tutor feedback: critique, suggested answer, and quality in {`strong`, `adequate`, `partial`, `insufficient`}.
- **FR-011**: Tutor evaluation MUST use question type, relevant concept definitions, and source excerpts—not question title alone.
- **FR-012**: On session completion, system MUST write assessment signals for concepts touched: weak for `partial`/`insufficient`, strong for `strong`/`adequate`.
- **FR-013**: System MUST create or update spaced-review items per concept using quality mapped from tutor feedback (strong→best, adequate→good, partial→hard, insufficient→forgot equivalent).
- **FR-014**: System MUST persist Recall session state: questions, current index, answers, tutor feedback, and generation metadata including inventory hash.
- **FR-015**: System MUST allow optional peek at concept dictionary definitions during study without exposing full source passages by default.
- **FR-016**: Flow recommender MUST suggest Recall after RSVP when argumentative density is high, after Slow Mode completion, and before Cloze when assessment signals are sparse.
- **FR-017**: v1 scope is full-document Recall only; section-scoped Recall, voice input, and cross-document comparison are explicitly out of scope.

### Key Entities

- **Recall session slice**: Per-document mode state with status (`not_started` through `complete`), question list, current index, session config (target count, included types, scope), and generation metadata.
- **Recall question**: Open prompt with recall type, linked concept identifiers, source excerpt references, optional student answer, and optional tutor feedback with quality.
- **Tutor feedback**: Critique text, suggested model answer, and discrete quality band used for spaced review and signals.
- **Assessment signal (recall)**: Extension of shared weak/strong concept tracking with recall-specific types consumed by Cloze prioritization and flow recommendations.
- **Spaced-review item (recall source)**: Review pool entry keyed by concept and recall question source, updated after each evaluated answer.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users with ready questions can complete a typical 5–7 question Recall session (submit all answers and view feedback) in under 30 minutes without timer pressure.
- **SC-002**: At least 90% of submitted answers receive full tutor feedback (critique + suggested answer + quality) on first attempt without user-visible failure.
- **SC-003**: When concept inventory already exists, 100% of bootstrap entry flows skip file re-upload and skip redundant concept inventory regeneration unless the user explicitly requests refresh.
- **SC-004**: After a Recall session with at least two `partial` or `insufficient` answers, downstream Cloze generation or prioritization surfaces at least 60% of flagged weak concepts in the first study batch (same document, same session chain).
- **SC-005**: Users who complete Recall after RSVP or Slow report continuity: no second upload prompt and visible progress in the recommended flow panel (qualitative spot-check in QA, 5/5 test scenarios pass).
- **SC-006**: Cold-entry users (Recall first) reach the first question within one normalization + inventory cycle without entering RSVP or block-reading UI.

## Assumptions

- Documents already support shared concept inventory, pedagogical metadata (including primary learning goal), and assessment signals from prior features.
- Spaced-review pool and ingestion helpers from SM-2 priority queue are available and extensible with a new source type for recall questions.
- An AI provider is configured for question generation and tutor evaluation; failures surface user-visible retry, consistent with other modes.
- English is the UI and prompt language for all new Recall strings.
- Full-document scope is sufficient for v1; learners who need chapter-only practice will use a future section-scope extension.
- RSVP embedded socratic improvements share patterns with Recall but ship as a separate follow-up to keep Recall v1 scope bounded.
- Question count scales with document size: roughly 3–4 (tiny/short), 5–7 (medium), 7–10 (long).

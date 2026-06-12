# Feature Specification: RSVP Pre-Generation Assessment Reliability

**Feature Branch**: `20260616-fix-pregen-assessment`

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "Fix RSVP fast mode so pre-generation knowledge check always appears and works; no post-generation assessment — pregeneration only."

**Prerrequisito**: `20260611-rsvp-assessment-reposition`, `20260612-rsvp-assessment-questions-parity`

**Prioridad**: P0

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Knowledge check before blocks (Priority: P1)

A learner uploads study material in RSVP mode, configures question defaults, and taps **Generate blocks**. After the system extracts the concept inventory, they must see a **document knowledge check** (test + socratic questions matching their session settings) **before** any block list is shown. Completing or skipping this step leads to block packing and the block editor.

**Why this priority**: This is the core value of pre-packing assessment — personalising block structure from prior knowledge. Without it, RSVP behaves as if assessment never existed.

**Independent Test**: Upload a short PDF in RSVP → Generate blocks → verify the knowledge-check screen appears with at least one question and a visible skip control before the blocks confirmation screen.

**Acceptance Scenarios**:

1. **Given** a new RSVP session with a valid document and API access, **When** the user generates blocks, **Then** a pre-generation knowledge check is presented after concept inventory and before the block editor.
2. **Given** the knowledge check is shown, **When** the user answers all questions, **Then** block packing proceeds using the resulting knowledge profile (or uniform packing if profile yields no mastered concepts).
3. **Given** default session question settings (e.g. 2 test + 1 socratic), **When** the knowledge check loads, **Then** the question count matches those settings (within the configured safety ceiling).

---

### User Story 2 - Explicit skip without silent fallback (Priority: P1)

A learner who does not want the knowledge check can skip it deliberately. Skipping must be a visible, intentional action — not an automatic invisible bypass when generation fails.

**Why this priority**: Users must retain control; silent skips destroy trust and make the feature appear broken.

**Independent Test**: Start generate flow → tap **Skip assessment** → verify blocks editor opens and session metadata records that assessment was skipped.

**Acceptance Scenarios**:

1. **Given** the pre-generation knowledge check is visible, **When** the user chooses skip, **Then** block packing runs without a knowledge profile and the block editor appears.
2. **Given** question generation fails (e.g. network or model error), **When** the failure occurs, **Then** the user sees a clear message and can retry or skip explicitly — the system must not proceed to blocks without user acknowledgement.
3. **Given** the user skipped assessment, **When** they later confirm blocks and reach session ready, **Then** no second "initial assessment" prompt appears.

---

### User Story 3 - No post-generation assessment in RSVP (Priority: P2)

A learner who completes block confirmation must go directly to **Session ready** and start studying. The legacy optional assessment that appeared **after** block generation must not be offered in RSVP when pre-generation assessment is enabled.

**Why this priority**: The product owner explicitly wants assessment only **before** block packing, not duplicated afterward.

**Independent Test**: Complete full RSVP create flow (with or without taking the knowledge check) → confirm blocks → verify only "Session ready" appears, never "Initial Assessment (optional)".

**Acceptance Scenarios**:

1. **Given** pre-generation assessment is enabled for RSVP, **When** the user confirms the block list, **Then** they are taken to session ready without a post-generation assessment choice screen.
2. **Given** a completed RSVP session, **When** the user starts studying, **Then** per-block study questions behave as today (unchanged); only the removed step is the session-level post-generation assessment.

---

### User Story 4 - Consistent experience with Questions UI (Priority: P2)

The pre-generation knowledge check uses the same question presentation learners already know from study mode: formatted stems, A–D test options with feedback, and open socratic prompts — not a separate minimal quiz UI.

**Why this priority**: Parity was specified in the prior feature; this fix restores that experience when the flow actually runs.

**Independent Test**: Reach knowledge check → verify test questions render with options and feedback; socratic items accept free-text answers.

**Acceptance Scenarios**:

1. **Given** the knowledge check runner is active, **When** a test question is shown, **Then** it displays with the same interaction pattern as in-block test questions (options, feedback after answer).
2. **Given** a socratic item in the knowledge check, **When** the user submits an answer, **Then** progression continues toward evaluation and packing.

---

### Edge Cases

- **Question generation slow**: User sees loading state on the knowledge-check screen; skip remains available once the screen is shown.
- **Question generation fails**: User sees error + retry or skip; no silent jump to block editor.
- **All concepts mastered in profile**: Flow continues to packing; results may show fewer blocks; user still passed through the knowledge check.
- **Resume existing RSVP session**: No pre-generation assessment (session already created); user lands on session ready or in-progress study — unchanged.
- **Import existing block index**: Out of scope for v1 — import bypasses concept inventory and pre-generation assessment by design; documented as known limitation.
- **Offline pack**: Unchanged — offline entry skips online assessment.
- **Questions-only mode**: Unaffected unless it shares the same broken prefetch path; RSVP is primary scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In RSVP create flow, the system MUST present a pre-generation knowledge check after concept inventory extraction and before displaying the block editor.
- **FR-002**: The knowledge check MUST use the learner's configured test and socratic question counts from the create form (subject to the existing safety ceiling).
- **FR-003**: The knowledge check MUST offer a clearly visible skip action at all times while it is active.
- **FR-004**: If knowledge-check question generation fails, the system MUST NOT silently proceed to block packing; it MUST surface the failure and require explicit retry or skip.
- **FR-005**: Background prefetch of assessment questions MUST use the same question-count and material inputs as the visible knowledge check, so a failed prefetch cannot poison the learner-facing step.
- **FR-006**: When pre-generation assessment is enabled, the system MUST NOT show the legacy post-generation "Initial Assessment (optional)" screen after block confirmation in RSVP.
- **FR-007**: Completing the knowledge check MUST produce a knowledge profile (or explicit skip metadata) that is persisted into session metadata when blocks are confirmed.
- **FR-008**: Skipping the knowledge check MUST record `assessment_skipped` (or equivalent) so downstream packing and analytics distinguish skip from complete.
- **FR-009**: The knowledge check UI MUST match the study-mode question experience (test + socratic screens), not a deprecated standalone MCQ screen.
- **FR-010**: Slow Mode, Cloze Mode, and Questions-only create flows MUST NOT regress; scope is RSVP pre-generation reliability and post-generation removal.

### Key Entities

- **Concept inventory**: Full set of concepts and relations extracted from uploaded material before packing; input to knowledge-check generation.
- **Knowledge check (pre-generation)**: Short question set covering inventory concepts; output feeds evaluation.
- **Knowledge profile**: Per-concept mastery summary used to constrain block packing; may reduce active block count.
- **Assessment skip record**: Session metadata flag indicating the learner opted out of pre-generation assessment.
- **Block editor**: Screen where the learner reviews and confirms the packed block list before session ready.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In manual QA across 5 consecutive RSVP generate attempts with valid API access, the pre-generation knowledge check appears before the block editor in 100% of runs.
- **SC-002**: Zero silent bypasses — no generate flow reaches the block editor without either completing the knowledge check or an explicit skip/error acknowledgement.
- **SC-003**: After block confirmation, 0% of RSVP sessions show the legacy post-generation initial assessment screen when pre-generation is enabled.
- **SC-004**: Learners who skip can reach session ready in under 30 seconds after inventory completes (excluding LLM packing time).
- **SC-005**: Support burden: internal "assessment missing in RSVP" reports drop to zero after release.

## Assumptions

- Pre-generation assessment remains feature-flagged on for RSVP (`ASSESSMENT_BEFORE_PACKING` equivalent).
- Question parity with study mode remains the desired UX (per `20260612-rsvp-assessment-questions-parity`).
- Import-existing-index is an advanced shortcut that intentionally skips inventory and assessment; not part of this fix.
- Resume and offline flows are unchanged.
- API key and network are available for the happy-path QA scenarios.
- The safety ceiling on total assessment questions (currently 7) remains acceptable unless product decides otherwise in a follow-up.

## Dependencies

- `20260611-rsvp-assessment-reposition` — inventory → assessment → pack orchestration
- `20260612-rsvp-assessment-questions-parity` — Questions-format generation and runner UI

## Out of Scope

- Re-introducing or improving post-generation / post-confirmation session assessment in RSVP
- Adding pre-generation assessment to import-index or resume paths
- Changing assessment behaviour in Slow, Cloze, or Questions-only modes beyond regression prevention
- Changing mastery thresholds, parallel packing UX, or results screen copy

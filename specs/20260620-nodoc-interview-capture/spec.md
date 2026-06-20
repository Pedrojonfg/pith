# Feature Specification: No-Document Interview Capture Sessions

**Feature Branch**: `20260620-nodoc-interview-capture`

**Created**: 2026-06-20

**Status**: Draft

**Input**: Guided Socratic/Feynman-style interview for study material without an uploadable file. User explains what they learned; transcript becomes session source text structured (never invented) into the same shared artifacts as upload-origin sessions.

**Depends on**: Unified session store, document preparation pipeline, source fidelity discipline, mode taxonomy, assessment signals, concept registry identity resolution.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Start a session without a file (Priority: P1)

As a learner who read a book, attended a talk, or watched a film with no digital file, I want a secondary path from session creation that lets me explain what I learned so I can still build a study session in Pith.

**Why this priority**: Unblocks the core use case — session creation without upload.

**Independent Test**: From create-session start, choose "I don't have a file"; see the first interview question instantly (offline-capable); type an answer and continue.

**Acceptance Scenarios**:

1. **Given** the user is on create-session start, **When** they choose the no-file path, **Then** the interview capture screen opens with the first fixed opening question visible with zero network latency.
2. **Given** the user is offline, **When** they open the interview path, **Then** the opening question still renders.
3. **Given** file upload remains the default, **When** create-session start loads, **Then** upload controls are primary and the no-file path is clearly secondary.

---

### User Story 2 — Responsive guided interview (Priority: P1)

As a learner explaining material in my own words, I want follow-up questions that probe gaps and applications so the capture feels like a tutor conversation, not a static form.

**Why this priority**: Delivers adaptive depth beyond the fixed opener.

**Independent Test**: Answer opening question; wait for one LLM-generated follow-up; answer again; verify transcript stores all turns with question source metadata.

**Acceptance Scenarios**:

1. **Given** at least one answered turn, **When** the user submits an answer, **Then** the system shows the existing generating-screen pattern while fetching the next question.
2. **Given** a follow-up LLM call, **When** the model responds, **Then** exactly one new question is appended targeting gaps, unclear claims, or application — not generic restatement.
3. **Given** a configured round cap (default 4 dynamic follow-ups), **When** the cap is reached, **Then** the interview auto-closes and proceeds to synthesis without extra user action.
4. **Given** fewer than 2 answered turns, **When** the user tries to finish, **Then** they are prompted to answer at least one follow-up before synthesis.
5. **Given** 2 or more answered turns, **When** the user chooses to finish early, **Then** synthesis may proceed.

---

### User Story 3 — Fidelity-constrained synthesis into shared pipeline (Priority: P1)

As a learner, I want my explained material converted into structured study artifacts without the system inventing facts I never said, so vault content stays earned through my recall.

**Why this priority**: Preserves Pith's source-fidelity discipline for the new origin type.

**Independent Test**: Complete a 3-turn interview; run synthesis; verify `rawMarkdown` and concept inventory contain only claims present in the transcript (fidelity validation passes).

**Acceptance Scenarios**:

1. **Given** a completed interview transcript, **When** synthesis runs, **Then** `shared.rawMarkdown` is populated from the transcript using the same field upload sessions use.
2. **Given** synthesis output, **When** validated against the concatenated transcript, **Then** no claim absent from user answers is introduced.
3. **Given** extracted concepts, **When** added to inventory, **Then** all start at gray maturity — none appear green immediately.
4. **Given** synthesis completes, **When** the user reaches mode select, **Then** Cloze and Recall are available; RSVP and Slow Mode are hidden.

---

### User Story 4 — Unprompted articulation strengthens assessment signals (Priority: P2)

As a learner who articulated concepts without seeing source text, I want that genuine retrieval evidence recorded so weak concepts I demonstrated may promote faster through existing identity-resolution paths.

**Why this priority**: Rewards authentic recall at capture time; not required for end-to-end function.

**Independent Test**: Articulate a named concept in an answer; after synthesis, verify an assessment signal with distinguishable unprompted origin exists and nudges promotion toward yellow.

**Acceptance Scenarios**:

1. **Given** the user names or explains a concept unprompted in an answer, **When** synthesis maps concepts, **Then** an assessment signal is recorded via the existing signal mechanism with origin distinguishable from tested-against-material signals.
2. **Given** such a signal, **When** identity resolution runs, **Then** it may accelerate gray → yellow using existing promotion rules — no bespoke bypass.

---

### Edge Cases

- LLM parse failure on follow-up → categorized error (TRUNCATED / PARSE_ERROR / SCHEMA_ERROR) with visible retry, not silent failure.
- User dismisses mid-interview → partial transcript persisted; resume restores state.
- Round cap reached with only 1 answered turn (shouldn't happen if R11 enforced) → synthesis blocked until minimum met.
- Very short answers → follow-up may ask for elaboration; synthesis still constrained to what was said.
- Upload-origin sessions → zero regression in DPP, mode-bootstrap, and mode select.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support `shared.uploadMeta.originalFormat = "interview"` as a session origin alongside pdf/html/txt/md.
- **FR-002**: System MUST store `shared.interviewTranscript` as an ordered array of turns `{ turn, question, questionSource, answer, answeredAt }` where `questionSource` is `fixed` or `generated`.
- **FR-003**: System MUST expose a secondary entry from create-session start ("I don't have a file for this") leading to interview capture; upload remains default.
- **FR-004**: Opening question(s) MUST come from a static curated bank with no LLM or network dependency.
- **FR-005**: Each dynamic follow-up MUST use exactly one LLM call receiving the full transcript; MUST use categorized parse-error handling with retry.
- **FR-006**: Maximum dynamic follow-up rounds MUST be configurable via feature flag (default 4); reaching cap auto-proceeds to synthesis.
- **FR-007**: Follow-up wait and synthesis MUST reuse the existing generating-screen UX pattern.
- **FR-008**: Synthesis MUST convert transcript to `shared.rawMarkdown` and concept inventory without introducing claims absent from the transcript; MUST use fidelity validation with transcript as source.
- **FR-009**: Concepts from interview sessions MUST enter inventory at gray maturity only.
- **FR-010**: For interview-origin sessions, mode select MUST hide RSVP and Slow Mode; Cloze and Recall MUST remain visible.
- **FR-011**: Synthesis MUST require at least 2 answered turns; finishing after only the opener is blocked with guidance.
- **FR-012**: Capture UI MUST work with typed input only (no voice dependency).
- **FR-013**: System MUST NOT support RSVP, Slow Mode, or Questions mode for interview-origin sessions in v1.
- **FR-014**: System MUST NOT allow retroactive conversion between upload-origin and interview-origin sessions.
- **FR-015**: System MUST NOT support adding interview turns after synthesis in v1 (transcript closed post-synthesis).
- **FR-016**: System MAY record assessment signals for unprompted articulation at synthesis time with origin distinguishable from material-tested signals.

### Key Entities

- **InterviewTurn**: Single Q/A exchange with source metadata and timestamp.
- **InterviewTranscript**: Ordered list of turns; immutable source for fidelity validation after capture completes.
- **InterviewSessionOrigin**: Marker via uploadMeta.originalFormat; gates mode availability.
- **SynthesisOutput**: rawMarkdown + concept inventory derived strictly from transcript.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Opening question appears in under 100ms with no network (instant static render).
- **SC-002**: 100% of synthesized sessions pass fidelity validation — zero invented claims in spot-checks.
- **SC-003**: Users can complete a minimal 2-turn interview and reach mode select with Cloze/Recall available.
- **SC-004**: Follow-up count never exceeds configured cap.
- **SC-005**: Upload-origin session flows show no regression in existing cursor-tests for DPP and mode-bootstrap.
- **SC-006**: LLM failures on follow-up show categorized errors with working retry path.

## Assumptions

- Opening-question bank is keyed by study language (`STUDY_LANG_OPTIONS` values); English strings provided for all supported languages in v1.
- `validateBlockFidelity` accepts arbitrary source text via its `chunk` parameter; interview synthesis uses a thin wrapper passing concatenated transcript as source.
- Assessment signals gain optional `signalOrigin: 'unprompted_articulation' | 'tested_recall'` (default `tested_recall`) to distinguish capture-time articulation.
- Transcript is closed permanently after first synthesis in v1; no incremental re-synthesis.
- Session name for interview origin defaults to user-provided title or "Interview session".
- Interview-origin sessions skip RSVP block packing and Slow phase-0 pregeneration in DPP tiers that assume linear source text.

## Out of Scope (v1)

- LLM research or gap-filling beyond user-stated content.
- RSVP, Slow Mode, Questions mode for interview origin.
- Voice-to-text input pipeline.
- Post-synthesis interview extension or re-synthesis.
- Bidirectional conversion with upload-origin sessions.

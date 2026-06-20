# Feature Specification: RSVP Block Generation — Pedagogical Wiring, Fidelity Toggle & Structured Headers

**Feature Branch**: `20260620-rsvp-generation-pedagogy-hardening`  
**Created**: 2026-06-20  
**Status**: Ready for implementation  
**Input**: Pedagogical audit of RSVP block generation pipeline — wire existing prompt machinery, restore fidelity toggle, harden question counts, clarify analogy rules, add structured section headers.

## User Scenarios & Testing

### User Story 1 — Reliable question counts (Priority: P1)

When a block is generated, the student receives the requested number of test and socratic questions, or a single automatic retry attempts to fix shortfalls.

**Why this priority**: Silent under-delivery breaks study flow and assessment integrity.

**Independent Test**: Mock a short question response; confirm one retry fires and `question_count_status` is set if still short.

**Acceptance Scenarios**:

1. **Given** `n_test=2` and model returns 1 test question, **When** generation completes, **Then** exactly one retry runs with explicit count instruction.
2. **Given** retry still under-delivers, **When** block is stored, **Then** `question_count_status: 'short'` is attached and study is not blocked.

---

### User Story 2 — Knowledge profile drives block config (Priority: P2)

Pre-packing assessment profile (`learning_goal` on block index entries) populates `_config.gap_focus` and `_config.explanation_profile` before study.

**Why this priority**: Pack LLM already sets `learning_goal`; generation prompts already support gap/brief profiles but were never wired.

**Independent Test**: Pack with profile producing `prerequisite_review` and `relational` blocks; confirm `_config` reflects `brief_deep` / `relational_compressed`.

**Acceptance Scenarios**:

1. **Given** a block with `learning_goal: 'prerequisite_review'`, **When** blocks are packed, **Then** `_config` has `explanation_profile: 'brief_deep'` and gap entries with `reason: 'prerequisite_review'`.
2. **Given** no knowledge profile, **When** blocks are packed, **Then** behavior is unchanged from today.
3. **Given** user manually edits block config in blocks list, **When** session starts, **Then** manual values are not overwritten.

---

### User Story 3 — Source fidelity mode in Settings (Priority: P2)

User chooses Standard vs Strict source fidelity globally in Settings; choice persists and affects generation.

**Why this priority**: Strict pipeline exists but was unreachable after UI cleanup.

**Independent Test**: Toggle Strict, generate block, confirm `resolveSourceFidelityStrictForSession()` returns true.

**Acceptance Scenarios**:

1. **Given** Strict selected in Settings, **When** user reloads app, **Then** Strict remains selected.
2. **Given** Standard (default), **When** new user opens Settings, **Then** Standard is selected.

---

### User Story 4 — Structured RSVP section headers (Priority: P3)

Development blocks use visible bold section headers from a fixed pool; Overview/Key-terms blocks unchanged.

**Why this priority**: RSVP reader already pauses on bold; headers signpost structure without new schema fields.

**Independent Test**: Generate development block; confirm 2–4 pool headers, OPENING first, IMPLICATION last.

**Acceptance Scenarios**:

1. **Given** a development block, **When** explanation is generated, **Then** headers are standalone `**Header**` lines from the pool only.
2. **Given** block N>1, **When** connection question hook is extracted, **Then** first content paragraph is used, not a header line.

---

### User Story 5 — Analogy arbitration (Priority: P3)

Model receives explicit Rule D resolving tension between pedagogical examples and source fidelity.

**Independent Test**: `SOURCE_FIDELITY_RULES` includes Rule D text; merged into all fidelity prompts.

### Edge Cases

- Pack returns no `learning_goal` → default `_config` unchanged.
- Gap focus with objects `{ concept_id, reason }` must format correctly in prompts.
- Header validation must not false-fail paragraph enforcement.
- Combined gap + count shortfall → single retry only.

## Requirements

### Functional Requirements

- **FR-001 (R3)**: On question under-delivery, retry `deepSeekGenerateBlockQuestions` exactly once with strengthened count/gap instructions.
- **FR-002 (R3)**: If still short, attach `question_count_status: 'short'` and actual vs requested counts; never block study.
- **FR-003 (R1)**: Pure `mapKnowledgeProfileToBlockConfig(blockIndexEntry)` maps `learning_goal` → `gap_focus` / `explanation_profile`.
- **FR-004 (R1)**: Add `relational_compressed` explanation profile (~40% word budget, relational focus).
- **FR-005 (R1)**: Apply profile mapping after pack; preserve manual per-block edits (initial values only).
- **FR-006 (R2)**: Settings control Standard/Strict with plain-language labels; persist via localStorage.
- **FR-007 (R4)**: Insert Rule D into `SOURCE_FIDELITY_RULES` after the omit-if-no-example bullet.
- **FR-008 (R5)**: Structured headers for development blocks only; 50-phrase pool; tiered word budgets.
- **FR-009 (R5)**: Update paragraph validation and connection-hook extraction for header format.
- **FR-010**: PWA version bump when shipping HTML/JS changes.

### Key Entities

- **Block `_config`**: `n_test`, `n_socratic`, `explanation_profile`, `gap_focus`, `include_connection_questions`.
- **Block index entry**: `learning_goal`, `concept_ids`, optional `_initial_block_config` from profile mapping.
- **Question count diagnostics**: `question_count_status`, actual/requested counts on generated block.

## Success Criteria

- **SC-001**: 100% of under-count first attempts trigger exactly one retry (observable in tests).
- **SC-002**: Sessions without knowledge profile produce identical `_config` defaults as before.
- **SC-003**: Strict mode reachable from Settings and persists across reload.
- **SC-004**: Development blocks show 2–4 pool headers; non-development blocks unchanged.
- **SC-005**: Connection hooks never equal a bold header phrase alone.

## Assumptions

- `learning_goal` field names match pack LLM output (`prerequisite_review`, `relational`).
- `applyAssessmentResults` remains dead for RSVP; R1 uses pre-packing profile only.
- Header compliance is warn-only (no generation retry).
- Per-session fidelity override UI remains out of scope.

## Implementation Rules (R1–R5)

See root audit document `20260620-rsvp-generation-pedagogy-hardening_spec.md` for detailed R1–R5 citations, header pool (50 phrases), word budgets, and ordered implementation sequence (R3 → R4 → R2 → R1 → R5).

## Non-goals

- Revive `applyAssessmentResults` for RSVP.
- Bloom quotas, document-wide difficulty ramp, per-session fidelity UI.
- Headers in Slow/Cloze/Recall/Questions modes.
- Retroactive regeneration of existing sessions.

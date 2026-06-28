# Feature Specification: Threshold Concepts & Generative Pedagogy

**Feature Branch**: `20260703-threshold-generative-pedagogy`  
**Created**: 2026-06-28  
**Status**: Draft  
**Input**: Tag threshold (foundational) concepts via heuristic+LLM mix; bias RSVP generation/scheduling; apply generative pedagogy (self-explanation, elaborative interrogation) to Socratic, Recall, Slow, Review; light gating outside RSVP where existing flows allow.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Foundational concepts surface first in RSVP (Priority: P1)

As a learner starting a document, I want gateway concepts taught earlier with richer explanations so later material assimilates into a stable schema.

**Why this priority**: Core spine for first-principles sequencing; RSVP is the primary exposure path.

**Independent Test**: Document with known prerequisite graph; threshold-tagged concepts appear in earlier blocks with `threshold_expanded` profile, never `brief_deep`/`relational_compressed`.

**Acceptance Scenarios**:

1. **Given** a concept tagged `isThreshold: true`, **When** blocks are packed, **Then** its block ranks before dependent application blocks.
2. **Given** assessment marks a block "strong", **When** the block contains a threshold concept, **Then** explanation profile stays expanded (not compressed).
3. **Given** source fidelity is not strict, **When** a threshold block generates, **Then** the explanation may include a pedagogical example even if not verbatim in source.

---

### User Story 2 — Socratic and open-ended modes prompt self-explanation (Priority: P1)

As a learner in Socratic, Recall, Slow, or Review flows, I want questions that ask *why* and tutors that evaluate causal explanations—not only definitions.

**Why this priority**: Highest-evidence generative technique; aligns with existing Socratic/Recall architecture.

**Independent Test**: Generated Socratic stems include elaborative-interrogation patterns; tutors reference mechanism gaps in critique.

**Acceptance Scenarios**:

1. **Given** block generation with `n_socratic > 0`, **When** questions are produced, **Then** at least one Socratic stem uses a "why / in your own words" pattern.
2. **Given** a Recall answer, **When** the tutor responds, **Then** critique names missing causal links, not only factual omissions.
3. **Given** Cloze or MCQ-only paths, **When** studied, **Then** generative stem rules are not injected.

---

### User Story 3 — Threshold concepts need stronger comprehension before SM-2 (Priority: P2)

As a learner, threshold concepts should not enter spaced repetition until I demonstrate adequate understanding (not merely partial recall).

**Why this priority**: Extends existing comprehension gate with minimal new UI.

**Independent Test**: Threshold conceptual concept blocks SM-2 after MCQ-only success; clears after Recall `adequate+` or Socratic quality pass.

**Acceptance Scenarios**:

1. **Given** `isThreshold` conceptual concept without confirmation, **When** MCQ answered correctly, **Then** SM-2 item is not created.
2. **Given** Recall quality `partial` for a threshold concept, **When** ingestion runs, **Then** `comprehensionConfirmed` remains false.
3. **Given** Recall quality `adequate` for a threshold concept, **When** ingestion runs, **Then** comprehension is confirmed.

---

### User Story 4 — Slow Phase 0 uses careful generative orientation (Priority: P3)

As a learner in Slow Phase 0, orientation questions may invite explanation without overwhelming novices.

**Why this priority**: Phase 0 runs before deep reading; prompts must stay scaffolded.

**Independent Test**: Phase 0 generation prompt includes generative rules with scaffold clause for low prior knowledge.

**Acceptance Scenarios**:

1. **Given** Phase 0 generation, **When** prequestions are produced, **Then** at least one invites causal or integrative thinking with optional scaffold hint.

---

### Edge Cases

- Inventory too small (< 3 concepts) → threshold fraction yields 0 tags; heuristic may tag 0.
- All concepts score equally → top ceil(n × fraction) by score tie-break order id.
- LLM threshold batch fails → keep heuristic-only flags.
- Strict source fidelity → no synthetic examples in threshold blocks.
- Guide chat during RSVP → excluded from generative pedagogy rules.
- Feynman mode → out of scope.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Inventory entries MUST support `isThreshold: boolean` and optional `thresholdScore: number` (0–1).
- **FR-002**: System MUST tag ~`THRESHOLD_TARGET_FRACTION` of inventory as threshold using heuristic ranking plus optional single batched LLM confirmation per document.
- **FR-003**: RSVP block packing and split prompts MUST prioritize blocks covering threshold concepts before dependent blocks.
- **FR-004**: Blocks covering threshold concepts MUST use `explanation_profile: threshold_expanded` (never `brief_deep` or `relational_compressed`).
- **FR-005**: `threshold_expanded` explanations MUST allow higher word budget and pedagogical examples; synthetic examples ONLY when source fidelity strict mode is off.
- **FR-006**: RSVP for threshold blocks MUST apply a lower effective WPM cap (≤ 250) during reading when user WPM exceeds cap.
- **FR-007**: Socratic question generation and regeneration prompts MUST include generative pedagogy stem rules.
- **FR-008**: `deepSeekSocraticTutor` and `deepSeekRecallTutor` MUST evaluate self-explanation / causal reasoning in critique.
- **FR-009**: Recall question generation MUST bias toward elaborative interrogation for conceptual/threshold concepts.
- **FR-010**: Slow Phase 0 and Phase 3 retrieval/devil's advocate generation MUST include careful generative rules (scaffolded).
- **FR-011**: Review-generated Socratic items MUST use the same generative stem rules.
- **FR-012**: MCQ (`type: test`), Cloze pipeline, and guide chat MUST NOT receive generative stem rules.
- **FR-013**: Comprehension gate MUST require `adequate` or better Recall quality (or existing Socratic pass) for `isThreshold` conceptual concepts before SM-2; `partial` is insufficient.
- **FR-014**: RSVP paths MUST NOT add new progression gating beyond generation/scheduling (FR-003–FR-006).

### Key Entities

- **ThresholdConceptFlag**: `isThreshold`, `thresholdScore`, `thresholdSource: heuristic | llm | both`
- **BlockThresholdConfig**: `explanation_profile`, optional `rsvp_wpm_cap`, `is_threshold_block`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In test fixtures, 100% of threshold concepts appear in earlier block positions than all their direct dependents.
- **SC-002**: 100% of threshold blocks resist assessment-driven compression profiles in unit tests.
- **SC-003**: Socratic generation prompt contract tests detect generative stem rule presence.
- **SC-004**: Threshold conceptual concepts do not create SM-2 items after MCQ-only success in gate tests.

## Assumptions

- **THRESHOLD_TARGET_FRACTION** defaults to **0.12** (12% of inventory, minimum 1 when inventory ≥ 5, else 0).
- Heuristic scores dependency count, `concept_type`, and prerequisite depth; LLM confirms borderline top candidates only.
- Gating reuses comprehension gate infrastructure; no new screens in v1.
- Guide chat and Feynman mode are explicitly out of scope.
- Generative rules are prompt-level changes, not new study screens.

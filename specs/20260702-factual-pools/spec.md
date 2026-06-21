# Feature Specification: Factual Question Stem Pools and Distractor Sourcing

**Feature Branch**: `20260702-factual-pools`  
**Created**: 2026-06-21  
**Status**: Draft  
**Input**: Patch to pedagogical-principles R1 — stem pools, inventory-sourced distractors, batched validation  
**Amends**: `20260701-pedagogical-principles` R1 only; R2–R6 untouched

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Varied factual stems (Priority: P1)

As a learner answering factual MCQs in a session, I want question phrasing to rotate across many templates so consecutive items do not feel copy-pasted.

**Why this priority**: Pure data/logic; no LLM dependency; immediate UX improvement.

**Independent Test**: Same category, multiple questions in one session → no repeated stem template until pool exhausted.

**Acceptance Scenarios**:

1. **Given** two date factual questions in one session, **When** stems are generated, **Then** they use different phrasing variants from the date pool.
2. **Given** the pool is exhausted, **When** another question is generated, **Then** repetition is allowed without error.

---

### User Story 2 — Document-grounded distractors (Priority: P1)

As a learner, I want wrong MCQ options sourced from other facts in the same document so distractors are plausible but not invented.

**Why this priority**: Core safety fix for R1; prevents trivial or double-correct options.

**Independent Test**: Synthetic inventory with km and kg values never cross-matches units.

**Acceptance Scenarios**:

1. **Given** a number-with-unit concept in km, **When** distractors are sourced, **Then** only other km values from the inventory are candidates.
2. **Given** fewer than 3 viable same-subtype candidates, **When** templated generation runs, **Then** that concept falls back to full LLM generation.

---

### User Story 3 — Batched distractor validation (Priority: P2)

As a system operator, I want one cheap batched LLM call per block to filter bad distractors so cost stays low while quality is guarded.

**Why this priority**: Depends on sourcing; replaces "zero LLM" with honest `template_validated` path.

**Independent Test**: Block with N templated factual items triggers exactly one validation call.

**Acceptance Scenarios**:

1. **Given** a sourced distractor that is also correct, **When** validation runs, **Then** it is rejected with a logged reason.
2. **Given** validation leaves fewer than 3 approved distractors, **When** building the MCQ, **Then** that concept escalates to full LLM generation.

---

### User Story 4 — Definitions and enumerations unchanged (Priority: P2)

As a learner studying definition-style facts, I continue to receive LLM-generated questions because templated distractor sourcing cannot produce coherent wrong definitions.

**Independent Test**: Definition/enumeration concepts never enter the templated path.

---

### Edge Cases

- Short document with one date → LLM fallback for that concept only.
- Proper nouns without kind metadata → unfiltered proper-noun pool (validation backstop).
- Pool exhaustion mid-session → allow stem repetition.
- Missing DeepSeek key → validation failure falls back per concept to LLM or skips templated path.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Templated factual generation MUST apply only to date, number-with-unit, and proper-noun subtypes.
- **FR-002**: Definition and enumeration factual concepts MUST remain on full LLM generation path.
- **FR-003**: Each eligible category MUST have 8–12 language-aware stem variants (English, Spanish).
- **FR-004**: Stem rotation MUST avoid repeating the same variant per category within a session until pool exhausted.
- **FR-005**: Distractors MUST be sourced from sibling inventory entries of the same subtype; never invented.
- **FR-006**: Number-with-unit distractors MUST match the same normalized unit type.
- **FR-007**: Concepts with fewer than 3 viable sourced distractors MUST fall back to LLM per concept.
- **FR-008**: Validation MUST batch all templated items for a block in one LLM call.
- **FR-009**: Validation MUST reject distractors that are ambiguous, also correct, or implausibly wrong.
- **FR-010**: Post-validation count below 3 approved distractors MUST trigger LLM fallback for that concept.
- **FR-011**: `generation_method` MUST distinguish `template_validated` vs `llm` (legacy `template` reserved).
- **FR-012**: `questionClass` classification (R1.1) MUST remain unchanged.

### Key Entities

- **FactualStemPool**: category → language → phrase variants.
- **SessionStemRotationState**: session-scoped used indices per category.
- **TemplatedFactualItem**: `{ fact, question, answer, candidateDistractors, category, conceptId }`.
- **ValidationResult**: `{ fact, approvedDistractors, rejected: [{ candidate, reason }] }`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: No repeated stem variant per category within a session until pool exhausted (automated test).
- **SC-002**: Zero cross-unit distractors in unit-matching test suite.
- **SC-003**: Exactly one validation LLM call per block regardless of templated item count.
- **SC-004**: Definition/enumeration concepts never tagged `template_validated`.
- **SC-005**: All seven patch regression tests pass.

## Assumptions

- Inventory entries use `title`/`label`, `scope_one_line`/`definition`; no proper-noun kind field in v1 (research §7.1).
- Unit matching re-derives unit from text via shared regex (research §7.3).
- RSVP header pool has no rotation export; minimal `pool-rotation.js` built (research §7.2).
- DeepSeek used for validation batch (non-embedding LLM convention).
- Integration hooks block question generation in `session.js` when `DETERMINISTIC_FACTUAL_QUESTIONS_ENABLED`.

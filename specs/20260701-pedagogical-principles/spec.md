# Feature Specification: Pedagogical Principles Layer

**Feature Branch**: `20260701-pedagogical-principles`  
**Created**: 2026-06-21  
**Status**: Draft  
**Input**: Six evidence-backed pedagogical principles (R1–R6) unblocked by novelty scoring and belief state.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Document-sourced review priority (Priority: P1)

As a learner reviewing spaced-repetition items, I want document-derived concepts prioritized over auto-generated filler so my review time focuses on source material.

**Why this priority**: Isolated change to queue scoring; immediate UX value without new infrastructure.

**Independent Test**: Queue with mixed provenance items; document-sourced items surface before gap-fill at equal due-ness; gap-fill capped per session.

**Acceptance Scenarios**:

1. **Given** two items due today, one `document` and one `gap_fill`, **When** the review queue builds, **Then** the document item ranks higher.
2. **Given** more than `MAX_GAP_FILL_PER_SESSION` gap-fill items due, **When** a session starts, **Then** at most the cap count of gap-fill items appear.

---

### User Story 2 — Deterministic factual questions (Priority: P1)

As a learner studying factual content, I want date/name/number questions generated from templates (not LLM) so answers stay faithful to the source and cost stays low.

**Why this priority**: Foundational for comprehension gate (R2); measurable LLM savings.

**Independent Test**: Classify inventory entries; factual concepts produce template questions with zero LLM for question text; failed fidelity falls back to LLM.

**Acceptance Scenarios**:

1. **Given** a concept with a year in source text, **When** classified as factual, **Then** question text uses a template and `generation_method: template` is logged.
2. **Given** a factual concept whose fact cannot be verified in source, **When** generating questions, **Then** LLM path is used for that concept only.

---

### User Story 3 — Comprehension gate before SM-2 (Priority: P2)

As a learner, I should not get flashcard-style repetition for conceptual knowledge until I have demonstrated understanding via Recall or Socratic success.

**Why this priority**: Depends on R1 classification; prevents premature drilling.

**Independent Test**: Conceptual concept blocked from `smItems` until `comprehensionConfirmed`; factual bypasses gate.

**Acceptance Scenarios**:

1. **Given** a conceptual concept without confirmation, **When** MCQ answered correctly, **Then** no SM-2 item is created.
2. **Given** Recall answer graded `partial` or better for that concept, **When** ingestion runs, **Then** `comprehensionConfirmed` is set and SM-2 scheduling proceeds.

---

### User Story 4 — Why am I seeing this? (Priority: P2)

As a learner, I want a one-line explanation on review items so I understand why each item surfaced.

**Why this priority**: Purely additive UI; zero scheduling risk.

**Independent Test**: Synthetic data combinations yield correct explanation priority (miss > propagated > due > fallback).

---

### User Story 5 — Dim familiar, cap highlights (Priority: P3)

As a learner in Slow Mode or RSVP explanations, I want familiar vault-mapped spans dimmed and only the highest-novelty spans highlighted within a word budget.

**Why this priority**: Rendering-only; requires span index infrastructure.

**Independent Test**: Familiar spans render at ~0.55 opacity; highlight budget respected.

---

### User Story 6 — Novelty-biased packing (Priority: P3, default off)

As a power user, I can enable block packing that softly biases toward a 70/30 novel/familiar mix without breaking narrative flow.

**Why this priority**: Highest risk; ships disabled by default.

**Independent Test**: Flag off → byte-identical deterministic packing; flag on → blend formula applied per R6.2.

---

### Edge Cases

- Neither novelty nor belief signal → packing unchanged for that concept.
- Ambiguous factual/conceptual classification → single batched LLM call (max 1 per doc).
- `recall_question` legacy sourceType → normalized with document provenance.
- Strict source fidelity → novelty bias never violates sequential constraints.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST tag SM-2 items with `reviewProvenance` (`document` | `gap_fill` | `mnemonic` | `vault_curation`) at creation without breaking existing `sourceType`.
- **FR-002**: Review queue MUST apply source-type penalty within equal due-ness; due-date ordering MUST remain primary.
- **FR-003**: Session MUST cap gap-fill items at `MAX_GAP_FILL_PER_SESSION`.
- **FR-004**: Concept inventory entries MUST receive `questionClass: factual | conceptual` at DPP indexing.
- **FR-005**: Factual concepts MUST generate question text via templates with source fidelity check; unverified facts MUST fall back to LLM.
- **FR-006**: Conceptual concepts MUST NOT enter SM-2 until `comprehensionConfirmed: true` (Recall partial+ or Socratic threshold).
- **FR-007**: Pending conceptual concepts MUST show a subtle indicator in review/vault surfaces.
- **FR-008**: UI MUST expose one-line "why this" explanations from existing assessment/belief/SM-2 data.
- **FR-009**: Slow reader and RSVP explanation panes MUST dim familiar spans and cap novelty highlights per `HIGHLIGHT_WORD_BUDGET`.
- **FR-010**: When enabled, packing MUST apply soft novelty/familiarity bias per blend formula without overriding structural ordering.

### Key Entities

- **ConceptInventoryEntry**: gains `questionClass`, `comprehensionConfirmed`, existing `noveltyScore`.
- **SmItem**: gains `reviewProvenance`; optional `lastMissAt` for transparency.
- **ConceptSpan**: `{ conceptId, start, end, noveltyScore, familiar }` for rendering.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: ≥80% of clearly factual test concepts classified without LLM.
- **SC-002**: 100% of template-generated factual answers verifiable in source (or LLM fallback triggered).
- **SC-003**: Conceptual concepts never appear in SM-2 queue before comprehension confirmation.
- **SC-004**: Due-date ordering regression tests pass (overdue document beats fresh gap-fill).
- **SC-005**: Default-off novelty packing produces identical output to pre-feature deterministic pack.

## Assumptions

- `reviewProvenance` is additive; existing `sourceType` (rsvp_block, etc.) unchanged.
- `gap_fill` provenance set explicitly at creation sites; default is `document`.
- Mnemonic and vault_curation items remain neutral in priority (no penalty/boost).
- R1 classification applies going-forward only; no backfill of existing documents.
- `NOVELTY_BLEND_WEIGHT = 0.15` is an unvalidated starting default.
- Text-to-concept spans built via source-text search on concept labels (no full NER pipeline).

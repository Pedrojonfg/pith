# Research: Threshold Concepts & Generative Pedagogy

## Threshold fraction

**Decision**: `THRESHOLD_TARGET_FRACTION = 0.12` (12% of inventory).

**Rationale**: Meyer & Land threshold concepts are few high-leverage gateways; 10–15% matches practitioner guidance without tagging most of the inventory. Minimum 1 tag when inventory ≥ 5; 0 when < 5.

## Tagging pipeline

**Decision**: Heuristic rank → take top `ceil(n × fraction)` → single LLM batch confirms/adjusts borderline (scores 0.35–0.65).

**Rationale**: Consistency across documents without N LLM calls; mirrors factual classifier pattern.

## Heuristic signals

- Dependent count (out-degree in `prerequisite_ids` reverse map)
- `concept_type` in `definition`, `argument`
- Low inbound prerequisite count (foundational)
- Penalty for `excursus` / `example`-only types

## RSVP vs gating

**Decision**: RSVP = generation/scheduling only (FR-003–006). Gating via extended comprehension gate (FR-013).

## Synthetic examples

**Decision**: Allowed in `threshold_expanded` when `!isSourceFidelityStrictEnabled()`; forbidden in strict mode.

## Generative pedagogy scope

**Decision**: Prompt constants in `generative-pedagogy.js`; inject into Socratic generation, tutors, Recall, Slow Phase 0/3, Review socratic. Exclude MCQ, Cloze, guide chat.

**Rationale**: Generation effect requires open-ended production; MCQ/Cloze are recognition tasks.

## Phase 0 care

**Decision**: Generative rules include scaffold clause: "If prior knowledge is thin, offer bullet scaffold before open why-question."

**Rationale**: Elaborative interrogation fails for low-knowledge learners (Dunlosky et al.).

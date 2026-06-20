# Feature Specification: Typed & Weighted Concept Connections

**Feature Branch**: `20260620-typed-weighted-connections`  
**Created**: 2026-06-20  
**Status**: Ready for implementation  
**Input**: Registry-level concept connections carry explicit relationship type and evidence-based weight; document-local `shared.conceptGraph` unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Semantically typed cross-document links (Priority: P1)

As a learner with concepts promoted across documents, I want registry connections to show *why* two concepts relate (prerequisite, contradiction, example, part-of, or generic association) so the vault graph is readable, not a hairball.

**Acceptance Scenarios**:

1. **Given** DPP builds a concept graph with a clear prerequisite edge, **When** both endpoint concepts are yellow+ in the registry, **Then** a registry connection is created with `type: PREREQUISITE`.
2. **Given** an edge with no clear typed relationship, **When** promoted, **Then** `type` is `ASSOCIATED`, never free text.
3. **Given** a legacy registry row without connection fields, **When** any reader loads it, **Then** defaults apply (`ASSOCIATED`, weight `0.3`) without error.

### User Story 2 — Weight grows with demonstrated recall (Priority: P1)

As a learner, I want connection strength to increase when I correctly recall material involving both linked concepts, so the graph reflects demonstrated knowledge—not LLM confidence alone.

**Acceptance Scenarios**:

1. **Given** a registry connection at weight `0.3`, **When** a correct recall/cloze/review response involves both endpoint concepts, **Then** weight increases by `0.15` (capped at `1.0`) and `reinforcedCount` increments.
2. **Given** reinforcement persistence fails, **When** the study submission completes, **Then** the submission still succeeds with no user-visible error.

### User Story 3 — Neglected links fade but persist (Priority: P2)

As a learner returning after a break, I want stale connections to appear weaker without disappearing, so the graph hints what to revisit.

**Acceptance Scenarios**:

1. **Given** `lastReinforcedAt` older than 30 days, **When** the registry graph is read, **Then** weight decreases by `0.1` once (floored at `0.05`) and the new value persists.
2. **Given** decay applies, **When** the edge is rendered, **Then** it is never deleted solely due to decay.

### User Story 4 — Visual encoding in graph views (Priority: P2)

As a learner viewing the vault graph, I want line style/color to reflect relationship type and thickness/opacity to reflect weight.

**Acceptance Scenarios**:

1. **Given** registry connections of all five types, **When** the vault graph renders, **Then** each type is visually distinguishable.
2. **Given** weights from `0.05` to `1.0`, **When** rendered, **Then** a visible thickness/opacity gradient appears at desktop and mobile widths.

## Functional Requirements

- **FR-001**: Registry MUST store directed connections with `sourceId`, `targetId`, `type` (enum), `weight` `[0,1]`, and `evidence` (`reinforcedCount`, `lastReinforcedAt`, `createdAt`).
- **FR-002**: Relationship `type` MUST be one of: `PREREQUISITE`, `CONTRADICTS`, `EXEMPLIFIES`, `PART_OF`, `ASSOCIATED`.
- **FR-003**: New connections MUST initialize at `weight: 0.3`, `reinforcedCount: 0`.
- **FR-004**: Type MUST be assigned in the same LLM call that proposes document graph edges (DPP T1.3 / `generateEpistemicGraph`) via a closed enum field—no extra LLM round trip.
- **FR-005**: Reinforcement MUST use per-response concept ID sets (e.g. recall `concept_ids`); weight updates MUST be fire-and-forget and MUST NOT block study flows.
- **FR-006**: Lazy read-time decay after configurable threshold (default 30 days): `-0.1` weight, floor `0.05`; no background job.
- **FR-007**: Connections MUST live at registry level only; `shared.conceptGraph` document-local edges unchanged.
- **FR-008**: Promotion to typed registry connections MUST occur only when both endpoints are yellow+ maturity.
- **FR-009**: Legacy connections without new fields MUST read with `ASSOCIATED` / `0.3` defaults (no migration rewrite).
- **FR-010**: `graph/view.js` and `graph/canvas.js` (and vault graph adapter) MUST encode type and weight visually; no manual edit UI in v1.

## Success Criteria

- New prerequisite-like document edges yield `PREREQUISITE` registry connections when promoted.
- Correct multi-concept recall increases connection weight without blocking submission.
- Legacy data renders without crash; document-local graphs unchanged.
- All five types and weight gradient visible in vault graph.

## Key Entities

- **RegistryConnection**: Directed typed edge between global concept IDs with evidence-backed weight.
- **Concept (registry)**: Existing global concept row (yellow/green); promotion gate endpoint.
- **Epistemic graph edge**: Document-local LLM edge with mappable `type` field.

## Assumptions

- Pair reinforcement derives from per-response `concept_ids` arrays at submission time; `assessmentSignals` remains single-concept aggregated (no pair field retrofit).
- Epistemic edge types map deterministically to the five-value enum (see plan/research).
- Decay threshold lives in `config/flags.js` as `CONNECTION_DECAY_DAYS` (default 30).

## Out of Scope

- Manual edge type/weight editing; cross-domain weight normalization; retroactive migration of pre-ship edges; background decay jobs; changes to document-local `conceptGraph` storage.

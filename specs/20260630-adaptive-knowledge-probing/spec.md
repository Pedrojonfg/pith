# Feature Specification: Adaptive Knowledge Probing Engine

**Feature Branch**: `20260630-adaptive-knowledge-probing`  
**Created**: 2026-06-21  
**Status**: Ready for implementation  
**Input**: `spec-adknowlprobeng.md` — EIG-based probe selection and Bayesian belief propagation for pre-packing assessment.

**Depends on**: `20260619-knowledge-vault-post-a-plus` (typed PREREQUISITE edges), `20260618-holistic-assessment-coverage`, `20260611-rsvp-assessment-reposition`, `20260629-vault-embedding` (cascade merge ordering)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Smarter pre-packing probes (Priority: P1)

As a learner starting RSVP, I want the knowledge check to ask the questions that teach the system the most about what I know, so I spend less time on obvious probes and packing reflects my actual gaps.

**Why this priority**: Core value — replaces heuristic concept selection without adding LLM cost.

**Independent Test**: On a synthetic 5-node prerequisite chain with mixed vault maturity priors, `nextProbeBatch` selects concepts with highest expected information gain; disabling `ADAPTIVE_PROBING_ENABLED` restores prior holistic coverage selection.

**Acceptance Scenarios**:

1. **Given** a document with concept inventory and PREREQUISITE graph, **When** pre-packing assessment starts with adaptive probing enabled, **Then** the concept IDs sent to question generation come from `nextProbeBatch`, not the legacy coverage plan alone.
2. **Given** a concept at prior belief ≥ 0.9 or ≤ 0.1, **When** probe batch is computed, **Then** that concept is excluded from candidacy.
3. **Given** `ADAPTIVE_PROBING_ENABLED = false`, **When** assessment runs, **Then** selection reverts to existing holistic/heuristic path with no partial belief state.

### User Story 2 — Belief propagation after answers (Priority: P1)

As a learner answering assessment questions, I want confirming I know an advanced concept to raise confidence in prerequisites (and missing prerequisites to lower dependents), so the system infers knowledge beyond the single node asked.

**Acceptance Scenarios**:

1. **Given** a probe answer `knew`, **When** `updateBeliefs` runs, **Then** the probed node belief rises with damping (not pinned to 1.0) and prerequisites receive upward propagation with default 0.6 damping.
2. **Given** a probe answer `missed` on a prerequisite, **When** propagation runs, **Then** dependent concepts' beliefs decrease with default 0.8 downward damping (stronger than upward).
3. **Given** a chain longer than `MAX_PROPAGATION_HOPS` (default 2), **When** propagation runs, **Then** nodes beyond the hop limit are unchanged.

### User Story 3 — Knowledge frontier in vault (Priority: P2)

As a learner reviewing my vault, I want to see concepts "ready to learn next" and "recently solidified" so I know where to focus without opening a document session.

**Acceptance Scenarios**:

1. **Given** project-scoped belief state in `vault_belief_state`, **When** user opens vault branch, **Then** "Ready to learn next" lists outer fringe concepts and "Recently solidified" lists inner fringe.
2. **Given** a later assessment with lower belief on a concept, **When** beliefs merge into project state, **Then** stored belief uses max(existing, new) — knowledge levels only upgrade.

### User Story 4 — Robust probe graph (Priority: P1)

As the system building a probe DAG, I must never feed cycles into message passing, and data-quality issues must be logged for curation.

**Acceptance Scenarios**:

1. **Given** a PREREQUISITE cycle in the graph, **When** probe graph is built, **Then** the lowest-weight edge in the cycle is dropped and a row is written to `probe_graph_warnings`.
2. **Given** no concept graph or empty PREREQUISITE edges, **When** probe graph is built, **Then** fallback treats concepts as independent nodes (flat EIG, no propagation edges).

### Edge Cases

- Duplicate node IDs at construction → reject with clear error.
- Probe graph built only after cascade merges applied (post DPP T1.6+).
- Full probe batch precomputed before assessment UI — preserves `ASSESSMENT_PARALLEL_PACKING`.
- Early-stop mode (`ADAPTIVE_PROBING_EARLY_STOP`) default off; fixed-N behavior unchanged when off.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST build a probe DAG from `shared.conceptGraph` filtering **PREREQUISITE** edges only; other edge types excluded.
- **FR-002**: System MUST detect cycles via DFS and break deterministically by dropping lowest-weight edge; log to `probe_graph_warnings`.
- **FR-003**: System MUST initialize per-session belief state in `shared.knowledgeBeliefState` from vault maturity priors (green 0.85, yellow 0.55, gray/unseen `BASE_RATE_PRIOR` default 0.25).
- **FR-004**: System MUST implement `nextProbe` and `nextProbeBatch(n)` using expected information gain with diversity-aware batch selection (simulate propagation between picks).
- **FR-005**: System MUST implement `updateBeliefs(graph, state, conceptId, response)` with three-way grading (`knew`, `partial`, `missed`) and bounded Pearl-style propagation along PREREQUISITE edges only.
- **FR-006**: System MUST replace concept-selection step feeding pre-packing assessment with adaptive probing when enabled; question-generation prompts and UI unchanged downstream.
- **FR-007**: System MUST persist project-scoped beliefs in `vault_belief_state` and merge session beliefs with max(existing, new) on assessment completion.
- **FR-008**: System MUST expose `computeFringes` for outer/inner frontier and display in `screenVaultBranch`.
- **FR-009**: All thresholds and master switch MUST live in `config/flags.js` per §10 of source spec.
- **FR-010**: When graph absent or acyclic-only fallback, system MUST degrade to independent-node EIG without blocking assessment.

### Key Entities

- **ProbeGraph**: DAG of concept nodes with PREREQUISITE edges, cycle-break metadata.
- **KnowledgeBeliefState**: Ephemeral per-document-session map `{ conceptId → { belief, lastUpdated, source } }`.
- **VaultBeliefState**: Persistent project-scoped belief rows.
- **ProbeGraphWarning**: Audit log for cycle breaks.

## Success Criteria *(mandatory)*

- **SC-001**: Synthetic cycle-break test passes — lowest-weight edge dropped, warning logged.
- **SC-002**: EIG selection on 5-node chain matches manually computed maximum-EIG node.
- **SC-003**: Batch diversity test avoids redundant sibling probes when propagation would make second redundant.
- **SC-004**: Propagation asymmetry test confirms downward damping > upward effect magnitude.
- **SC-005**: `ASSESSMENT_PARALLEL_PACKING` regression — full batch known before packing starts.
- **SC-006**: `ADAPTIVE_PROBING_ENABLED = false` restores prior selection with no orphaned belief state.

## Assumptions

- v1 scope is pre-packing assessment only; other modes' `assessmentSignals` are out of scope.
- `PART_OF` and `EXEMPLIFIES` edges do **not** propagate belief in v1 (explicit product decision).
- Edge weight for cycle-breaking uses existing `weight` field when present, default 1.0; co-occurrence verification not required for this narrow use.
- Current selection being replaced: holistic `buildAssessmentCoveragePlan` / `computeHolisticAssessmentBudget` when `HOLISTIC_ASSESSMENT_ENABLED`; legacy path uses LLM even coverage via prompt when holistic off.
- `conceptGraph` may be sparse or absent at assessment time — flat fallback required.
- `screenVaultBranch` currently has minimal markup; frontier UI and Supabase fetch path are new.
- Algorithm runs in pure JavaScript; sub-millisecond at typical graph sizes; no new LLM cost driver.

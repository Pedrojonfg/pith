# Feature Specification: Adaptive Pre-Packing Assessment Activation

**Feature Branch**: `20260711-adaptive-prepacking-activation`

**Created**: 2026-07-16

**Status**: Draft

**Input**: User description: "Adaptive Pre-Packing Assessment Activation — Phase A edge field fix, Phase B shared-gate activation + EIG ordering + early stop, Phase C vault-prior exclusion gate"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Probe graph reads production conceptGraph edges (Priority: P1)

A learner opens a document whose Document Preparation Pipeline (DPP) wrote a `conceptGraph` with prerequisite edges. When adaptive probing builds its probe DAG, those edges are recognized so selection and belief propagation have a non-empty graph.

**Why this priority**: Without correct edge field parsing, later phases activate an engine that sees empty/sparse graphs and cannot adapt meaningfully.

**Independent Test**: Feed `buildProbeGraph` a fixture using only `source_id`/`target_id` (DPP shape) and assert a non-empty DAG identical in structure to the legacy `from`/`to` fixture.

**Acceptance Scenarios**:

1. **Given** a `conceptGraph` whose edges use only `source_id`/`target_id`, **When** `buildProbeGraph` runs, **Then** it produces the same nodes, edges, and cycle-break behavior as an equivalent `from`/`to` fixture.
2. **Given** the existing cycle-break fixture (legacy `from`/`to`), **When** its test runs unmodified, **Then** it still passes.
3. **Given** a mid-size DPP-shaped fixture, **When** `buildProbeGraph` runs, **Then** the DAG is non-empty and non-trivial (multiple nodes and at least one prerequisite edge kept).

---

### User Story 2 - Adaptive probing runs on the live shared pre-mode gate (Priority: P1)

A learner enters study via the shared pre-mode assessment gate. Adaptive probing is active: the question set is filtered and ordered by expected information gain (EIG), without adding mid-quiz LLM calls.

**Why this priority**: The engine exists but is unreachable because holistic/adaptive flags still gate on the hardcoded-false RSVP-only pre-packing flag.

**Independent Test**: Enable adaptive flags in a harness, enter via the shared-gate path, assert EIG-ordered concept set and unchanged LLM call count vs baseline batch generation.

**Acceptance Scenarios**:

1. **Given** shared pre-mode assessment enabled and adaptive probing master flag true, **When** the shared-gate path creates assessment items, **Then** `filterInventoryForAdaptiveProbing` / `prepareAdaptiveProbingContext` run and the generated concept order matches EIG batch order.
2. **Given** the same inventory without adaptive filtering, **When** compared to the adaptive run, **Then** adaptive ordering differs from the unordered baseline while LLM call count stays 1 (non-holistic) or unchanged (holistic).
3. **Given** adaptive probing enabled, **When** answers update beliefs, **Then** `applyAdaptiveBeliefUpdate` → `updateBeliefs` continues to work as before.

---

### User Story 3 - Early stop when remaining uncertainty is low (Priority: P2)

During an adaptive assessment, after several high-confidence answers on central concepts, remaining unasked concepts have low aggregate uncertainty. The quiz stops early and routes to results, carrying forward belief values for unasked concepts.

**Why this priority**: Shortens assessment without sacrificing packing quality when the graph already supports strong inferences.

**Independent Test**: Synthetic answer sequence that drives aggregate entropy of remaining concepts below threshold; assert runner stops early and LLM count unchanged.

**Acceptance Scenarios**:

1. **Given** `ADAPTIVE_PROBING_EARLY_STOP` enabled and a high-confidence answer sequence, **When** aggregate uncertainty over remaining unasked concepts falls below the early-stop threshold, **Then** the runner ends before exhausting all candidate questions and routes to results.
2. **Given** early stop, **When** the knowledge profile is built, **Then** unasked concepts appear with assessment status `"inferred"` (belief carried forward), distinct from `"tested"`.
3. **Given** holistic multi-batch generation, **When** early stop triggers, **Then** it only ends the current in-runner question sequence (does not cancel already-generated batches mid-generation); LLM generation call count remains unchanged from the non-early-stop path for that document.

---

### User Story 4 - High vault-confidence concepts are skipped, not just deprioritized (Priority: P2)

Concepts with seeded belief above a high-confidence skip threshold (from vault/registry maturity) are excluded from the question set entirely, but still appear in the knowledge profile as presumed known from vault.

**Why this priority**: Avoids re-testing material the vault already marks as strongly known, while keeping packing aware of those concepts.

**Independent Test**: Inventory with green/yellow/gray priors; assert greens above threshold are absent from generated questions but present in the profile as `presumed_known_vault`.

**Acceptance Scenarios**:

1. **Given** inventory concepts with green priors above `HIGH_CONFIDENCE_SKIP_THRESHOLD`, **When** adaptive filtering runs, **Then** those concepts are excluded from the candidate question set.
2. **Given** such exclusions, **When** the knowledge profile is produced, **Then** excluded concepts appear with status `"presumed_known_vault"`.
3. **Given** a representative fixture, **When** filtering completes, **Then** skipped vs asked counts are reported for human sanity-check (not over-aggressive).

---

### Edge Cases

- Empty or missing `conceptGraph.edges`: probe graph still builds from inventory `prerequisite_ids` when present; otherwise nodes-only graph with no edges.
- Mixed edge field shapes in one graph (`source_id` and `from` present): prefer `source_id`/`target_id`, then fall back.
- Early stop disabled (`ADAPTIVE_PROBING_EARLY_STOP: false`): runner exhausts the adaptive candidate set as today.
- All concepts vault-skipped: fall back to non-empty assessment path (existing empty-filter fallback in adaptive integration) rather than generating zero questions silently.
- Holistic path: early stop applies to the in-runner answer loop only, not to skipping ungenerated LLM batches after generation has completed.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST accept `conceptGraph.edges` with `source_id`/`target_id` as the primary field names when building the probe DAG and when deriving inventory edges for assessment coverage, while retaining `from`/`to` and `sourceId`/`targetId` as permanent fallbacks.
- **FR-002**: System MUST NOT require changes to unrelated graph consumers that already read their own canonical shapes (e.g. cloze `graph/build.js` already uses `source_id`/`target_id`; slow academic graphs use `from`/`to`). Scope of the dual-field fix is `probe-graph.js` and `assessment-coverage.js` unless inspection finds another adaptive-path consumer that would still drop DPP edges.
- **FR-003**: `isHolisticAssessmentEnabled()` and `isAdaptiveProbingEnabled()` MUST gate on `isSharedPreModeAssessmentEnabled()` (plus their master constants), NOT on `isPrePackingAssessmentEnabled()`. The legacy RSVP-only gate MUST remain unchanged (`false`).
- **FR-004**: The shared-gate assessment creation path MUST invoke adaptive filtering/context preparation when adaptive probing is enabled.
- **FR-005**: Candidate concepts and their order for assessment item generation MUST come from existing `nextProbeBatch` / EIG selection without adding mid-quiz LLM calls.
- **FR-006**: When `ADAPTIVE_PROBING_EARLY_STOP` is true, after each real answer belief update the system MUST compute aggregate uncertainty over remaining unasked concepts via existing `computeGraphEntropy` / `binaryEntropy` helpers; if below a named early-stop threshold constant, stop the runner early.
- **FR-007**: Early-stopped (unasked) concepts MUST appear in the knowledge profile with assessment status `"inferred"` and belief-derived mastery/confidence.
- **FR-008**: Concepts whose seeded prior belief exceeds `HIGH_CONFIDENCE_SKIP_THRESHOLD` MUST be excluded from the question candidate set (not only ranked lower) and MUST appear in the knowledge profile with status `"presumed_known_vault"`.
- **FR-009**: Thresholds introduced or retuned (`HIGH_CONFIDENCE_SKIP_THRESHOLD`, early-stop entropy threshold) MUST be named commented constants and documented as unvalidated placeholders.
- **FR-010**: System MUST NOT change `isPrePackingAssessmentEnabled()`, `NOVELTY_BIASED_PACKING_ENABLED`, provider selection, or `priorBeliefForMaturity` seeding values (0.85 / 0.55 / 0.25).
- **FR-011**: Hub-centrality exemption from vault-skip (ask high-centrality hubs despite high vault confidence) MUST NOT be implemented in this feature; it is an open design question for a future decision.

### Key Entities

- **ProbeGraph**: DAG of prerequisite edges used for EIG selection and belief propagation; internal edges normalized to `{ from, to, weight }`.
- **BeliefState**: Per-concept belief with source (`prior` | `probe` | `propagated`).
- **AdaptiveAssessmentProfile**: Knowledge profile extension carrying per-concept `assessmentStatus`: `tested` | `inferred` | `presumed_known_vault`.
- **AdaptiveProbingFlags**: Master enable, skip thresholds, early-stop toggle and entropy threshold.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Probe graph built from DPP-shaped (`source_id`/`target_id`) fixtures matches legacy-shape DAG structure on identical topology fixtures (100% node/edge parity after normalization).
- **SC-002**: With adaptive flags on, shared-gate entry produces an EIG-ordered candidate set distinguishable from unordered baseline in automated tests.
- **SC-003**: Early-stop synthetic scenarios end the runner with fewer answered questions than candidates, while assessment LLM call count stays at 1 (non-holistic) or unchanged (holistic).
- **SC-004**: Vault-high-confidence concepts above threshold never appear in generated questions but always appear in the profile as `presumed_known_vault`.
- **SC-005**: Existing probe-graph cycle-break and adaptive belief-update tests continue to pass without modification of their legacy edge fixtures.

## Assumptions

- **Dual-field edge support is permanent** (cheap; fixtures and legacy shapes remain valid). No mandatory fixture migration.
- **Other consumers**: `graph/build.js` (cloze) already reads `source_id`/`target_id`. Slow-mode `graph/view.js` / academic graphs use a different `from`/`to` model and are out of scope. `assessment-integration.js` filteredEdges already consume normalized `{from,to}` from `deriveInventoryEdges` after the coverage fix.
- **Entropy aggregation**: reuse `computeGraphEntropy(state, remainingNodeIds)` as-is; optional thin wrapper only to select remaining unasked IDs — no new statistical formula.
- **Profile status convention**: no existing `inferred` / `presumed_known_vault` enum; introduce optional additive `assessmentStatus` on profile `items` / `byConceptId` entries. Packing continues to use mastery/confidence; status is for downstream distinction.
- **Early stop scope (holistic)**: within the current answer runner only (safer). Already-generated question batches are not regenerated or discarded mid-generation.
- **Phase C threshold default**: set `HIGH_CONFIDENCE_SKIP_THRESHOLD` to `0.80` (unvalidated placeholder) so green priors (0.85) are excluded; current code already excludes via `isProbeCandidate` but only at ≥0.9, so greens were deprioritized/selectable rather than hard-excluded from the profile-marking path.
- **Current Phase C behavior (pre-change)**: `isProbeCandidate` already skips belief ≥ hi or ≤ lo for EIG selection (soft exclusion from probing), but skipped concepts are not written into the knowledge profile as `presumed_known_vault`. Phase C makes exclusion explicit at the filter boundary and adds profile surfacing.
- **Hub exemption**: flagged open; not implemented (FR-011).
- **Commits**: one logical phase per commit when the user requests `/commit`; plan-feature-auto does not auto-commit.
- **Out of scope**: mid-quiz LLM re-generation, cross-user calibration, provider changes, removal of legacy RSVP gate code.

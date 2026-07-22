# Feature Specification: Adaptive Holistic Assessment Wiring

**Feature Branch**: `20260722-adaptive-holistic-wiring`

**Created**: 2026-07-22

**Status**: Draft

**Input**: User description: "Wire adaptive probing (EIG selection + vault-prior skip) into the live holistic assessment generator so the selection engine's filtered candidate set is the actual input to generation, and vault-confidence skip happens before generation not after."

**Supersedes**: nothing. Corrects an integration gap between `20260621-adaptive-knowledge-probing` / `20260711-adaptive-prepacking-activation` (selection engine) and the live holistic concept-coverage generator. Both prior specs remain valid.

**Depends on**: adaptive probing (EIG + belief propagation — implemented), adaptive prepacking activation Phases A/B/C (implemented), holistic concept-coverage generator (implemented; modified here).

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Assessment asks only the adaptive candidate set (Priority: P1)

A learner starts study on a document with many concepts. Adaptive probing computes a smaller, high-value candidate set (EIG-ordered, vault-high-confidence excluded). The live holistic assessment generator asks questions only about that candidate set — not about every concept in the document inventory.

**Why this priority**: Today both systems run but do not talk: adaptive probing filters, then the generator ignores the filter and assesses (nearly) the full inventory. This is the core bug.

**Independent Test**: Fixture with ~15 inventory concepts, mock EIG plan selecting 5, vault-high-confidence marking 2 others. Run the live holistic generation path with mocked LLM. Assert the LLM receives exactly the 5 selected concepts; the 2 vault-skipped concepts never appear in any prompt payload.

**Acceptance Scenarios**:

1. **Given** adaptive probing and holistic assessment both enabled, a non-empty inventory, and a coverage plan with a selected subset, **When** pre-packing assessment items are created, **Then** the generator is invoked with only the selected candidate concepts (not the full inventory).
2. **Given** the same setup with vault-high-confidence concepts present in inventory, **When** items are generated, **Then** those vault-skipped concepts never appear in any LLM batch payload.
3. **Given** generation completes, **When** the knowledge profile is inspected, **Then** assessed concepts are labeled `tested` (or `inferred` if early-stop applies) and vault-skipped concepts are labeled `presumed_known_vault` without having been asked.

---

### User Story 2 - Flag-off preserves full-inventory behavior (Priority: P1)

A learner (or operator) disables adaptive probing. Assessment generation continues to use the full concept inventory exactly as before this fix — no silent behavior change when the flag is off.

**Why this priority**: Defensive compatibility; the wiring must not change the non-adaptive path.

**Independent Test**: Set adaptive probing flag false; assert generator still receives the full inventory.

**Acceptance Scenarios**:

1. **Given** adaptive probing disabled and a non-empty inventory, **When** holistic assessment items are created, **Then** the generator receives the full inventory unchanged.
2. **Given** an empty selection from the coverage plan despite a non-empty inventory (upstream bug), **When** candidates are resolved, **Then** the system falls back to the full inventory and emits a warning rather than generating zero questions.

---

### User Story 3 - Vault-skip cannot overwrite tested status (Priority: P2)

After assessment, vault-skip enrichment never silently rewrites a concept that was already asked and marked `tested` into `presumed_known_vault`. If the pre-generation exclusion invariant is violated, the system fails loudly (assert/warn) rather than corrupting the profile.

**Why this priority**: Audit found post-generation stamping can overwrite `tested` with `presumed_known_vault`. Pre-generation exclusion should make this unreachable; a guard turns a silent bug into a loud one.

**Independent Test**: Unit/fixture calling the enrichment path with a concept both in vault-skipped ids and already `tested`; assert guard fires (throw or warn) and status is not silently overwritten to vault-presumed.

**Acceptance Scenarios**:

1. **Given** vault-high-confidence concepts were excluded before generation, **When** the knowledge profile is enriched with adaptive statuses, **Then** those concepts appear as `presumed_known_vault` and no assessed concept is re-labeled to that status.
2. **Given** a concept is both in the vault-skip set and already has status `tested`/`assessed` (invariant violation), **When** enrichment runs, **Then** the system logs a warning or throws rather than silently overwriting to `presumed_known_vault`.

---

### Edge Cases

- Empty adaptive selection with non-empty inventory → fall back to full inventory + warning (never generate zero questions silently).
- Adaptive probing flag off → full inventory path unchanged.
- Very large EIG subset → existing ≤20 batching remains a safety net; denominators for progress/coverage use the filtered set size, not full inventory size.
- Early-stop continues to operate on the correctly-scoped candidate set (no change to early-stop math itself).

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: When adaptive probing and holistic assessment are both enabled, the holistic generator MUST receive the adaptive candidate set (EIG-selected, vault-high-confidence excluded), not the full document inventory.
- **FR-002**: Vault-high-confidence concepts MUST be excluded before generation (actual skip), not merely labeled after generation.
- **FR-003**: A resolver helper MUST map the coverage plan's selected concept ids back to full inventory entries; if adaptive probing is disabled, it MUST return the full inventory.
- **FR-004**: The resolver MUST never return an empty list when the inventory is non-empty; empty selection falls back to full inventory with a warning.
- **FR-005**: The holistic generator parameter MUST be renamed to communicate "subset to assess" (not "full inventory"), with a comment stating the caller must pass the pre-filtered set.
- **FR-006**: Progress/coverage denominators that report "X of Y concepts assessed" MUST use the filtered candidate set size as Y when such denominators exist.
- **FR-007**: Enrichment of knowledge-profile adaptive statuses MUST guard against overwriting an already-`tested`/`assessed` concept with `presumed_known_vault`.
- **FR-008**: When adaptive probing is disabled, behavior MUST match pre-fix full-inventory generation.
- **FR-009**: Existing EIG algorithm, belief propagation, early-stop math, UI/screen flow, batching (≤20), and master flag semantics MUST remain unchanged.
- **FR-010**: An end-to-end fixture test MUST exercise the real holistic call path with a mocked LLM and assert candidate count, vault exclusion, and final knowledge-profile labels (not merely string-presence of function names).

### Key Entities

- **Candidate concept set**: Subset of the document concept inventory selected by adaptive probing (EIG + vault-prior exclusion); input to holistic generation.
- **Coverage plan**: Output of adaptive coverage planning; exposes the selected concept ids used to build the candidate set.
- **Knowledge profile statuses**: `tested` (asked), `inferred` (early-stop / belief carry-forward), `presumed_known_vault` (vault-high-confidence skip before ask).
- **Holistic assessment items**: One MCQ per concept in the candidate set, generated in batches of ≤20.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the step-6 fixture (~15 inventory concepts, 5 EIG-selected, 2 vault-skipped), the live path asks exactly 5 concepts (before: ~15); vault-skipped concepts are never prompted.
- **SC-002**: Final knowledge profile labels vault-skipped concepts `presumed_known_vault` and assessed ones `tested`/`inferred` with zero silent overwrites of `tested` → `presumed_known_vault`.
- **SC-003**: With adaptive probing disabled, generator input size equals full inventory size (100% parity with pre-fix behavior).
- **SC-004**: Empty-selection guard prevents zero-question generation when inventory is non-empty (fallback to full inventory).
- **SC-005**: Existing early-stop and batching behavior continue to pass their prior tests without modification to EIG/belief math.

---

## Assumptions

- Both `ADAPTIVE_PROBING_ENABLED` and `HOLISTIC_ASSESSMENT_ENABLED` remain true as the live default; this feature only fixes the both-true path.
- Open Questions 1–6 in the source brief are answered via repo inspection in `research.md` before code changes (plan phase), not left as NEEDS CLARIFICATION for the user.
- Non-holistic `filterInventoryForAdaptiveProbing` path is out of scope for deletion; duplication vs `buildAdaptiveCoveragePlan` is reported only.
- Helper placement (`resolveAdaptiveCandidateConcepts`) may live next to `buildAdaptiveCoveragePlan` or near the study.js call site — implementer's choice per research.
- Source brief: `spec-eig.md` at repo root (implementation-oriented); this Spec Kit `spec.md` is the planning authority for user outcomes and requirements.

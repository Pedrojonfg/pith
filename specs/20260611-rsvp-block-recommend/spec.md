# Feature Specification: RSVP Block Count Recommendation

**Feature Branch**: `20260611-rsvp-block-recommend`

**Created**: 2026-06-10

**Status**: Draft (clarified)

**Input**: On-demand recommendation of how many RSVP study blocks to use, based on material complexity and concept structure. The user explicitly requests the recommendation; concept inventory is cached and reused when generating blocks. Deterministic formula uses all available free signals plus concept count. Cache invalidates on file or study-notes change. RSVP mode only in v1.

## Clarifications

### Session 2026-06-10

- Q: How should the user interact with the recommended block count? → A: **Pre-filled editable default** — user must **request** the recommendation (not automatic); concept inventory and graph work are **cached and reused** when generating blocks (no full redo).
- Q: What expensive work runs when the user requests a recommendation? → A: **Concept inventory only** (one AI step); block count **N** comes from a **deterministic formula**, not a second AI call.
- Q: What signals feed the formula? → A: **All free signals available** (text size/structure, pedagogical metadata, document sections if present) **plus concept count** after inventory.
- Q: When is cached inventory invalidated? → A: **New file or changed study focus notes** invalidate; changing only the block number does **not** invalidate — only re-pack on generate.
- Q: Which study modes get this feature? → A: **RSVP only (v1)** — Questions mode and review flows are out of scope for v1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request block count recommendation (Priority: P1)

A student uploads study material for RSVP mode and is unsure how many blocks to use. They click **Recommend block count**, wait while the app indexes concepts once, and see a suggested number pre-filled in the Blocks field with a short explanation of why that number fits the material. They may edit the number before generating blocks.

**Why this priority**: Delivers the core value — removes guesswork without forcing a fixed default or hiding control.

**Independent Test**: Upload a medium document in RSVP create flow; click recommend; verify Blocks field updates, explanation appears, and no block content is generated yet.

**Acceptance Scenarios**:

1. **Given** RSVP create with a valid uploaded file, **When** the user clicks **Recommend block count**, **Then** the app runs concept indexing once and shows a recommended block count between platform limits (5–60).
2. **Given** a recommendation is shown, **When** the user reads the explanation, **Then** they see a brief human-readable reason tied to material signals (e.g., concept count, length, density).
3. **Given** a recommendation pre-filled the Blocks field, **When** the user changes the number manually, **Then** they can proceed without being blocked or re-prompted to accept the recommendation.

---

### User Story 2 - Generate blocks reusing cached inventory (Priority: P1)

After requesting a recommendation, the student confirms **Generate blocks** with the suggested or edited block count. The app reuses the cached concept inventory and only performs grouping/packing into N blocks — it does not re-index concepts from scratch.

**Why this priority**: Token efficiency and latency were explicit user requirements; reuse is essential to the feature’s value.

**Independent Test**: Request recommendation, note indexing completes, then generate blocks; verify second step does not repeat full concept indexing (observable as faster progress and single inventory pass).

**Acceptance Scenarios**:

1. **Given** a valid cached concept inventory from a prior recommendation in the same create session, **When** the user clicks **Generate blocks**, **Then** block packing uses that inventory without repeating concept indexing.
2. **Given** the user changes only the block count after recommendation, **When** they generate blocks, **Then** the cached inventory is still used and blocks are re-packed to the new count.
3. **Given** generation completes, **When** the user views the block list, **Then** the number of blocks matches the chosen count (within platform limits and normal deduplication rules).

---

### User Story 3 - Manual path unchanged (Priority: P2)

A student prefers full control and never clicks **Recommend block count**. They enter a block number manually and generate blocks as today. The first generation run performs concept indexing as part of the normal block-creation pipeline.

**Why this priority**: Preserves existing power-user flow; recommendation is optional, not mandatory.

**Independent Test**: Upload file, skip recommend, set Blocks to 20, generate; session works as before.

**Acceptance Scenarios**:

1. **Given** RSVP create without clicking recommend, **When** the user sets Blocks manually and generates, **Then** block creation succeeds with no requirement to request a recommendation first.
2. **Given** no prior recommendation in the session, **When** generate runs, **Then** concept indexing occurs as part of generation (not an extra orphaned step).

---

### User Story 4 - Cache invalidation on material or focus change (Priority: P2)

A student requests a recommendation, then changes the uploaded file or edits study focus notes. The app clears the stale recommendation and inventory so the user is not misled by counts based on outdated input.

**Why this priority**: Prevents silent wrong recommendations — a trust and correctness requirement.

**Independent Test**: Recommend, then change study notes; verify recommendation state clears and next recommend re-runs indexing.

**Acceptance Scenarios**:

1. **Given** a completed recommendation, **When** the user replaces the uploaded file, **Then** cached inventory and recommendation are invalidated and the Blocks field no longer shows a stale “recommended” state without re-requesting.
2. **Given** a completed recommendation, **When** the user edits study focus notes, **Then** cached inventory and recommendation are invalidated.
3. **Given** a completed recommendation, **When** the user only changes the block number, **Then** recommendation and inventory remain valid for reuse on generate.

---

### Edge Cases

- User clicks **Recommend** twice without changing file or notes: second click reuses cached inventory; only recomputes N (no duplicate indexing).
- Pedagogical metadata or section tree not yet available: formula falls back to text metrics + concept count only.
- Concept inventory fails (network, API key missing, timeout): show clear error; Blocks field unchanged; user can still try manual count if indexing succeeds on generate.
- Very small material (few concepts): recommended N respects minimum (5 blocks).
- Very large/dense material: recommended N respects maximum (60 blocks).
- User requests recommend then switches away from RSVP before generate: cached data may be discarded or ignored per existing create-screen session rules; no cross-mode leakage to Slow/Cloze.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: In RSVP create flow, the system MUST offer an explicit **Recommend block count** action; recommendation MUST NOT run automatically on upload.
- **FR-002**: When recommendation is requested, the system MUST perform concept indexing once and compute block count N using a deterministic formula (no second AI call solely to choose N).
- **FR-003**: The deterministic formula MUST use concept count after indexing and SHOULD incorporate all already-available free signals: text size/structure metrics, pedagogical metadata (genre, conceptual load), and document section count when present.
- **FR-004**: Recommended N MUST be clamped to the existing platform block limits (5–60) and pre-fill the Blocks input; the user MUST be able to override before generating.
- **FR-005**: The system MUST show a brief explanation (“why N blocks?”) when a recommendation is presented.
- **FR-006**: After a successful recommendation, **Generate blocks** MUST reuse the cached concept inventory and only re-pack concepts into the user’s chosen N without re-indexing.
- **FR-007**: Changing only the block count MUST NOT invalidate cached inventory; changing uploaded file OR study focus notes MUST invalidate cached inventory and any displayed recommendation.
- **FR-008**: Users who skip recommendation MUST retain the current manual block entry and generate flow.
- **FR-009**: Feature scope v1 is RSVP mode only; Questions, Slow, Cloze, and review flows MUST NOT show the recommend action.

### Key Entities

- **BlockCountRecommendation**: Suggested N, short reasoning text, timestamp, and flags indicating which signals were used.
- **ConceptInventoryCache**: Indexed concepts for the current create-session material, tied to file identity and study focus notes; validity rules for reuse vs invalidation.
- **CreateSessionMaterialContext**: Uploaded material reference, optional study focus notes, and any precomputed free signals (text metrics, pedagogical metadata, section tree).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In a typical session where the user requests recommendation then generates blocks, concept indexing runs **once** (not twice) — verifiable by user-visible progress or equivalent observability.
- **SC-002**: At least **80%** of test documents (short, medium, long samples in QA) receive a recommended N within platform limits without user correction for obviously wrong cases (e.g., 20 blocks for a 2-page handout).
- **SC-003**: Users who request recommendation can reach the block confirmation screen in **under 60 seconds** for medium documents on a stable connection (excluding user think time).
- **SC-004**: After file or study-notes change, **100%** of QA cases show cleared/invalidated recommendation state before a new recommend request.
- **SC-005**: Manual-only users (no recommend click) complete block generation with **no regression** in success rate compared to pre-feature behavior.

## Assumptions

- Platform block limits remain 5–60 for v1.
- Concept indexing quality and cost profile are acceptable for an explicit user action (same order of magnitude as today’s first phase of block generation).
- Free signals (text metrics, pedagogical metadata, sections) are often already computed during document upload for flow recommendation; when absent, the formula degrades gracefully.
- Exact formula coefficients and weighting are defined during planning; this spec constrains inputs and behavior, not the formula algebra.
- Questions mode may adopt the same pattern in a future version; v1 intentionally limits scope to RSVP to reduce confusion with review flows.
- UI copy for the recommend action and explanation is in English to match existing create-screen conventions.

## Dependencies

- Existing RSVP block creation pipeline (concept inventory → pack into N blocks → graph).
- Existing document upload normalization and optional pedagogical metadata from document hierarchy.
- Existing text analysis metrics available without additional AI calls on upload.

## Out of Scope (v1)

- Automatic recommendation on upload without user action.
- Second AI call dedicated to choosing block count.
- Questions, Slow, Cloze, or post-session review modes.
- Recommending questions-per-block counts (only block count N).
- Persisting recommendation across browser sessions or devices.

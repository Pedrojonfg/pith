# Feature Specification: Assessment-Informed Block Content

**Feature Branch**: `20260523-assessment-informed-blocks`

**Created**: 2026-05-23

**Status**: Draft (clarified)

**Input**: Initial assessment results should shape each study block’s explanation depth and question focus—not only question counts.

## Clarifications

### Session 2026-05-23

- Q: When assessment shows mastery, what should change in the study block? → A: **B + C (C priority)** — vary explanation profile by mastery; session questions must target identified gaps with higher focus/difficulty, not only fewer questions.
- Q: What signal drives gap-focused questions? → A: **C (gap synthesis call) + optional D** — DeepSeek summarizes gaps from assessment responses; user may optionally confirm/edit gaps in UI before generation. C must stay fast in the flow.
- Q: How to fit optional D and fast C before block generation? → A: **B (parallel, single screen)** — no extra screen; results view includes optional gap editor (D) while C runs in background; up to ~30s wait acceptable if prompt quality requires it.
- Q: Explanation for **strong** blocks vs current thorough (400–600 words)? → A: **Dense recap ~150–220 words** — definitions, key formula/expression, one micro-example; no linear re-teach of the material.
- Q: How should **weak** blocks use the gap list for session questions? → A: **≥1 question per listed gap** (test or socratic); explanation remains thorough.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Personalized block after assessment (Priority: P1)

A student completes the optional initial assessment. On the results screen they see a gap summary, may optionally edit it, then accepts and starts studying. Each block’s generated content reflects their mastery: brief dense recap where strong, thorough teaching where weak, and questions explicitly covering each flagged gap on weak blocks.

**Why this priority**: Delivers the core value—assessment changes what they read and practice, not only how many MCQs appear.

**Independent Test**: Run assessment with intentional misses on one block; accept; verify that block’s generated explanation is thorough and questions reference missed topics; verify a strong block gets a shorter explanation.

**Acceptance Scenarios**:

1. **Given** assessment completed with per-block strong/weak/ok classifications, **When** the user accepts results without editing gaps, **Then** block generation uses synthesized gap list (C) plus per-block profiles before the first block is generated.
2. **Given** the results screen is shown, **When** C is still running, **Then** the user can read results and optionally open/edit gaps (D) without navigating to a new screen.
3. **Given** the user skips gap editing and C completes within 30s, **When** they accept, **Then** generation starts using C output merged with block classifications.
4. **Given** C fails or times out, **When** the user accepts, **Then** generation falls back to block-level strong/weak/ok only (no gap list), and the session remains usable.

---

### User Story 2 - Optional gap confirmation (Priority: P2)

A student disagrees with auto-detected gaps. On the same assessment results view they expand an optional panel, edit or remove gaps per block, then accept.

**Why this priority**: Reduces false personalization without blocking the fast path.

**Independent Test**: Complete assessment; add/remove a gap in D; verify the generation prompt reflects the edited list.

**Acceptance Scenarios**:

1. **Given** C returned a gap list, **When** the user edits gaps in D and accepts, **Then** the confirmed list overrides C for generation (C fills defaults only where D left gaps empty).
2. **Given** the user never opens D, **When** they accept, **Then** the synthesized gap list from C is used as-is.

---

### User Story 3 - Skip assessment unchanged (Priority: P3)

A student skips the initial assessment. Block generation behaves as today (session defaults for all blocks; thorough explanations).

**Why this priority**: Preserves existing flow and offline expectations.

**Independent Test**: Skip assessment; confirm no gap synthesis call and default explanation/question rules.

**Acceptance Scenarios**:

1. **Given** assessment skipped, **When** studying starts, **Then** no gap synthesis runs and all blocks use default `n_test` / `n_socratic` and thorough explanations.

---

### Edge Cases

- Assessment with zero questions or all skipped: treat as no gap signal; block-level adjustments only if classifications exist, else defaults.
- Weak block with zero gaps listed: use thorough explanation and session-default question counts (no ≥1-per-gap constraint).
- Weak block with more gaps than max question budget (5 test + 3 socratic): prioritize gaps with assessment misses first; cap at platform limits with warning in dev console.
- Strong block: recap explanation may be short; questions may be reduced but need not be zero unless product later specifies (out of scope for v1 unless aligned with existing strong config).
- User accepts before C finishes: wait up to 30s with visible progress; then proceed with partial/fallback.
- API key missing during C: skip C; use D-only if user provided edits, else classification fallback.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: After a completed assessment, the system MUST run a gap-synthesis step (C) that consumes assessment responses and outputs a structured per-block gap list (short labels, optional miss evidence).
- **FR-002**: The assessment results UI MUST be a single screen (no extra route) showing score summary, block heatmap, optional collapsible gap editor (D), and accept action.
- **FR-003**: Gap editor (D) MUST be optional and skippable; default collapsed or low-friction so the fast path is accept-only.
- **FR-004**: Gap synthesis (C) MUST run in parallel with the results UI; total wait before generation MUST NOT exceed 30 seconds under normal API conditions (user-accepted tradeoff).
- **FR-005**: On accept, the system MUST persist `session._meta.assessment` including gap list (confirmed or synthesized), block classifications, and per-block pedagogical profile.
- **FR-006**: Each block MUST carry a generation profile used by block JSON generation, minimally: `explanation_profile` (`thorough` | `brief_deep`) and `gap_focus[]` (strings).
- **FR-007**: **Strong** blocks MUST request `brief_deep` explanations (~150–220 words): dense definitions, key formula/expression, one micro-example; MUST NOT use the 400–600 word thorough teach prompt.
- **FR-008**: **Weak** blocks MUST request `thorough` explanations (existing depth target) AND MUST generate at least one question per entry in `gap_focus[]` for that block (test or socratic).
- **FR-009**: **Ok** blocks MUST use session-default explanation and question rules unless gaps were explicitly listed for that block.
- **FR-010**: Block generation prompts MUST include gap focus instructions for question targeting (application, common errors, prerequisite links)—not only `n_test` / `n_socratic` counts.
- **FR-011**: If assessment is skipped, the system MUST NOT call gap synthesis and MUST NOT apply assessment-derived profiles.
- **FR-012**: Session export (`.md`) MUST include assessment score, strong/weak blocks, and summarized gap list when present.

### Key Entities

- **AssessmentResults**: `perBlock` classifications, `responses[]`, totals, optional `skipped`.
- **GapList**: Per block id → array of `{ label, source?: "synthesis" | "user", fromQuestionId? }`.
- **BlockPedagogicalProfile**: `explanation_profile`, `gap_focus[]`, `n_test`, `n_socratic` (counts may still vary by classification).
- **BlockContent** (generated): `explanation`, `questions[]`, `concepts[]` as today, shaped by profile.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users who complete assessment reach the first study block within 30s of tapping accept (p95), including gap synthesis.
- **SC-002**: On weak blocks with ≥1 listed gap, 100% of generated blocks include at least one question clearly aligned to each gap (manual review sample or structured self-check in prompt).
- **SC-003**: Strong blocks generate explanations within 150–220 word target band in 80% of samples (spot-check).
- **SC-004**: Skip-assessment path behavior unchanged vs pre-feature (regression checklist).
- **SC-005**: Optional gap editor used in &lt;40% of sessions is acceptable; fast path requires no mandatory edits.

## Assumptions

- DeepSeek API remains the generator; gap synthesis uses a lightweight dedicated prompt (max_tokens bounded).
- Block-level strong/weak/ok thresholds remain as today unless a separate change revises them.
- Single-file / no-backend constraints from project constitution still apply; state stored in session JSON + localStorage.
- Flutter portability: profiles stored in session schema, not only `window.*` globals (migration acceptable in same feature).
- Strong-block question counts follow existing assessment apply rules until explicitly revised in implementation plan.

## Out of Scope (v1)

- Concept-level tagging inside assessment questions (finer than block id) unless synthesis infers it.
- Re-generating a block mid-session when user edits gaps retroactively.
- Changing RSVP engine behavior beyond shorter/longer explanation text.

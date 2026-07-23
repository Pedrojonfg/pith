# Feature Specification: Onboarding Questionnaire + Mode Recommendation

**Feature Branch**: `20260724-mode-recommendation`

**Created**: 2026-07-23

**Status**: Draft

**Input**: User description: "Onboarding questionnaire (5 questions) after scope selection, pure mode-recommendation algorithm populating `#recommendationPanel`, and durable per-document `studentIntent` prompt injection — see `20260723-mode-recommendation-algorithm-spec.md`"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Answer onboarding and get a recommended study flow (Priority: P1)

After choosing document scope, the learner answers four mandatory preference questions and an optional free-text goal. When they reach mode select, they see a clear recommended flow (ordered modes) with a short explanation and a Start button for the first mode. Manual mode picking remains available as fallback.

**Why this priority**: Without this, the recommendation panel stays empty and learners get no guided path from their preferences + document signals.

**Independent Test**: Complete scope → questionnaire → mode select for a sample document; verify panel shows flow + reasoning and Start enters `flow[0]`.

**Acceptance Scenarios**:

1. **Given** scope is resolved and onboarding not yet answered, **When** the learner reaches the post-scope gate, **Then** they see the Onboarding Questionnaire screen (not labeled “test” or “assessment”) with R-Q1–R-Q5.
2. **Given** all four closed questions are answered, **When** the learner submits (with or without free-text intent), **Then** responses and optional intent are stored once on the document and they proceed toward mode select.
3. **Given** questionnaire answers and required document signals are available, **When** mode select opens, **Then** `#recommendationPanel` shows the recommended ordered modes, a short human-readable reason, and Start for the first recommended mode.
4. **Given** a recommendation is shown, **When** the learner ignores Start and picks another mode manually, **Then** they can still enter that mode (fallback preserved).

---

### User Story 2 - Preferences tune how study modes behave (Priority: P1)

Questionnaire answers change not only which modes appear, but also parameters: fewer blocks when in a hurry (for Read/RSVP), Socratic on/off and turn budgets, and the mix of test vs Socratic questions when Questions is the memorization mode.

**Why this priority**: Flow order alone is insufficient; pace and Socratic comfort are the main reasons for the questionnaire.

**Independent Test**: Fixture-drive the pure recommender with each branch of the decision rules; verify multipliers, Socratic gate, turn-cap override, and ratio outputs.

**Acceptance Scenarios**:

1. **Given** pace = urgent and theory mode is Read or RSVP, **When** recommendation is computed, **Then** block-count multiplier is the urgent placeholder (< 1.0), never > 1.0 in v1.
2. **Given** Socratic modality = avoid, **When** recommendation is computed, **Then** Socratic is disabled and ratio/caps do not enable Socratic slots even if the learner chose “understand”.
3. **Given** Socratic modality = text and Socratic is enabled, **When** recommendation is computed, **Then** turn caps are reduced by the placeholder text-modality reduction (floored per rules).
4. **Given** memorization preference memorize vs understand/both, **When** recommendation is computed, **Then** memorization mode is Cloze vs Questions respectively, and Questions gets a non-null Socratic ratio when Socratic is enabled.

---

### User Story 3 - Student intent steers generative prompts (Priority: P2)

Optional free-text intent collected at onboarding is injected into high-priority generative prompts so explanations, tutors, guide chat, recall, packing, and review batches can calibrate examples and depth — without inventing facts absent from the source.

**Why this priority**: Intent is valuable but secondary to getting a correct flow and parameters on screen.

**Independent Test**: With non-null intent, assert labeled appendix appears in constructed prompts for each high-priority site; with null, appendix is absent.

**Acceptance Scenarios**:

1. **Given** `studentIntent` is non-empty, **When** a high-priority prompt is built, **Then** a labeled STUDENT INTENT appendix is included once.
2. **Given** `studentIntent` is null/empty, **When** the same prompt is built, **Then** no empty intent block is injected.
3. **Given** intent is set, **When** fidelity/fairness-critical calls run (pre-packing assessment, claim extract, cloze pipeline, hierarchy build, vault extract/normalize, merge/dedup audits), **Then** intent is not injected.

---

### User Story 4 - Practice appears in the flow when ontology matches (Priority: P2)

If the document has a matched practice-ontology scope, Practice is inserted in the recommended flow immediately after the theory mode, independent of questionnaire answers.

**Why this priority**: Practice inclusion is valuable when the sibling practice-ontology feature is present; when absent, flow still works without Practice.

**Independent Test**: Compute recommendation with match status full/partial vs none/missing; Practice appears only when matched.

**Acceptance Scenarios**:

1. **Given** practice match status is full or partial, **When** flow is assembled, **Then** Practice sits immediately after theory mode.
2. **Given** practice match is none or practice prep is missing, **When** flow is assembled, **Then** Practice is omitted and the rest of the flow still forms.

---

### Edge Cases

- Questionnaire shown while document preparation may still be incomplete: answers persist immediately; recommendation computes when both answers and required signals exist (whichever finishes last).
- Missing diagram/visual-density signal: theory-mode override for diagram-heavy docs is skipped in v1 (no new detection).
- Missing practice-ontology data on this branch: treat as unmatched; do not block shipping.
- Existing flow-panel / tracker fields on `modeRecommendation` (`primaryFlow`, progress, override) must keep working; algorithm output maps into that UX contract additively.
- Learner never edits onboarding answers or intent after submit (no edit UI, no rewrite APIs).
- Closed questions are always shown even when Practice is unavailable.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST present an Onboarding Questionnaire screen after scope resolution and before mode select, with four mandatory closed questions (Socratic modality, pace, memorization vs understanding, source vs explained) and one optional free-text student intent field. UI copy MUST NOT use the words “test” or “assessment” for this screen.
- **FR-002**: System MUST persist `onboardingResponses` (four enums + `answeredAt`) and optional `studentIntent` on the document shared layer exactly once at submit time, with validation rejecting malformed enums/types; defaults are null until answered.
- **FR-003**: System MUST NOT provide edit/rewrite paths for onboarding responses or student intent after `answeredAt` is set.
- **FR-004**: System MUST compute mode recommendation via a pure, side-effect-free function from onboarding responses + document text metrics / pedagogical meta + practice match status, producing an ordered flow, parameter bundle, human-readable reasoning, and timestamp.
- **FR-005**: Theory mode MUST follow: original source → Slow; explained/indifferent → RSVP if urgent else Read. Diagram-heavy override is out of scope for v1 if no existing signal exists.
- **FR-006**: Memorization mode MUST be Cloze when preference is memorize, else Questions.
- **FR-007**: When practice match status indicates a matched domain (full or partial), Practice MUST be inserted immediately after theory mode; otherwise Practice MUST be omitted. Match status is consumed as input only (ontology matching itself is out of scope).
- **FR-008**: Flow MUST assemble as `[theory, optional practice, memorization]`.
- **FR-009**: Pace urgent MUST apply a named placeholder block-count multiplier (< 1) only when theory mode is Read or RSVP; moderate/deep use 1.0; v1 MUST NOT increase block count via this multiplier.
- **FR-010**: Socratic modality avoid MUST hard-disable Socratic across the recommended experience (no Socratic slots/turns), overriding understand/both preferences for Socratic generation.
- **FR-011**: When Socratic is enabled and modality is text, turn caps MUST be reduced by a named placeholder amount with floors (follow-ups ≥ 0, total learner turns ≥ 1); voice leaves existing defaults unmodified.
- **FR-012**: When Socratic is enabled and memorization mode is Questions, system MUST set a named placeholder Socratic ratio for both vs understand; when Cloze or Socratic disabled, ratio is null / not applicable.
- **FR-013**: Recommendation parameters MUST wire into existing consumers without duplicating resolution logic: block-count recommender multiplier, question-config chokepoint for `n_test`/`n_socratic`, and Socratic loop config overrides when that module is present.
- **FR-014**: Mode select `#recommendationPanel` MUST render the recommended flow and reasoning and offer Start on the first flow mode, preserving the manual mode picker fallback. Existing flow progress/override behavior MUST remain intact via additive mapping onto the current recommendation object contract (`primaryFlow` / tracker fields).
- **FR-015**: System MUST inject non-null `studentIntent` into high-priority generative prompts (block generation, Socratic tutors, guide chat, recall questions, pack-to-blocks notes channel, review batch) using a labeled appendix; MUST omit the appendix when null; MUST NOT inject into fidelity/fairness-critical sites listed in Assumptions.
- **FR-016**: Questionnaire MUST NOT block document-preparation work that can already run; answers persist immediately and recommendation waits for the later of answers vs required signals.
- **FR-017**: All numeric tuning constants MUST be named exported placeholders (e.g. pace multiplier, text-modality turn reduction, Socratic ratios) for later calibration without logic changes.
- **FR-018**: Terminology in code, comments, and UI for this screen MUST use `onboardingQuestionnaire` / “Onboarding Questionnaire”, never “test”/“assessment” for this feature.

### Key Entities

- **OnboardingResponses**: Per-document learner preferences (Socratic modality, pace, memorization vs understanding, source vs explained, answeredAt).
- **StudentIntent**: Optional durable free-text goal/relationship to the topic for this document; distinct from ephemeral studyNotes.
- **ModeRecommendation**: Recommended ordered study flow, parameter bundle (block multiplier, Socratic flags/caps/ratio), reasoning text, compute timestamp; mapped additively onto the existing recommendation object used by the flow panel/tracker.
- **PracticeMatchStatus**: Consumed status (`full` | `partial` | `none` | missing) indicating whether Practice belongs in the flow.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After scope, 100% of new-document sessions that reach mode select either completed onboarding or were blocked on the questionnaire until the four closed questions were answered.
- **SC-002**: For every decision-rule branch (theory, practice include/omit, memorization, Socratic avoid override, pace multiplier, text-cap reduction, ratio), fixture tests produce the exact expected flow/params (100% branch coverage of the pure function).
- **SC-003**: Learners can start the first recommended mode from the panel in one action; manual mode entry remains available without removing the recommendation.
- **SC-004**: When student intent is provided, high-priority generative prompts include the intent appendix; when absent, those prompts are unchanged in structure (no empty appendix).
- **SC-005**: Existing flow-panel progress and user-override behavior continues to work for sessions that already store `primaryFlow`-shaped recommendations (no regression in tracker semantics).
- **SC-006**: End-to-end manual QA can exercise at least one path per theory mode (Slow, RSVP, Read) and per memorization mode (Cloze, Questions), with and without practice match.

## Assumptions

- Source product decisions and algorithm rules come from `20260723-mode-recommendation-algorithm-spec.md` and the student-intent audit `specs/audits/student-intent-integration-points.md`.
- **OQ1 resolved (addendum 2026-07-24):** `shared.images` (DPP T1.7 extraction) is the diagram signal. R-FLOW-1b is implemented: urgent RSVP → Read when in-scope image count ≥ `IMAGE_DENSITY_THRESHOLD`. Images are document-wide; count filters to `![pith-image:id]` tokens in `scopedMarkdown` (OQ-addendum-1).
- **OQ2 resolved**: Current `modeRecommendation` is a rich object (`primaryFlow`, `quickFlow`, progress, override, `reasoning`, …). Additive extension is safe; replacing/removing `primaryFlow` is not. Implementation maps algorithm `flow[]` into `primaryFlow` steps and stores new `params` alongside.
- **OQ3 resolved**: Scope selection currently *pauses* Tier-1 rather than running DPP behind the scope screen. True background work today is Tier-2 kickoff after mode-select entry. Questionnaire inserts after scope confirm using the same gate/showScreen pattern; recommendation compute runs when answers + Tier-1 signals are ready (may continue prep concurrently where already supported, without inventing a new background scheduler).
- **OQ4 resolved**: Practice match lives at `shared.practicePrep.scope.matchStatus` with enum `full` | `partial` | `none` (sibling feature `20260723-practice-ontology`). If missing on this branch, treat as unmatched.
- **OQ5 resolved**: `n_test` / `n_socratic` resolve through `resolveBlockQuestionConfig` in `session.js`. Wire `socraticRatio` at that chokepoint (or session defaults feeding it), not at every API call site.
- **OQ6 resolved**: Default Socratic caps live in `SOCRATIC_LOOP_CONFIG` (`pedagogy/socratic-loop-config.js` on sibling `20260722-socratic-multi-turn`): RSVP/Read `baseFollowUpCap = 1`; Recall/Review `baseFollowUpCap = 2`. R-PARAM-3 maps to reducing `baseFollowUpCap` (and derived total learner turns), not a separate `totalTurns` field if that API is absent.
- `studyNotes` remains a separate ephemeral channel; studentIntent uses the labeled appendix template specified in the algorithm spec and does not merge channels.
- Medium-priority intent injection (inventory/split, Slow Phase 0 guide framing) may ship in the same feature if low-cost after high-priority sites; otherwise deferred without blocking P1.
- Placeholder constant examples: urgent block multiplier ~0.7; text-modality turn reduction 1; Socratic ratios ~0.5 (both) / ~0.7 (understand) — exact values are calibratable placeholders.
- Non-goals from the algorithm spec remain out of scope: practice/theory content-overlap coordination, building practice ontology matching, cross-document profiles, post-submit editing, new visual-density detection, exact numeric calibration.

## Out of Scope

- Practice ontology domain-matching implementation
- Theory/practice content-overlap deduplication
- Cross-document student profile
- Editing onboarding answers or student intent after submit
- New diagram/visual-density detection
- Calibrating final numeric thresholds beyond named placeholders

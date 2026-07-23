# Research: Mode Recommendation Onboarding

## Decision: Additive `modeRecommendation` mapping (not replacement)

**Decision**: Keep existing `primaryFlow` / tracker fields. New onboarding algorithm produces `{ flow, params, reasoning, computedAt }`, then a mapper builds/updates `primaryFlow` steps from `flow[]` and attaches `params` + onboarding `reasoning` (or merges with genre reasoning).

**Rationale**: OQ2 — consumers (`renderFlowPanel`, `tracker.js`, `hasValidModeRecommendation`) require `primaryFlow`. Additive fields are safe; removing `primaryFlow` is not.

**Alternatives considered**:
- Replace shape with `flow[]` only → breaks panel/tracker.
- Parallel `onboardingRecommendation` field → duplicates panel wiring.

## Decision: New pure module `onboarding-recommender.js`

**Decision**: Implement `computeOnboardingModeRecommendation(...)` + named constants in a new file; leave genre-based `recommender.js` intact; orchestrate in study/DPP to prefer onboarding result when `onboardingResponses` present.

**Rationale**: Clear fixture surface; avoids entangling genre decision table with questionnaire rules.

**Alternatives considered**: Inline into `recommender.js` → harder to test/branch; higher regression risk.

## Decision: No R-FLOW-1b in v1

**Decision**: Skip diagram-density theory override. Log follow-up in quickstart / `a_implementar` note.

**Rationale**: OQ1 — no signal on `textMetrics` / `pedagogical_meta` (NG6).

## Decision: Questionnaire gate after scope confirm

**Decision**: After `applyScopeSelectionToDoc` / when entering post-scope path, if `onboardingResponses` is null, `showScreen("onboardingQuestionnaire")`. On submit, write fields once, then continue `enterModeSelectAfterTier1Gate` / Tier-1 ensure. Do not invent a new background scheduler; reuse existing prep ensure/kickoff.

**Rationale**: OQ3 — scope currently pauses Tier-1; Tier-2 is the true background pattern after mode select.

**Alternatives considered**: Run full Tier-1 behind questionnaire unconditionally → larger pipeline change, out of scope.

## Decision: Practice match soft dependency

**Decision**: Read `shared.practicePrep?.scope?.matchStatus`; include Practice when `"full"` or `"partial"`; otherwise omit.

**Rationale**: OQ4 — field defined on sibling practice-ontology branch; missing ⇒ unmatched.

## Decision: Wire ratio via `resolveBlockQuestionConfig`

**Decision**: When `modeRecommendation.params.socraticEnabled === false`, force `n_socratic = 0`. When `socraticRatio` is a number and Socratic enabled, split total question budget by ratio at the chokepoint (then existing clamps).

**Rationale**: OQ5 — single resolution path; avoid patching every API caller.

## Decision: Socratic turn-cap soft dependency

**Decision**: If `pedagogy/socratic-loop-config.js` exists, apply text-modality reduction to `baseFollowUpCap` via override from `params.socraticTurnCapOverride` / helper. If module absent, store params for future consumers and skip runtime override.

**Rationale**: OQ6 — caps live on sibling branch; shipping questionnaire must not hard-fail.

## Decision: Shared `buildStudentIntentAppendix(studentIntent)` helper

**Decision**: One helper returning `null` or the labeled block; high-priority call sites append when non-null. Medium-priority sites optional same wave if cheap.

**Rationale**: Audit + FR-015; avoid duplicate wording drift.

## Decision: No schemaVersion bump

**Decision**: Nullable additive fields like `scopeContext` precedent.

**Rationale**: Spec §3; validation only when present.

# Research: Assessment-Informed Block Content

**Feature**: `20260523-assessment-informed-blocks`  
**Date**: 2026-05-23

## R1 — Gap synthesis API shape

**Decision**: New `synthesizeAssessmentGaps()` in `src/js/api.js` returns strict JSON:

```json
{
  "gaps_by_block": {
    "1": [{ "label": "string", "evidence": "optional short" }]
  },
  "notes": "optional single line"
}
```

**Rationale**: Structured output is parseable, storable in `session._meta.assessment.gaps`, and injectable into block-generation prompts. Reuses existing `parseModelJsonValue` + `response_format: { type: "json_object" }` pattern from `deepSeekGenerateBlockJson`.

**Alternatives considered**:
- Reuse `generateAssessmentSynthesis` prose only — rejected; not machine-mergeable with editor D.
- Per-question heuristics without LLM — rejected; misses conceptual gap labeling user wanted from good prompts.

## R2 — When to call gap synthesis (step C)

**Decision**: Fire C immediately when `showAssessmentResults()` mounts; show “Analysing gaps…” in the same overlay. Coach synthesis (`generateAssessmentSynthesis`) remains optional UI text; C is authoritative for `gap_focus`.

**Rationale**: Parallel with optional D editor satisfies FR-004; user can wait up to 30s on Accept if C still pending.

**Alternatives considered**:
- C only after Accept — rejected; blocks Accept latency entirely.
- C bundled into first block generation — rejected; duplicates work per block and breaks weak ≥1-per-gap upfront planning.

## R3 — Pedagogical profile on `_config`

**Decision**: Extend `blocks[i]._config`:

```js
{
  n_test: number,
  n_socratic: number,
  explanation_profile: "thorough" | "brief_deep",
  gap_focus: string[]  // labels only, max 8 per block
}
```

Set in `applyAssessmentResults()` from `perBlock` classification + merged gap list.

| Classification | explanation_profile | n_test / n_socratic (v1) |
|----------------|--------------------|-------------------------|
| strong | brief_deep | 1 test, 0 socratic (align `applyAssessmentResults`) |
| weak | thorough | defaults; bump `n_socratic` +1 capped 3; ensure `n_test + n_socratic >= gap_focus.length` when gaps exist |
| ok | thorough | session defaults |

**Rationale**: Single resolver `resolveBlockQuestionConfig()` already centralizes counts; extend same function to return full profile for prompts.

**Alternatives considered**:
- Separate `session.profiles[]` array — rejected; duplicates block index coupling.

## R4 — Block generation prompt branching

**Decision**: Parameterize `deepSeekGenerateBlockJson` system prompt sections:

- **thorough**: keep 400–600 word teach directive.
- **brief_deep**: 150–220 words, dense recap template (definitions, key formula, one micro-example).
- **gap_focus**: bullet list in user message; require ≥1 question per gap on weak blocks; questions must target application/common errors.

**Rationale**: Minimal change surface—one API function, conditional prompt strings.

**Alternatives considered**:
- Second pass to shorten strong explanations — rejected; wastes tokens and RSVP coherence.

## R5 — Results UI (single screen, optional D)

**Decision**: Refactor `showAssessmentResults` in `study.js`:

1. Heatmap + score (existing).
2. Collapsible `<details>` “Review gaps (optional)” with per-block chip inputs (add/remove labels).
3. Status line for C: `pending | ready | failed | timeout`.
4. Accept disabled until C completes OR 30s timeout (then fallback).
5. On Accept: `mergeGaps(synthesis, userEdits)` → `applyAssessmentResults({ ..., gaps })` → `startStudyingNow`.

**Rationale**: No new route; satisfies FR-002/003.

## R6 — State portability (Flutter)

**Decision**: Persist gaps and profiles only on `sessionObj` / `localStorage`; stop writing new logic on `window.assessmentResults` except ephemeral UI during assessment (existing pattern may remain for backward compat but `applyAssessmentResults` reads passed object).

**Rationale**: Spec assumption; reduces migration pain.

## R7 — Timeouts and fallback

**Decision**: Client timeout 30s on C (`AbortController` or `Promise.race`). On failure: `gap_focus: []`, profiles from classification only, `config_adjustments_applied: true`, log warning.

**Rationale**: FR-004 and edge cases in spec.

## R8 — Question budget vs gap count

**Decision**: When `gap_focus.length > n_test + n_socratic`, raise counts: `n_test = min(5, max(n_test, ceil(gaps * 0.6)))`, `n_socratic = min(3, max(n_socratic, gaps - n_test))` capped at 8 total questions.

**Rationale**: Satisfies FR-008 within platform limits.

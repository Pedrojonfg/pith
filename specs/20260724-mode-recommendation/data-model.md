# Data Model: Mode Recommendation Onboarding

## `shared.onboardingResponses`

```ts
type OnboardingResponses = {
  socraticModality: "voice" | "text" | "avoid";
  pace: "deep" | "moderate" | "urgent";
  memorizationVsUnderstanding: "memorize" | "both" | "understand";
  sourceVsExplained: "original" | "explained" | "indifferent";
  answeredAt: number; // ms epoch
} | null;
```

- Default: `null` in `createSession`
- Validate when non-null: all four enums + finite `answeredAt`
- Write-once after submit (NG4)

## `shared.studentIntent`

```ts
type StudentIntent = string | null;
```

- Default: `null`
- Validate: `string | null` only
- Write-once with questionnaire submit
- Empty string on submit → store `null` (omit appendix)

## `shared.modeRecommendation` (additive)

Existing fields retained (`primaryFlow`, `quickFlow`, `reasoning`, `currentStepIndex`, `completedSteps`, `userOverride`, `analysis`, `method`, `computedAt`, …).

**New / algorithm-owned fields:**

```ts
params?: {
  blockCountMultiplier: number;
  socraticEnabled: boolean;
  socraticTurnCapOverride: { followUps: number; totalTurns: number } | null;
  socraticRatio: number | null;
};
onboardingFlow?: Array<"slow" | "read" | "rsvp" | "practice" | "cloze" | "questions">;
```

When onboarding responses exist, orchestration sets:
- `onboardingFlow` from pure algorithm
- `params` from pure algorithm
- `primaryFlow` steps derived from `onboardingFlow` (labels/descriptions via existing `MODE_TEMPLATES` / practice template)
- `reasoning` from algorithm (human-readable)
- `computedAt` updated
- `method: "onboarding"` (or similar discriminant)

## Practice match input (read-only)

`shared.practicePrep?.scope?.matchStatus`: `"full" | "partial" | "none"` | missing

## Constants (named placeholders)

| Name | Example | Rule |
|------|---------|------|
| `PACE_URGENT_BLOCK_MULTIPLIER` | 0.7 | R-PARAM-1 |
| `TEXT_MODALITY_TURN_REDUCTION` | 1 | R-PARAM-3 |
| `SOCRATIC_RATIO_BOTH` | 0.5 | R-PARAM-4 |
| `SOCRATIC_RATIO_UNDERSTAND` | 0.7 | R-PARAM-4 |

## Validation summary

| Field | Invalid if |
|-------|------------|
| `onboardingResponses` | wrong type, missing enum, bad enum, non-number `answeredAt` |
| `studentIntent` | non-string non-null |
| `modeRecommendation.params` | present but wrong types (optional lax/strict per existing validation style) |

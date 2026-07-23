# Contract: `computeOnboardingModeRecommendation`

## Signature

```js
computeOnboardingModeRecommendation({
  onboardingResponses,
  textMetrics,          // optional; unused in flow rules
  pedagogicalMeta,      // optional; unused in flow rules
  practiceMatchStatus,  // "full"|"partial"|"none"|null
  images,               // shared.images (document-wide)
  scopedMarkdown,       // study scope text; tokens filter image count
}) → {
  flow: ModeId[],
  params: {
    blockCountMultiplier: number,
    socraticEnabled: boolean,
    socraticTurnCapOverride: { followUps: number, totalTurns: number } | null,
    socraticRatio: number | null,
  },
  reasoning: string,
  computedAt: number,
}
```

Pure: no I/O, no mutation of inputs. Fixture-tested.

Named placeholders: `PACE_URGENT_BLOCK_MULTIPLIER`, `TEXT_MODALITY_TURN_REDUCTION`, `SOCRATIC_RATIO_BOTH`, `SOCRATIC_RATIO_UNDERSTAND`, `IMAGE_DENSITY_THRESHOLD`.

## Rules (must match fixtures)

1. Theory: `original`→`slow`; else `urgent`→`rsvp` else `read`
1b. If theory is `rsvp` and `countScopedImages(images, scopedMarkdown) >= IMAGE_DENSITY_THRESHOLD` → override to `read` (never touches `slow` or already-`read`)
2. Practice: include iff matchStatus ∈ {full, partial}, after theory
3. Memorization: `memorize`→`cloze` else `questions`
4. `blockCountMultiplier`: urgent + theory ∈ {rsvp,read} → `PACE_URGENT_BLOCK_MULTIPLIER` else `1`
5. `socraticEnabled`: false iff modality `avoid`
6. Turn cap override: only if enabled && modality `text`; else null. Defaults assumed: RSVP/Read 1/2, used as base for override math when building override object for Questions path consumers; store `{ followUps, totalTurns }` per spec mapping from `baseFollowUpCap`.
7. `socraticRatio`: null if !enabled or cloze; else BOTH/UNDERSTAND placeholders

**Image count (OQ-addendum-1):** `shared.images` is document-wide. `countScopedImages` counts only `![pith-image:id]` tokens present in `scopedMarkdown`. If `scopedMarkdown` is omitted/null, falls back to `images.length`.

## Mapper to existing recommendation

```js
mapOnboardingRecommendationToModeRecommendation(algoResult, existing = null)
```

Produces object with `primaryFlow` steps from `flow`, `params`, `reasoning`, `method: "onboarding"`, preserves progress fields from `existing` when modes still align (or reset index if flow identity changed).

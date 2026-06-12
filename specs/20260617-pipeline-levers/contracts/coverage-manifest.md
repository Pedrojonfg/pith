# Contract: Coverage Manifest (L16, L22)

**Feature**: `20260617-pipeline-levers` | **Levers**: L16, L22 | **Priority**: P1

## Storage

```javascript
session._meta.coverageManifest = CoveredClaim[];  // append-only
```

## CoveredClaim shape

```typescript
{
  blockId: number;
  claimType: "definition" | "argument" | "example" | "contrast";
  keyTerms: string[];
  questionAsked: string;
}
```

## Population (after block questions generated)

1. **Heuristic path** (default): extract key terms from question text + infer claimType from question stem patterns (`¿qué es` → definition, `¿por qué` → argument).
2. **Optional LLM path**: `deepSeekExtractQuestionClaims(questions)` — post-MVP.

## Consumption

| Consumer | Parameter | Slice |
|----------|-----------|-------|
| `deepSeekGenerateBlockJson` (questions step) | `coverageManifest` | last 20 entries |
| `deepSeekRegenerateBlockQuestions` | `coverageManifest` | last 20 entries |
| L18 `alreadyQuestionedTerms` | denormalized from manifest | all keyTerms unique |

## Prompt rendering

Existing `renderCoverageManifestForPrompt(coverageManifest)` in `api.js` — ensure called when `blockIndex >= 1`.

## Regen contract (L22)

`deepSeekRegenerateBlockQuestions(explanation, chunk, blockConfig, sessionConfig, coverageManifest)` — parameter REQUIRED; pass `session._meta.coverageManifest ?? []`.

## Tests

- After generating block 1 questions → manifest length ≥ 1
- Block 2 prompt includes manifest entries from block 1
- Regen function receives same manifest as generation

## Idempotency

Re-generating same block replaces manifest entries for that `blockId` before append (avoid duplicates on regen).

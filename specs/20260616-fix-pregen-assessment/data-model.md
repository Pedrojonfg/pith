# Data Model: RSVP Pre-Generation Assessment Reliability

**Feature**: `20260616-fix-pregen-assessment`

## Entidades (sin cambios semánticos en knowledge_profile)

Reutiliza `PrePackingFlowState`, `AssessmentBlock`, `KnowledgeProfile` de `20260612-rsvp-assessment-questions-parity`. Este feature añade campos de control de prefetch y error UX.

### PrePackingFlowState (extended)

```typescript
interface PrePackingFlowState {
  // existing fields (conceptInventory, nBlocks, cleanedText, splitOpts, …)
  runnerMode?: "assessment" | null;
  assessmentBlock?: AssessmentBlock;
  assessmentItems?: AssessmentQuestion[];  // legacy path only
  itemsPromise?: Promise<AssessmentQuestion[]>;
  /** NEW — fingerprint of prefetch inputs; runner discards stale promise if mismatch */
  prefetchConfigKey?: string;
  /** NEW — last generation error message for retry UI */
  assessmentGenerationError?: string | null;
  assessmentSkipped?: boolean;
  knowledgeProfile?: KnowledgeProfile | null;
  // …
}
```

### PrefetchConfigKey (derived, ephemeral)

```typescript
// Built from:
// - resolvePrePackingQuestionConfig() → { n_test, n_socratic }
// - conceptInventory length + sorted concept ids hash (simple)
// - cleanedText length (or fingerprint already on flow)
type PrefetchConfigKey = string;
```

**Validation**: Runner MUST compare `prefetchConfigKey` before awaiting `itemsPromise`.

### AssessmentGenerationErrorState (UI)

| Field | Type | Notes |
|-------|------|-------|
| `message` | string | User-visible |
| `retryable` | boolean | true for LLM/network failures |
| `actions` | `"retry" \| "skip"` | Both always available when shown |

### Session metadata (unchanged)

On block confirm, `prePackingDraftMeta` still maps to:
- `assessment_skipped: true` when user skipped pre-generation
- `knowledge_profile` when completed

## State transitions (fixed flow)

```text
generate submit
  → runConceptInventory
  → prePackingFlow := { itemsPromise with CORRECT params, prefetchConfigKey }
  → enterPrePackingAssessmentRunner
      → await itemsPromise
      → [empty or error] → show error UI (NOT auto skip)
      → [success] → runnerMode=assessment → test/socratic screens
  → finishPrePackingAssessment | handlePrePackingSkip (explicit)
  → applyPackedBlocksToEditor
  → confirm blocks
  → goAfterBlocksConfirmed → session ready (NO legacy assessment)
```

## Invariants

1. Block editor MUST NOT appear before explicit complete or skip of knowledge check (or explicit skip from error UI).
2. `itemsPromise` resolved to `[]` MUST NOT be treated as success.
3. Post-confirmation MUST NOT show `screenInitialAssessment` when `isPrePackingAssessmentEnabled()`.

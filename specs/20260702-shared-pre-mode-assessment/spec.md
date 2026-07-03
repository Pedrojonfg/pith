# Spec: Shared Pre-Mode Assessment Layer

**Folder:** `specs/20260702-shared-pre-mode-assessment/`
**Supersedes:** `20260611-rsvp-assessment-reposition`
**Status:** Ready for implementation

## 1. Problem statement

The pre-packing assessment lives inside the RSVP mode-creation flow. Its purpose — avoid re-teaching what the learner already knows — is a cross-mode concern. Mode recommendation should account for learner prior knowledge, not just document properties.

## 2. Target behavior

- After Tier 1 DPP completes and **before** `screenModeSelect`, offer an **opt-in** assessment gate.
- Accept: run MCQ assessment, compute `knowledgeProfile`, store at `shared` level, recompute `modeRecommendation`, enter mode select.
- Skip: enter mode select with document-only recommendation.
- Redo assessment resets learner-progress artifacts per reset table; document-intrinsic artifacts survive.
- Interview-originated sessions never show the gate.

## 3. Non-goals

- Adaptive probing / EIG question selection
- Open-ended assessment questions
- Knowledge profile summary UI
- Personalizing Tier 2 artifacts by profile

## 4. Data model

### `shared.knowledgeProfile`

```
{
  computedAt: number,
  source: "assessment" | null,
  perConcept: { [canonicalId]: { mastery: "full"|"partial"|"none", confidence: number } },
  packProfile?: object  // legacy pack shape (byConceptId/items) for RSVP
}
```

### `shared.assessmentGate`

```
{ resolvedAt: number, outcome: "accepted" | "skipped" }
```

## 5. Redo reset table

KEEP: rawMarkdown, docMeta, docHierarchy, docTopics, conceptInventory, conceptGraph, images, textMetrics, blockRecommendation, slowOrientation, mergeProposals, uploadMeta, mnemonicDevices

RESET: knowledgeProfile, modeRecommendation, annotations, smItems, assessmentSignals, modes.*, assessmentGate

## 6. Assumptions (resolved open questions)

- **mnemonicDevices on redo:** KEEP (user-authored; aligned with mnemonic spec).
- **T1.5 timing:** Removed from Tier 1 gate batch; runs only after assessment gate resolves.
- **Redo entry point:** `screenModeSelect` only (document already open).
- **Interview guard:** `isInterviewOriginSession()` from `interview/origin.js`.

## 7. Testing checklist

- Skip path: document-only `modeRecommendation`
- Accept path: profile persisted, recommendation learner-aware
- RSVP packing reads `shared.knowledgeProfile`
- Redo wipes RESET fields, preserves KEEP fields
- Interview sessions skip gate
- RSVP-embedded assessment path removed

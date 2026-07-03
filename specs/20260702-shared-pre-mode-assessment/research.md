# Research: Shared Pre-Mode Assessment

## Q1: mnemonicDevices on redo

**Decision:** KEEP on redo.

**Rationale:** User-authored content per `20260619-mnemonic-devices`; same rationale as learner notes surviving document re-study. `shared-dpp-cache` also classifies mnemonicDevices as user-specific but not session-reset targets for document cache.

## Q2: T1.5 timing

**Decision:** Remove T1.5 from `TIER1_GATE_PHASE_IDS`; run via `runModeRecommendationPhase(doc, { knowledgeProfile })` after gate resolves.

**Rationale:** Avoids duplicate LLM/heuristic work; recommendation always reflects final profile state (including skip → null).

## Q3: Assessment call sites

**Decision:** Primary invocation moves from `study.js` RSVP `generateBlocks` (~9286) to shared gate in `enterModeSelectAfterTier1Gate`. API functions unchanged.

**Prefetch:** Gate flow prefetches items when user accepts (same `createPrePackingItemsPromise` pattern).

## Q4: Redo placement

**Decision:** `screenModeSelect` — "Retake knowledge check" with destructive confirm.

## Profile storage bridge

**Decision:** Store spec `perConcept` plus `packProfile` (existing `byConceptId`/`items` shape) for RSVP pack compatibility. Migrate `_meta.knowledge_profile` on read.

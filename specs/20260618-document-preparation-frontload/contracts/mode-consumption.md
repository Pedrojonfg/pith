# Contract: Mode Consumption After Preparation

## resolveModeEntryState (mode-bootstrap.js)

When `shared.preparation.status` is `ready` or `partial` with Tier 1 complete:
- MUST NOT return `upload_required` for same document
- RSVP/Questions: `bootstrap` with `shared.blockRecommendation` available
- Cloze: `bootstrap` when prep stored ready items OR `pipelineStatus: ready`
- Recall: `bootstrap` when recall slice prep-ready; skip inventory LLM

## RSVP create (study.js)

- Pre-fill `n_blocks` from `shared.blockRecommendation.nBlocks` when prep ≥ partial
- Show rationale text from recommendation
- Generate blocks: use cached inventory; NO inventory LLM when fingerprint matches
- Hide Recommend button when blockRecommendation present

## Cloze (study.js / cloze/pipeline.js)

- Skip Phase 0 LLM when `shared.conceptGraph` exists (project to slice)
- Skip phases 1–4 when `modes.cloze.pipelineStatus === 'ready'` from prep

## Slow (study.js / slow/phase0.js)

- Use `shared.docHierarchy` without hierarchy LLM
- Load Phase 0 from `shared.slowOrientation` for full-doc scope key

## Library UI

- Badge: Preparing | Ready | Partial | Failed from `shared.preparation.status`

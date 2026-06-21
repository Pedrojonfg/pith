# Implementation Plan: Factual Question Stem Pools

**Branch**: `20260702-factual-pools` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

## Summary

Patch R1 factual generation: stem pools with session rotation, inventory-sourced distractors with unit matching, one DeepSeek validation batch per block, per-concept LLM fallback. Definitions/enumerations stay on LLM path.

## Technical Context

**Language/Version**: ES modules, browser PWA  
**Primary Dependencies**: factual-classifier.js, factual-templates.js, llm.js, session.js  
**Storage**: Session-scoped `_meta.factualStemRotation` (non-persisted runtime)  
**Testing**: cursor-tests/20260621_*.mjs (7 files from spec §9)  
**Constraints**: max_tokens on validation batch; SW bump; English internal prompts

## Constitution Check

| Gate | Status |
|------|--------|
| max_tokens on batched validation | Required T03 |
| Parse failure categories | TRUNCATED / PARSE / SCHEMA in T03 |
| SW version bump | T05 |
| Fallback at all call sites | T04 |

## Implementation Sequence

1. **T01** — pool-rotation.js + stem pools in factual-templates.js  
2. **T02** — distractor-sourcing.js (unit matching, min-pool check)  
3. **T03** — distractor-validation.js (DeepSeek batch, injectable for tests)  
4. **T04** — factual-block-questions.js orchestrator + session.js wiring + generation_method  
5. **T05** — Seven cursor-tests + SW bump + contract update

## Source Layout

```text
src/js/pedagogy/
├── pool-rotation.js          # NEW
├── factual-templates.js      # REWRITE stem pools
├── distractor-sourcing.js    # NEW
├── distractor-validation.js  # NEW
└── factual-block-questions.js # NEW orchestrator
src/js/session.js             # hook before LLM question regen
specs/20260702-factual-pools/contracts/
cursor-tests/20260621_stem-pool-rotation.mjs
cursor-tests/20260621_distractor-unit-matching.mjs
cursor-tests/20260621_distractor-pool-insufficient-fallback.mjs
cursor-tests/20260621_validation-rejects-ambiguous.mjs
cursor-tests/20260621_validation-batch-not-per-concept.mjs
cursor-tests/20260621_post-validation-fallback.mjs
cursor-tests/20260621_definitions-enumerations-unaffected.mjs
```

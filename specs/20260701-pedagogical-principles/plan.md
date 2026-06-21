# Implementation Plan: Pedagogical Principles Layer

**Branch**: `20260701-pedagogical-principles` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

## Summary

Implement six pedagogical principles (R4→R1→R2→R5→R3→R6) as pure modules + targeted integration in sm2, document-preparation, study/review UI. R6 ships default-off.

## Technical Context

**Language/Version**: ES modules, browser PWA  
**Primary Dependencies**: sm2.js, document-preparation.js, novelty-scoring.js, adaptive-probing belief state  
**Storage**: Session blob fields on conceptInventory + smItems  
**Testing**: cursor-tests/*.mjs  
**Constraints**: Due-date ordering preserved; SW bump on src change; English internal

## Constitution Check

| Gate | Status |
|------|--------|
| Spec-driven | Pass |
| max_tokens on batched LLM classification | Required in T03 |
| SW version bump | T08 |
| UI minimal | Pass |

## Implementation Sequence

1. **T01** — PEDAGOGICAL_FLAGS  
2. **T02** — R4 reviewProvenance + queue penalty + session cap  
3. **T03** — R1 factual classifier + templates + DPP hook  
4. **T04** — R2 comprehension gate + UI indicator  
5. **T05** — R5 WhyThisCard  
6. **T06** — R3 concept spans + dim/highlight  
7. **T07** — R6 novelty-biased packing (default off)  
8. **T08** — Integration tests + SW bump + QA

## Source Layout

```text
src/js/config/flags.js                    # PEDAGOGICAL_FLAGS
src/js/sm2.js                             # reviewProvenance, buildReviewQueue
src/js/sm2-ingest.js                      # comprehension gate
src/js/pedagogy/
├── factual-classifier.js
├── factual-templates.js
├── comprehension-gate.js
├── concept-span-index.js
├── novelty-packing.js
└── why-this.js
src/js/document-preparation.js            # classify hook
src/js/review.js                          # cap + WhyThisCard
src/js/slow/reader.js                     # dim/highlight
src/css/slow-mode.css                     # dim styles
cursor-tests/20260621_*.mjs
```

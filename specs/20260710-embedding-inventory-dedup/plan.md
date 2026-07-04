# Implementation Plan: Embedding-Assisted Inventory Merge

**Branch**: `20260710-embedding-inventory-dedup` | **Date**: 2026-07-04 | **Spec**: [spec.md](./spec.md)

## Summary

Add embedding-assisted triage before LLM inventory merge in DPP T1.2: shadow → auto → full modes behind `EMBEDDING_ASSISTED_INVENTORY_MERGE_ENABLED`. Reuse vault embed client, cosine math, and `classifyConceptRelation`. Cache vectors on inventory for T1.8 reuse.

## Technical Context

**Language/Version**: ES modules, browser PWA + Node cursor-tests  
**Primary Dependencies**: `embeddings.js`, `embedding-math.js`, `contradiction-check.js`, `api.js` merge pipeline  
**Testing**: `cursor-tests/*.mjs`, calibration script with mock vectors  
**Constraints**: Default flag off; independent of semantic anchoring; no new embed service

## Constitution Check

| Gate | Status |
|------|--------|
| Spec-driven | Pass |
| Graceful degradation | Pass (FR-006) |
| SW bump on src change | Required at close |
| English internal prompts | Pass |

## Project Structure

```text
src/js/vault/inventory-merge-thresholds.js   # calibrated constants
src/js/vault/inventory-merge-embeddings.js   # triage + merge apply
src/js/config/flags.js                       # feature flags
src/js/api.js                                # deepSeekMergeConceptInventories hook
src/js/vault/novelty-scoring.js              # _embedding reuse
scripts/calibrate-inventory-merge-thresholds.mjs
cursor-tests/20260710_inventory-merge-embeddings.mjs
```

## Implementation Sequence

0. Calibration pairs + thresholds (T01)
1. Core triage module (T02)
2. api.js integration shadow/auto/full (T03)
3. T1.8 cache reuse (T04)
4. Tests + SW bump (T05)

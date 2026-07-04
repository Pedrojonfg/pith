# ROADMAP — embedding-inventory-dedup

**Feature:** specs/20260710-embedding-inventory-dedup | **Spec:** specs/20260710-embedding-inventory-dedup/spec.md | **Plan:** specs/20260710-embedding-inventory-dedup/plan.md
**Created:** 2026-07-04 | **Cleanup:** 2026-07-04

## Dependency diagram

```
T01 → T02 → T03 → T04 → T05
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03, T04 | parallel |
| 4 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Flags + calibrated thresholds + calibration pairs | — | sequential | [x] |
| T02 | inventory-merge-embeddings.js core module | T01 | sequential | [x] |
| T03 | api.js deepSeekMergeConceptInventories integration | T02 | parallel | [x] |
| T04 | novelty-scoring _embedding reuse | T02 | parallel | [x] |
| T05 | cursor-tests + calibration script + SW bump | T03,T04 | sequential | [x] |

## Temporary subagents

(none — sequential implementation)

## Prompt per task

### T05 — QA closure
**Spec ref:** §7 Testing checklist | **Plan ref:** closeout | **Files:** cursor-tests/, sw-update.js, index.html, sw.js
**Success criterion:** All cursor-tests green; SW_VERSION bumped.
**On close:** `/validate` and mark `[x]`.

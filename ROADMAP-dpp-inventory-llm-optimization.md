# ROADMAP — dpp-inventory-llm-optimization

**Feature:** specs/20260705-dpp-inventory-llm-optimization | **Spec:** specs/20260705-dpp-inventory-llm-optimization/spec.md | **Plan:** specs/20260705-dpp-inventory-llm-optimization/plan.md  
**Created:** 2026-07-05

## Dependency diagram

```
T01 (hierarchy-llm + T1.1 wire) ─→ T04 (session bootstrap)
T02 (24k slice constant) ─────────→ T03 (bisect on truncate)
T03 ───────────────────────────────→ T05 (merge tree)
T05 ───────────────────────────────→ T06 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04, T05 | parallel |
| 4 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | `hierarchy-llm.js` + wire T1.1 | — | parallel | [x] |
| T02 | `INVENTORY_CHAR_FALLBACK_SLICE_CHARS` 24k | — | parallel | [x] |
| T03 | Bisect-on-truncation in map-reduce | T02 | sequential | [x] |
| T04 | Session inventory hierarchy llmFn | T01 | parallel | [x] |
| T05 | Deterministic merge tree + conditional LLM | T03 | parallel | [x] |
| T06 | cursor-tests + SW bump | T04,T05 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-07-05 (none created)

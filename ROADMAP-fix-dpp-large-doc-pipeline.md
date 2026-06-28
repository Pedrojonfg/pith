# ROADMAP — fix-dpp-large-doc-pipeline

**Feature:** specs/20260706-fix-dpp-large-doc-pipeline | **Spec:** specs/20260706-fix-dpp-large-doc-pipeline/spec.md | **Plan:** specs/20260706-fix-dpp-large-doc-pipeline/plan.md  
**Created:** 2026-07-06

## Dependency diagram

```
T01 (char boundary refine) ──┐
T03 (status + reconcile)  ──┼── T04 (guard + tests + SW)
T02 (slim merge tree)     ──┘
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | parallel |
| 2 | T04 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Semantic char fallback boundary refinement | — | parallel | [x] |
| T02 | Slim merge + pairwise tree + rehydrate | — | parallel | [x] |
| T03 | Finalize status + persistence reconcile | — | parallel | [x] |
| T04 | Guard repair + cursor-tests + SW bump | T01–T03 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-07-06 (none created)

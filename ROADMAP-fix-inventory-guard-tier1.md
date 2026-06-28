# ROADMAP — fix-inventory-guard-tier1

**Feature:** specs/20260629-fix-inventory-guard-tier1 | **Spec:** specs/20260629-fix-inventory-guard-tier1/spec.md | **Plan:** specs/20260629-fix-inventory-guard-tier1/plan.md  
**Created:** 2026-06-29

## Dependency diagram

```
T01 (guard fix) → T02 (tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Fix isConceptInventoryValid + repairStuckRunning | — | sequential | [x] |
| T02 | cursor-tests | T01 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-29 (none created)

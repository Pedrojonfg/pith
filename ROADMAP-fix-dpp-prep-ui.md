# ROADMAP — fix-dpp-prep-ui

**Feature:** specs/20260629-fix-dpp-prep-ui | **Spec:** specs/20260629-fix-dpp-prep-ui/spec.md | **Plan:** specs/20260629-fix-dpp-prep-ui/plan.md  
**Created:** 2026-06-29

## Dependency diagram

```
T01 (status resolver) → T02 (tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | resolveCreateSessionPrepStatus + wire upload .then | — | sequential | [x] |
| T02 | cursor-tests | T01 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-29 (none created)

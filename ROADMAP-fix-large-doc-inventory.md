# ROADMAP — fix-large-doc-inventory

**Feature:** specs/20260629-fix-large-doc-inventory | **Spec:** specs/20260629-fix-large-doc-inventory/spec.md | **Plan:** specs/20260629-fix-large-doc-inventory/plan.md  
**Created:** 2026-06-29

## Dependency diagram

```
T01 (T1.2 degraded) → T02 (char map-reduce) → T03 (banner + tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | T1.2 degraded path (no throw on sparse viable inventory) | — | sequential | [x] |
| T02 | Char-based inventory chunk fallback in session.js | T01 | sequential | [x] |
| T03 | Sparse banner + cursor-tests + SW bump | T02 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-29 (none created)

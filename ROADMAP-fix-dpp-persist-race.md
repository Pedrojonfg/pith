# ROADMAP — fix-dpp-persist-race

**Feature:** specs/20260629-fix-dpp-persist-race | **Spec:** specs/20260629-fix-dpp-persist-race/spec.md | **Plan:** specs/20260629-fix-dpp-persist-race/plan.md  
**Created:** 2026-06-29

## Dependency diagram

```
T01 (wave persist) → T02 (tests + SW)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Persist once per DPP wave after parallel phases | — | sequential | [x] |
| T02 | cursor-tests + SW bump | T01 | sequential | [x] |

## Prompt per task

### T01 — Wave-level persist
**Spec ref:** FR-001, FR-002 | **Plan ref:** Implementation 1 | **Files:** `src/js/document-preparation.js`  
**Success criterion:** No `persistDoc` inside parallel phase mapper; one persist per wave + finalize.  
**On close:** `/validate` and mark `[x]`.

### T02 — QA closure
**Spec ref:** all | **Plan ref:** Implementation 3–4 | **Files:** `cursor-tests/20260629_dpp-persist-race.mjs`, `sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** Tests green.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-29 (none created)

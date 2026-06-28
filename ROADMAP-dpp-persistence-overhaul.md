# ROADMAP — dpp-persistence-overhaul

**Feature:** specs/20260629-dpp-persistence-overhaul | **Spec:** specs/20260629-dpp-persistence-overhaul/spec.md | **Plan:** specs/20260629-dpp-persistence-overhaul/plan.md  
**Created:** 2026-06-29

## Dependency diagram

```
T01 (addConceptsToShared) → T02 (orchestrator) → T03 (runId)
                              ↓
                    T04 (guard + stale) → T05 (UI poll) → T06 (tests)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03 | parallel |
| 3 | T04 | sequential |
| 4 | T05 | sequential |
| 5 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Refactor addConceptsToShared to in-memory doc merge | — | sequential | [x] |
| T02 | DPP clone-at-start + checkpoint/final persistence | T01 | parallel | [x] |
| T03 | runId registry + stale final-write guard | T01 | parallel | [x] |
| T04 | isConceptInventoryValid + stale scanner (no auto-ready) | T02,T03 | sequential | [x] |
| T05 | UI polls store every 2s while running | T04 | sequential | [x] |
| T06 | cursor-tests + regression | T05 | sequential | [x] |

## Prompt per task

### T01 — addConceptsToShared refactor
**Spec ref:** R2 | **Plan ref:** session-store.js | **Files:** session-store.js, study.js, slow/phase0.js  
**Success criterion:** `addConceptsToShared(doc, concepts)` mutates inventory only; callers outside DPP call `saveActiveSession` when needed.  
**On close:** `/validate` and mark `[x]`.

### T02 — DPP orchestrator persistence
**Spec ref:** R1, R3, R4, R5 | **Plan ref:** dpp-persistence.js, document-preparation.js  
**Success criterion:** Pipeline clones doc, awaited checkpoints after T1.1/T1.2/tier1, single `persistFinal` at end.  
**On close:** `/validate` and mark `[x]`.

### T03 — runId guard
**Spec ref:** R6 | **Plan ref:** dpp-persistence.js  
**Success criterion:** Each run gets UUID `runId`; `persistFinal` skips when store runId differs.  
**On close:** `/validate` and mark `[x]`.

### T04 — Guards and stale recovery
**Spec ref:** R7, R9 | **Plan ref:** session.js, project-library.js  
**Success criterion:** No running→ready self-heal; stale `running` >10m without active device run → `failed`/`STALE_RUN`.  
**On close:** `/validate` and mark `[x]`.

### T05 — UI store polling
**Spec ref:** R8 | **Plan ref:** study.js  
**Success criterion:** Create-session UI polls `getActiveSession` every 2s while `prep.status === running`.  
**On close:** `/validate` and mark `[x]`.

### T06 — Tests
**Spec ref:** §8 Testing checklist | **Plan ref:** cursor-tests  
**Success criterion:** New mjs tests pass; `20260622_dpp-recalculation-guard.mjs` still green.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-29 (none created)

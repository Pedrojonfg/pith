# ROADMAP — fix-dpp-guard-race

**Feature:** specs/20260709-fix-dpp-guard-race | **Spec:** specs/20260709-fix-dpp-guard-race/spec.md | **Plan:** specs/20260709-fix-dpp-guard-race/plan.md  
**Created:** 2026-07-09

## Dependency diagram

```
T01 (failing tests) ──► T02 (guard + repair alignment)
                              │
                              ├──► T03 (fresh reload helper + gate wiring)
                              │
                              └──► T04 (poll timeout 90s)
                                        │
                                        └──► T05 (QA + application-overview)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | sequential |
| 2 | T03, T04 | sequential |
| 3 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Failing test: running + gate artifacts → skip | — | sequential | [x] |
| T02 | Align guard bypass + repair with hasTier1GateArtifacts | T01 | sequential | [x] |
| T03 | reloadSessionForGuard + gate/poll fresh reads | T02 | sequential | [x] |
| T04 | DPP_GUARD_POLL_MAX_MS 90s + timeout UX | T02 | sequential | [x] |
| T05 | Full validate + application-overview cleanup | T03,T04 | sequential | [x] |

## Prompt per task

### T01 — Failing guard race test

**Spec ref:** FR-006, SC-001 | **Plan ref:** Phase D | **Files:** `cursor-tests/20260709_fix-dpp-guard-race.mjs`  
**Success criterion:** Test fails before fix (running + 37 concepts + blockRec, no modeRec → currently `waiting`).  
**On close:** `/validate` and mark `[x]`.

### T02 — Guard artifact alignment

**Spec ref:** FR-006, FR-007, R3 | **Plan ref:** Phase A | **Files:** `src/js/session.js`  
**Success criterion:** T01 passes; regression tests green.  
**On close:** `/validate` and mark `[x]`.

### T03 — Fresh session reload

**Spec ref:** FR-001, FR-005 | **Plan ref:** Phase B | **Files:** `src/js/session.js`, `src/js/study.js`  
**Success criterion:** Gate uses `reloadSessionForGuard`; poll default reload uses same.  
**On close:** `/validate` and mark `[x]`.

### T04 — Poll timeout ceiling

**Spec ref:** FR-004 | **Plan ref:** Phase C | **Files:** `src/js/session.js`, `src/js/study.js`  
**Success criterion:** maxWaitMs defaults to 90s; timeout shows actionable error.  
**On close:** `/validate` and mark `[x]`.

### T05 — QA closure

**Spec ref:** SC-004 | **Plan ref:** Phase D | **Files:** `application-overview.md`, `src/js/sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** All cursor-tests pass; superseded tracking entries removed; SW bumped.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-09 (none created)

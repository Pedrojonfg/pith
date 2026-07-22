# ROADMAP — adaptive-holistic-wiring

**Feature:** `specs/20260722-adaptive-holistic-wiring` | **Spec:** `specs/20260722-adaptive-holistic-wiring/spec.md` | **Plan:** `specs/20260722-adaptive-holistic-wiring/plan.md`  
**Created:** 2026-07-22

## Dependency diagram

```text
T01 (resolver + unit tests)
  └─► T02 (enrich guard)
        └─► T03 (wire study.js + rename api.js + SW bump)
              └─► T04 (e2e + flag-off regression)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | `resolveAdaptiveCandidateConcepts` + unit fixture tests | — | sequential | [x] |
| T02 | Enrich-profile vault/tested overwrite guard | T01 | sequential | [x] |
| T03 | Wire call site + `conceptsToAssess` rename + SW bump | T02 | sequential | [x] |
| T04 | E2e holistic path + flag-off regression (mocked LLM) | T03 | sequential | [x] |

## Prompt per task

### T01 — Resolver + unit tests
**Spec ref:** FR-003, FR-004, FR-008, US2 | **Plan ref:** Phase A | **Files:** `src/js/adaptive-probing/assessment-integration.js`, `cursor-tests/20260722_resolve-adaptive-candidates.mjs`  
**Success criterion:** Helper maps plan selected ids (− vault skips) to inventory objects; flag-off returns full inventory; empty selection falls back with warn. Unit tests green.  
**On close:** `/validate` and mark `[x]`.

### T02 — Enrich guard
**Spec ref:** FR-007, US3 | **Plan ref:** Phase C guard | **Files:** `src/js/adaptive-probing/assessment-integration.js`, extend `cursor-tests/20260722_resolve-adaptive-candidates.mjs` or small adjacent test  
**Success criterion:** If vault id already `tested`, warn and do not overwrite to `presumed_known_vault`.  
**On close:** `/validate` and mark `[x]`.

### T03 — Wire + rename + SW
**Spec ref:** FR-001, FR-002, FR-005, FR-006 | **Plan ref:** Phase B + SW | **Files:** `src/js/study.js`, `src/js/api.js`, `src/js/sw-update.js`, `index.html`  
**Success criterion:** Holistic branch passes `conceptsToAssess` from resolver; param renamed + JSDoc; SW `20260722_08`.  
**On close:** `/validate` and mark `[x]`.

### T04 — E2e fixture
**Spec ref:** FR-010, SC-001–SC-003, §5 | **Plan ref:** Phase C e2e | **Files:** `cursor-tests/20260722_adaptive-holistic-wiring-e2e.mjs`  
**Success criterion:** ~15 inventory / 5 selected / 2 vault-skipped; mocked LLM sees exactly 5; vault ids absent; profile labels correct; flag-off gets full inventory. Print before/after counts.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-22 — none created (all tasks sequential in parent chat).


## Implementation log (OQ answers)

See `specs/20260722-adaptive-holistic-wiring/research.md` — OQ1–6 confirmed before code.

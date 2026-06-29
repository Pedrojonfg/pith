# ROADMAP — fix-dpp-tier-scheduling

**Feature:** specs/20260707-fix-dpp-tier-scheduling | **Spec:** specs/20260707-fix-dpp-tier-scheduling/spec.md | **Plan:** specs/20260707-fix-dpp-tier-scheduling/plan.md  
**Created:** 2026-07-07

## Dependency diagram

```
T01 (PHASE_DEPS + gate phases) ──┬── T04 (tests + SW)
T02 (Phase0 map-reduce)       ──┤
T03 (Cloze degrade + logs)    ──┘
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | parallel |
| 2 | T04 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Gate/deferred phases + T2.3 deps + study kickoff | — | parallel | [x] |
| T02 | Phase 0 map-reduce retry/bisect + max_tokens | — | parallel | [x] |
| T03 | Cloze T2.1 degrade + diagnostic logs | — | parallel | [x] |
| T04 | cursor-tests + SW bump | T01–T03 | sequential | [x] |

## Prompt per task

### T01 — DPP scheduling & early gate
**Spec ref:** FR-001–FR-005 | **Plan ref:** §1 | **Files:** `document-preparation.js`, `study.js`  
**Success criterion:** T2.3 not in wave with T1.2; stopAfterTier 1 = gate only; deferred+T2 background kickoff.  
**On close:** `/validate` and mark `[x]`.

### T02 — Phase 0 resilience
**Spec ref:** FR-010–FR-013 | **Plan ref:** §2 | **Files:** `slow/phase0.js`  
**Success criterion:** Partial chunk retry/bisect; named max_tokens constant.  
**On close:** `/validate` and mark `[x]`.

### T03 — Cloze degrade
**Spec ref:** FR-020–FR-021 | **Plan ref:** §3 | **Files:** `document-preparation.js`, `cloze/pipeline.js`  
**Success criterion:** Zero valid items → partial not throw; logs per phase.  
**On close:** `/validate` and mark `[x]`.

### T04 — QA closure
**Spec ref:** SC-001–SC-004 | **Plan ref:** §4 | **Files:** `cursor-tests/20260707_fix-dpp-tier-scheduling.mjs`, `sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** Tests green; SW validate passes.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-07 (none created)

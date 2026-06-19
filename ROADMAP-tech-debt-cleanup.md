# ROADMAP — tech-debt-cleanup

**Feature:** specs/20260628-tech-debt-cleanup | **Spec:** specs/20260628-tech-debt-cleanup/spec.md | **Plan:** specs/20260628-tech-debt-cleanup/plan.md
**Created:** 2026-06-28

## Dependency diagram

```text
T01 → T02 → T03 → T04 → T05
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | R3 — align PWA version markers | — | sequential | [x] |
| T02 | R2 — remove legacy assessment screens/paths | T01 | sequential | [x] |
| T03 | R1 — restore source fidelity strict toggle | T02 | sequential | [x] |
| T04 | R5 — audit/remove deprecated exports | T03 | sequential | [x] |
| T05 | R4 — retire legacy session writes | T04 | sequential | [x] |

## Temporary subagents

(empty)

## Prompt per task

### T01 — PWA version alignment
**Spec ref:** R3 | **Plan ref:** Task graph | **Files:** sw-update.js, index.html, sw.js, main.js
**Success criterion:** All version markers = `20260619_1`; SW test passes
**On close:** `/validate` and mark `[x]`.

### T02 — Legacy assessment removal
**Spec ref:** R2 | **Files:** index.html, ui.js, study.js, flags.js
**Success criterion:** Zero `screenInitialAssessment` / `screenAssessmentGenerating` references
**On close:** `/validate` and mark `[x]`.

### T03 — Source fidelity toggle
**Spec ref:** R1 | **Files:** index.html, ui.js, study.js, flags.js, config.js
**Success criterion:** Settings toggle persists; `isSourceFidelityStrictEnabled()` reads user pref
**On close:** `/validate` and mark `[x]`.

### T04 — Deprecated export audit
**Spec ref:** R5 | **Files:** graph/view.js, graph/adapters.js, graph/proximity.js, recall-api.js, recommender.js, study.js, api.js
**Success criterion:** Named items deleted or annotated
**On close:** `/validate` and mark `[x]`.

### T05 — Legacy session writes
**Spec ref:** R4 | **Files:** session.js, session-migration.js
**Success criterion:** No `setItem` to legacy keys outside migration
**On close:** `/validate` and mark `[x]`.

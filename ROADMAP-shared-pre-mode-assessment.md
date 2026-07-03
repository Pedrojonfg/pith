# ROADMAP — shared-pre-mode-assessment

**Feature:** specs/20260702-shared-pre-mode-assessment | **Spec:** specs/20260702-shared-pre-mode-assessment/spec.md | **Plan:** specs/20260702-shared-pre-mode-assessment/plan.md
**Created:** 2026-07-03

## Dependency diagram

```
T01 ─┬─ T03 ─ T05
T02 ─┘
T04 ─── (parallel with T05 after T03)
T06 ─── (after T03)
T07 ─── (after T03)
T08 ─── (after all)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04, T05, T06, T07 | parallel |
| 4 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Schema + knowledge-profile-shared helpers | — | parallel | [x] |
| T02 | DPP: move T1.5 out of gate, export runModeRecommendationPhase | — | parallel | [x] |
| T03 | Shared assessment gate flow in study.js + index.html | T01,T02 | sequential | [x] |
| T04 | Recommender knowledgeProfile integration | T03 | parallel | [x] |
| T05 | Remove RSVP embedded assessment; pack reads shared profile | T03 | parallel | [x] |
| T06 | Redo assessment + reset table | T03 | parallel | [x] |
| T07 | Interview guard + feature flag rename | T03 | parallel | [x] |
| T08 | Integration tests + SW bump | T04-T07 | sequential | [x] |

## Prompt per task

### T01 — Schema helpers
**Spec ref:** §4 | **Plan ref:** §1 | **Files:** session-types.js, knowledge-profile-shared.js, session.js
**Success criterion:** shared.knowledgeProfile validated; migrate _meta; redo reset pure function exported.
**On close:** `/validate` and mark `[x]`.

### T02 — DPP scheduling
**Spec ref:** §6.4 | **Plan ref:** §2 | **Files:** document-preparation.js
**Success criterion:** T1.5 not in gate phases; runModeRecommendationPhase exported with knowledgeProfile.
**On close:** `/validate` and mark `[x]`.

### T03 — Gate flow
**Spec ref:** §2 | **Plan ref:** §3 | **Files:** study.js, index.html, ui.js, main.css
**Success criterion:** Gate between tier1 and mode select; accept/skip paths; assessment UI exits to mode select.
**On close:** `/validate` and mark `[x]`.

### T04 — Recommender
**Spec ref:** §4.2 | **Plan ref:** §4 | **Files:** recommender.js
**Success criterion:** computeModeRecommendation accepts knowledgeProfile; high mastery shifts modes.
**On close:** `/validate` and mark `[x]`.

### T05 — RSVP cleanup
**Spec ref:** §2, §6.2 | **Plan ref:** §5 | **Files:** study.js, session.js
**Success criterion:** No RSVP create assessment path; pack uses shared.knowledgeProfile.
**On close:** `/validate` and mark `[x]`.

### T06 — Redo
**Spec ref:** §5 | **Plan ref:** §6 | **Files:** study.js, knowledge-profile-shared.js, index.html
**Success criterion:** Redo button + confirm; reset table enforced.
**On close:** `/validate` and mark `[x]`.

### T07 — Guards + flags
**Spec ref:** §2, §6.8 | **Plan ref:** §3 | **Files:** flags.js, study.js
**Success criterion:** Interview skip; isSharedPreModeAssessmentEnabled gates behavior.
**On close:** `/validate` and mark `[x]`.

### T08 — QA closure
**Spec ref:** §7 | **Plan ref:** §6 | **Files:** cursor-tests, sw-update.js, sw.js, index.html
**Success criterion:** All checklist tests green; SW bumped.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-03 (none created)

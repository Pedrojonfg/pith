# ROADMAP — mode-recommendation

**Feature:** specs/20260724-mode-recommendation | **Spec:** specs/20260724-mode-recommendation/spec.md | **Plan:** specs/20260724-mode-recommendation/plan.md  
**Created:** 2026-07-23

## Dependency diagram

```text
T01 (data model) ──┐
                   ├──► T04 (nav + submit + recompute) ──► T07 (panel mapping)
T02 (pure algo)  ──┤                                         │
                   │                                         ▼
T03 (screen UI)  ──┘         T05 (param wiring) ──► T08 (QA + SW)
                             T06 (intent inject) ──►┘
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | parallel |
| 2 | T04 | sequential |
| 3 | T05, T06 | parallel |
| 4 | T07 | sequential |
| 5 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Additive shared fields + validation + createSession defaults | — | parallel | [x] |
| T02 | Pure `computeOnboardingModeRecommendation` + fixture tests | — | parallel | [x] |
| T03 | `screenOnboardingQuestionnaire` markup, CSS, ui.js refs | — | parallel | [x] |
| T04 | Post-scope gate, submit once, recompute when signals ready | T01,T02,T03 | sequential | [x] |
| T05 | Wire params: block multiplier, socraticRatio at question config, soft turn-cap | T02,T04 | parallel | [x] |
| T06 | `buildStudentIntentAppendix` + high-priority injection sites | T01 | parallel | [x] |
| T07 | Map onboarding flow into `primaryFlow` / panel; remove empty-by-design dead path | T04 | sequential | [x] |
| T08 | Integration tests, SW bump, quickstart QA marks | T05,T06,T07 | sequential | [x] |

## Prompt per task

### T01 — Data model
**Spec ref:** FR-002, FR-003, Key Entities | **Plan ref:** data-model.md | **Files:** `src/js/session-types.js`, `src/js/session-store.js`, `cursor-tests/20260724_onboarding-shared-validation.mjs`  
**Success criterion:** Defaults null; validation rejects bad enums/types; no schemaVersion bump; no rewrite helpers beyond one-shot setters if needed.  
**On close:** `/validate` and mark `[x]`.

### T02 — Pure onboarding recommender
**Spec ref:** FR-004–FR-012, FR-017 | **Plan ref:** contracts/compute-mode-recommendation.md | **Files:** `src/js/recommendation/onboarding-recommender.js`, `cursor-tests/20260724_onboarding-recommender.mjs`  
**Success criterion:** Every R-FLOW / R-PARAM branch has ≥1 fixture; avoid overrides understand; practice full/partial vs none.  
**On close:** `/validate` and mark `[x]`.

### T03 — Questionnaire screen shell
**Spec ref:** FR-001, FR-018 | **Plan ref:** contracts/onboarding-questionnaire.md | **Files:** `index.html`, `src/css/main.css`, `src/js/ui.js`  
**Success criterion:** Full-bleed screen registered; English copy; Submit disabled until R-Q1–R-Q4 answered; no test/assessment wording.  
**On close:** `/validate` and mark `[x]`.

### T04 — Navigation + persistence orchestration
**Spec ref:** FR-001, FR-016, §4 | **Plan ref:** research.md questionnaire gate | **Files:** `src/js/study.js`, (minimal) `src/js/session-store.js` if one-shot writers  
**Success criterion:** After scope, questionnaire if responses null; submit writes once; continues to mode-select path; recompute when answers + signals ready.  
**On close:** `/validate` and mark `[x]`.

### T05 — Param wiring
**Spec ref:** FR-009–FR-013 | **Plan ref:** research OQ5/OQ6 | **Files:** `src/js/recommendation/block-count-recommender.js` or callers, `src/js/session.js`, optional soft import of socratic-loop-config  
**Success criterion:** Multiplier applied for rsvp/read; ratio/disable at `resolveBlockQuestionConfig`; turn-cap soft if module present.  
**On close:** `/validate` and mark `[x]`.

### T06 — Student intent injection
**Spec ref:** FR-015 | **Plan ref:** contracts/student-intent-injection.md | **Files:** new small helper (e.g. `src/js/recommendation/student-intent.js` or `src/js/prompts/student-intent.js`), `src/js/api.js`, `src/js/guide-chat.js`, `cursor-tests/20260724_student-intent-appendix.mjs`  
**Success criterion:** Appendix present iff non-null at high-pri sites; never at banned sites.  
**On close:** `/validate` and mark `[x]`.

### T07 — Panel mapping
**Spec ref:** FR-014 | **Plan ref:** research additive mapping | **Files:** `src/js/recommendation/recommender.js` and/or mapper in onboarding-recommender, `src/js/study.js`  
**Success criterion:** Panel shows onboarding flow + reasoning; Start → flow[0]; tracker fields preserved; empty-by-design path removed.  
**On close:** `/validate` and mark `[x]`.

### T08 — QA closure
**Spec ref:** SC-001–SC-006, testing checklist | **Plan ref:** quickstart.md | **Files:** cursor-tests integration, `src/js/sw-update.js`, `index.html` `?v=`, `sw.js` if needed, ROADMAP/quickstart marks  
**Success criterion:** Listed tests green; SW versions aligned; quickstart checklist updated.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-23 — removed `.cursor/agents/mode-recommendation-t01.md` … `t06.md`.

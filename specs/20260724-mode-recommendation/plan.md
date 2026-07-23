# Implementation Plan: Onboarding Questionnaire + Mode Recommendation

**Branch**: `20260724-mode-recommendation` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260724-mode-recommendation/spec.md`

## Summary

Insert a one-time Onboarding Questionnaire after scope resolution; persist `shared.onboardingResponses` + `shared.studentIntent`; compute a pure onboarding-driven flow/params algorithm; map results into the existing `modeRecommendation` / `#recommendationPanel` contract; wire params into block-count and question-config chokepoints; inject studentIntent into high-priority LLM prompts.

## Technical Context

**Language/Version**: Vanilla JS ES modules (browser PWA)  
**Primary Dependencies**: Existing `recommendation/*`, `session-store.js`, `session-types.js`, `study.js`, `ui.js`, `api.js`, `document-preparation.js`  
**Storage**: Document session in IndexedDB/local persistence via `session-store` (additive shared fields, no schemaVersion bump)  
**Testing**: `cursor-tests/*.mjs` fixture/exact-match for pure recommender; property-style prompt appendix checks for intent injection  
**Target Platform**: Browser PWA (Chrome/Edge/Firefox)  
**Project Type**: Single-page PWA (`src/js`, `index.html`, `src/css`)  
**Performance Goals**: Questionnaire non-blocking for prep; pure recommender sync <1ms on typical inputs  
**Constraints**: English UI/prompts; SW bump on `src/js/**` / `index.html` / CSS changes; named placeholder constants only; do not rename existing `primaryFlow` contract  
**Scale/Scope**: One new screen, ~1 pure algorithm module, additive shared fields, prompt appendix helper, param wiring at 2–3 chokepoints

## Constitution Check

Constitution file is a placeholder; gates from `.cursorrules` / project practice:

| Gate | Status |
|------|--------|
| English UI / LLM heuristics | PASS |
| PWA SW versioning on asset change | PASS (final QA task bumps) |
| LLM JSON max_tokens when >~20 fields | N/A (no new large JSON LLM for this feature) |
| UI necessity / DESIGN.md full-bleed screens | PASS (primary screen, not a card) |
| TDD for deterministic pipeline | PASS (fixture tests for pure function) |

Post-design re-check: PASS — additive data model, no schema bump, maps into existing recommendation UX.

## Project Structure

### Documentation (this feature)

```text
specs/20260724-mode-recommendation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── onboarding-questionnaire.md
│   ├── compute-mode-recommendation.md
│   └── student-intent-injection.md
└── checklists/requirements.md
```

### Source Code (touch list)

```text
src/js/session-types.js
src/js/session-store.js
src/js/recommendation/onboarding-recommender.js   # NEW pure algorithm + constants
src/js/recommendation/recommender.js              # map/merge into primaryFlow shape
src/js/recommendation/block-count-recommender.js  # apply multiplier when present
src/js/session.js                                 # resolveBlockQuestionConfig ratio
src/js/study.js                                   # gate, submit, recompute, panel
src/js/ui.js                                      # screen id + refs
src/js/api.js                                     # studentIntent appendix (high-pri)
src/js/guide-chat.js                              # studentIntent appendix
index.html                                        # screenOnboardingQuestionnaire
src/css/main.css                                  # minimal questionnaire styles
cursor-tests/20260724_*.mjs
```

**Structure Decision**: Extend existing recommendation + session modules; new pure file for onboarding algorithm to avoid breaking genre-based `computeModeRecommendation` until merge mapping is explicit.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Keep legacy genre recommender + new onboarding algorithm | Existing DPP T1.5 / tracker depend on `primaryFlow` | Replacing genre recommender wholesale would regress flow panel progress/override |
| Soft-deps on practicePrep / socratic-loop-config | Sibling branches may not be merged | Hard-require would block shipping questionnaire + flow |

## Phase outputs

- [research.md](./research.md)
- [data-model.md](./data-model.md)
- [quickstart.md](./quickstart.md)
- [contracts/](./contracts/)

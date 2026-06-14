# Implementation Plan: Recall Mode

**Branch**: `20260621-recall-mode` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/20260621-recall-mode/spec.md`

## Summary

Add **Recall Mode** — standalone synthesis-level open-ended retrieval with a context-rich tutor, session slice on `modes.recall`, bootstrap/generate-fresh entry via `mode-bootstrap.js`, LLM generation (`generateRecallQuestions`) and evaluation (`deepSeekRecallTutor`), SM-2 ingestion per concept, recall assessment signals for Cloze prioritization, optional vault observations, flow recommender hooks, and minimal focused study UI (`screenRecall`). v1 is full-document scope only.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)

**Primary Dependencies**: `session-store.js`, `mode-bootstrap.js`, `assessment-signals.js`, `sm2-ingest.js` / `sm2.js`, `api.js`, `study.js`, `recommender.js` (flow panel), Knowledge Vault `mastery-model.js` (optional observations)

**Storage**: `localStorage['pith_doc_sessions']` → `DocumentSession.modes.recall` + `shared.assessmentSignals` + `shared.smItems`

**Testing**: `cursor-tests/20260621_recall-mode.mjs` (integration); unit tests for quality mapping and entry resolution

**Target Platform**: SPA offline-first PWA

**Project Type**: Web application — vanilla JS modules + DOM

**Performance Goals**: Question generation progress visible within 2s of start; tutor feedback UI update within 10s typical (network-dependent); resume load &lt; 200ms

**Constraints**: English UI/prompts; bump `SW_VERSION` on shipped asset changes; reuse concept inventory pipeline (no block packing); extend assessment signal types without breaking Cloze consumer; API key required for generate + tutor (same as Questions/Socratic)

**Scale/Scope**: ~10 implementation tasks; one new study screen; two new API functions; mode slot + ingestion hooks; recommender rule additions

**External prerequisites**: `20260612-mode-continuity`, `20260620-sm2-priority-queue`, `20260609-flow-recommendation` (recommender), optional `20260618-knowledge-vault-a-plus`

## Constitution Check

*GATE: Project uses `.cursorrules` (constitution template not ratified).*

| Principle | Status | Notes |
|-----------|--------|-------|
| English prompts / UI | PASS | All Recall strings and LLM prompts in English |
| No frameworks | PASS | Vanilla JS + DOM |
| Simplicity / surgical | PASS | Reuse inventory + assessment patterns; new screen only where needed |
| PWA versioning | PASS | SW bump when touching `src/js/**`, `index.html`, `src/css/**` |
| Testability | PASS | Pure helpers for quality mapping + entry resolution tested first |
| Heuristics in English | PASS | Generation/tutor prompts in English |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260621-recall-mode/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── recall-generation.md
│   ├── recall-tutor.md
│   ├── recall-entry-bootstrap.md
│   └── recall-downstream.md
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/js/
├── session.js                  # modes.recall slot helpers, normalizeRecallSlice
├── mode-bootstrap.js           # resolveModeEntryState(doc, "recall")
├── assessment-signals.js       # recall_weak / recall_strong signal types
├── sm2-ingest.js               # ingestSm2FromRecallAnswer + QUALITY_TO_SM2 map
├── api.js                      # generateRecallQuestions, deepSeekRecallTutor
├── study.js                    # enterModeWithContinuity, screenRecall wiring, generation orchestration
├── recommender.js              # suggest Recall after RSVP/Slow / sparse signals
└── vault/mastery-model.js      # recall observation types (optional)

index.html                      # screenRecall markup + mode selector entry
src/css/main.css                # recall study screen styles (or recall-mode.css)

cursor-tests/
└── 20260621_recall-mode.mjs
```

**Structure Decision**: Colocate Recall study flow in `study.js` following Questions/Cloze patterns; isolate LLM contracts in `api.js`; pure mapping functions testable without DOM.

## Complexity Tracking

No constitution violations requiring justification.

## Phase 0 Output

See [research.md](./research.md) — resolves entry paths, question count heuristics, tutor context contract, and RSVP socratic follow-up boundary.

## Phase 1 Output

- [data-model.md](./data-model.md)
- [contracts/](./contracts/)
- [quickstart.md](./quickstart.md)

## Phase 2

Task breakdown in [ROADMAP.md](../../ROADMAP.md) (Método Pedro).

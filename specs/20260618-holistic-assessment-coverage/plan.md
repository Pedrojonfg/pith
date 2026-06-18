# Implementation Plan: Holistic Pre-Packing Assessment Coverage

**Branch**: `20260618-holistic-assessment-coverage` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

## Summary

Replace the fixed ~7-question, head-truncated pre-packing assessment with a **coverage-driven map-reduce pipeline**: dynamic budget from inventory + edges, section-stratified material chunks, explicit edge-question quota, and merged Questions-mode output feeding the existing `knowledge_profile` → pack flow.

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA)

**Primary Dependencies**: Existing `api.js` LLM helpers, `buildInventoryChunks`, `generatePrePackingAssessmentItems`, assessment runner in `study.js`

**Storage**: Ephemeral `prePackingFlow`; `session._meta.knowledge_profile` unchanged

**Testing**: `cursor-tests/*.mjs` pure-function + contract tests

**Target Platform**: Browser offline-capable PWA

**Constraints**: Parallel LLM cap `INVENTORY_MAX_PARALLEL_CALLS`; holistic cap 50 questions; no localStorage wipe

**Scale/Scope**: `assessment-coverage.js` (new), `api.js`, `flags.js`, `study.js`, `config.js`

## Constitution Check

| Gate | Status |
|------|--------|
| Library-first pure functions | PASS — budget + plan in `assessment-coverage.js` |
| English prompts/UI | PASS |
| LLM max_tokens on large JSON | PASS — per-batch sizing in api layer |
| Minimal UI | PASS — progress text only |
| No commit unless asked | PASS |

## Project Structure

### Documentation

```text
specs/20260618-holistic-assessment-coverage/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── coverage-plan.md
│   └── holistic-generation.md
└── checklists/
```

### Source Code

```text
src/js/
├── assessment-coverage.js    # NEW — budget, plan, merge helpers
├── api.js                    # holistic generator, prompt tweaks
├── config/flags.js           # HOLISTIC_ASSESSMENT_*
├── config.js                 # HOLISTIC_ASSESSMENT_MAX
└── study.js                  # wire holistic path + progress
```

## Phases

### Phase 0 — Research

See [research.md](./research.md): root causes (cap 7, 12k truncate), map-reduce pattern reuse, edge quota.

### Phase 1 — Design

- [data-model.md](./data-model.md)
- [contracts/](./contracts/)

### Phase 2 — Implementation waves

| Wave | Tasks | Focus |
|------|-------|-------|
| 1 | T01 | Pure coverage plan + budget |
| 2 | T02, T03 | API map-reduce + flags (parallel) |
| 3 | T04 | study.js wiring |
| 4 | T05 | Evaluator edge mapping |
| 5 | T06 | Tests + QA |

## Risk Mitigation

- **Long quiz UX**: show count upfront + batch progress; user can still skip.
- **Token limits**: section chunks already sized for inventory; reuse same chunk boundaries.
- **Duplicate questions**: merge step dedupes by `concept_id` + question fingerprint for same batch type.

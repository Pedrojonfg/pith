# Implementation Plan: Threshold Concepts & Generative Pedagogy

**Branch**: `20260703-threshold-generative-pedagogy` | **Date**: 2026-06-28 | **Spec**: [spec.md](./spec.md)

## Summary

Tag ~12% of concept inventory as threshold (heuristic + one LLM batch), bias RSVP packing and block generation (`threshold_expanded`, WPM cap), inject generative pedagogy prompts into Socratic/Recall/Slow/Review, and tighten comprehension gate for threshold concepts.

## Technical Context

- **Stack**: Vanilla ES modules, DPP in `document-preparation.js`, prompts in `api.js` / `recall-api.js` / `slow/phase0.js` / `slow/phase3.js`
- **Persistence**: `shared.conceptInventory[].isThreshold` on DocumentSession
- **Flags**: extend `PEDAGOGICAL_FLAGS` in `config/flags.js`
- **Tests**: `cursor-tests/20260703_threshold-generative-pedagogy.mjs`

## Constitution Check

- LLM batch for threshold: explicit `max_tokens`, single call per doc
- English prompts per `.cursorrules`
- SW bump on `src/js/**` changes
- No new primary screens; prompt + scheduling only

## Phase 0 — Research

See [research.md](./research.md). Resolved: 12% fraction, RSVP scheduling-only gating, synthetic examples when not strict fidelity.

## Phase 1 — Design

- [data-model.md](./data-model.md)
- [contracts/threshold-tagging.md](./contracts/threshold-tagging.md)
- [contracts/generative-pedagogy-prompts.md](./contracts/generative-pedagogy-prompts.md)
- [quickstart.md](./quickstart.md)

## Phase 2 — Implementation Tasks

| Task | Module | Description |
|------|--------|-------------|
| T01 | `pedagogy/threshold-concepts.js` | Heuristic scoring, fraction selection, inventory apply |
| T02 | DPP + `api.js` | LLM confirm batch; wire after inventory in `document-preparation.js` |
| T03 | `session.js` + `api.js` | Packing sort, block config overrides, `threshold_expanded` prompt |
| T04 | `pedagogy/generative-pedagogy.js` + prompts | Shared rules; Socratic/Recall/Slow/Review |
| T05 | `comprehension-gate.js` | Stricter bar for threshold concepts |
| T06 | `rsvp.js` | Per-block WPM cap for threshold blocks |
| T07 | Tests + SW | cursor-tests + version bump |

## Dependencies

- `20260701-pedagogical-principles` (comprehension gate, factual classifier)
- `20260613-source-fidelity` (strict mode gate for synthetic examples)
- `20260620-rsvp-generation-pedagogy-hardening` (explanation profiles)

## Out of Scope

- Feynman mode
- Guide chat generative rules
- Cloze / MCQ stem changes
- New BKT gating UI

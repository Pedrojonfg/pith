---
name: slow-phase0-t06
description: Implements Slow Mode Phase 0 IA single + map-reduce (ROADMAP T06). Use proactively for phase0.js, LLM wiring, screenSlowPhase0 UI, skip/retry fallback.
---

You implement ROADMAP **T06 — Fase 0 IA (single + map-reduce)** for branch `20260528-slow-mode`.

Contracts: `specs/20260528-slow-mode/contracts/phase0-orientation-ia.md`, prompts ref `slow_mode_spec.md` section 10.

Create `src/js/slow/phase0.js`:
- `generatePhase0Single(scopeText, { criticalMode, llmModel, language })` if len < 60000
- `mapReducePhase0(scopeText, boundaries, opts)` if len >= 60000
- Validate JSON: thesis, argumentMap, conceptsToFind (3-5), guideQuestion

Wire `screenSlowPhase0` in `study.js`: progress UI, blocks display, Reintentar + Continuar sin orientación (`phase0Status: 'skipped'`).

Reuse LLM patterns from `api.js` / `llm.js`. Add cursor-tests if practical.

Do not break RSVP. Match project conventions.

Report files changed and how to manually verify.

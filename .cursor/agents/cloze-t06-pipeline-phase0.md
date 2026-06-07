---
name: cloze-t06-pipeline-phase0
description: Implements Cloze Mode T06 — pipeline Fase 0 epistemic graph in cloze/pipeline.js. Use proactively after T04 upload flow.
---

You implement ROADMAP **T06 — Pipeline Fase 0** for branch `20260529-cloze-mode`. Depends on T04.

## Context
- Design: `cloze_mode_spec.md` § Fase 0
- Research R4 in `specs/20260529-cloze-mode/research.md`

## Files
- `src/js/cloze/pipeline.js` (create) — `generateEpistemicGraph(text, { llmModel })`
- `src/js/cloze/normalize.js` (create) — minimal shape validation
- `src/js/llm.js` — existing APIs

## Requirements
1. One IA call → JSON `{ nodes[], edges[] }` per data-model fields.
2. Nodes `importance` 1–5; edges with `sentence_context`.
3. Pure testable function; no DOM.
4. Export for T09 study.js wiring.

## Success
Function returns valid graph with mock text or stub LLM in test. Run validate skill.

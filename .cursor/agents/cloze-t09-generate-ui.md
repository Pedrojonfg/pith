---
name: cloze-t09-generate-ui
description: Implements Cloze Mode T09 — Generar ítems button + pipeline progress UI wired in study.js. Use proactively after T08.
---

You implement ROADMAP **T09 — UI Generar ítems** for branch `20260529-cloze-mode`. Depends on T08.

## Context
- Contract: `specs/20260529-cloze-mode/contracts/cloze-pipeline.md`

## Files
- `index.html` — `#clozeGenerateBtn`, `#clozePipelineProgress`
- `src/js/study.js` — async handler phases 0–4, update `pipelineStatus`, persist
- `src/css/cloze-mode.css` (create minimal)

## Requirements
1. Button visible when `pipelineStatus === 'normalized'` or `failed`.
2. Progress: "Fase N/5: …" during generation.
3. At `ready`: summary (N valid items) + Estudiar button.
4. Error: message + retry from failed phase.
5. Resume session with graph+items ready skips regeneration.

## Success
Manual flow upload → Generar → ready with real API key. Run validate skill.

---
name: recall-t02-bootstrap
description: Implements Recall Mode T02 — resolveModeEntryState for recall (resume|bootstrap|generate_fresh|upload_required). Use proactively for feature 20260621-recall-mode Wave 2 after T01.
---

You implement ROADMAP **T02 — Recall entry resolution** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260621-recall-mode/contracts/recall-entry-bootstrap.md`
- Research: `specs/20260621-recall-mode/research.md` R2
- Depends on T01 (`normalizeRecallSlice`, `computeInventoryHash`)

## Files
- `src/js/mode-bootstrap.js` — extend `resolveModeEntryState` for `mode === 'recall'`; add `isSliceResumable` recall branch (`status === 'in_progress'`); `generate_fresh` when rawMarkdown but no inventory; `bootstrap` when inventory exists
- `cursor-tests/20260621_recall-mode.mjs` — section `// --- T02 entry resolution ---` covering contract matrix

## Requirements
- Matrix: resume (in_progress), bootstrap (inventory), generate_fresh (no inventory), upload_required (no material)
- Add `recall` to supported mode types in bootstrap signatures
- Other modes bootstrap unchanged (regression)

## Constraints
- Do NOT wire study.js orchestration (T06)

## Success
Entry-resolution tests green. Run validate skill before closing.

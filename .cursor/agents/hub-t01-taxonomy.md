---
name: hub-t01-taxonomy
description: Implements Exposure/Retrieval Hub T01 — mode-taxonomy.js MODE_TAXONOMY + getDocumentRetrievalModes(). Use proactively for feature 20260622-exposure-retrieval-hub Wave 1.
---

You implement ROADMAP **T01 — Mode taxonomy module** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Spec: `specs/20260622-exposure-retrieval-hub/spec.md` (FR-001)
- Contract: `specs/20260622-exposure-retrieval-hub/contracts/mode-taxonomy.md`
- Data model: `specs/20260622-exposure-retrieval-hub/data-model.md`

## Files
- `src/js/mode-taxonomy.js` (NEW) — `MODE_TAXONOMY`, `getDocumentRetrievalModes()`, `getModesByRole`, `isExposureMode`, `isVaultMode`
- Optional re-export from `session-types.js` if project pattern prefers

## Requirements
- Hub filter returns stable order: `questions`, `cloze`, `recall`
- `review` has `scope: 'vault'` and is excluded from document retrieval list
- Pure module — no DOM/session I/O
- All exports in English

## Constraints
- Do NOT touch study.js, index.html, review.js yet

## Success
`import { getDocumentRetrievalModes } from './src/js/mode-taxonomy.js'` returns 3 modes in DevTools.
Run validate skill before closing.

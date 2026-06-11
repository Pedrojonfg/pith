---
name: mode-continuity-t02
description: Implements Mode Continuity T02 — session-store uploadMeta and assessmentSignals CRUD. Use proactively for feature 20260612-mode-continuity.
---

You implement ROADMAP **T02 — Session store extensions** for feature `20260612-mode-continuity`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Data model: `specs/20260612-mode-continuity/data-model.md` (uploadMeta, assessmentSignals)
- Import `mergeAssessmentSignals` from `src/js/assessment-signals.js` (create minimal stub if T01 not done yet, then replace with real import)

## Files
- `src/js/session-store.js` — defaults in `createSession`; add `setUploadMeta`, `syncAssessmentSignalsToShared`, `getAssessmentSignals`
- `src/js/session-types.js` — optional validation for `uploadMeta`, `assessmentSignals`
- `cursor-tests/20260612_mode-continuity.mjs` — section `// --- T02 session store ---` with CRUD tests

## Requirements
- Backward compatible: no schemaVersion bump
- `createSession` defaults: `uploadMeta: null`, `assessmentSignals: []`
- `setUploadMeta(docId, meta)` — writes fileName, originalFormat, uploadedAt
- `syncAssessmentSignalsToShared(docId, slice, sourceMode)` — extract via `extractSignalsFromBlockSession` + merge + saveActiveSession
- `getAssessmentSignals(docId)` — returns array from shared

## Constraints
- Do NOT modify study.js or mode-bootstrap.js
- If assessment-signals.js missing, implement import path and ensure functions exist (coordinate with T01 API from contract)
- Append T02 tests only; preserve T01/T03 sections if present

## Success
createSession includes defaults; sync merge persists in doc mock. Tests pass with register.mjs. Run validate skill before closing.

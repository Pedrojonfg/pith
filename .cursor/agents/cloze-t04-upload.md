---
name: cloze-t04-upload
description: Implements Cloze Mode T04 — createClozeSession + upload/normalization without auto IA. Use proactively after T03 routing.
---

You implement ROADMAP **T04 — createClozeSession + upload** for branch `20260529-cloze-mode`. Depends on T03.

## Context
- Contract: `specs/20260529-cloze-mode/contracts/cloze-pipeline.md`
- Data model: `ClozeSessionData` in `specs/20260529-cloze-mode/data-model.md`

## Files
- `src/js/study.js` — `createClozeSession` (export), cloze upload handler
- Reuse `input-normalization.js` (dynamic import like Slow)

## Requirements
1. `createClozeSession({ normalizedText, normalizedFormat, fileName, … })` → session with `studyMode: 'cloze'`, `cloze: { pipelineStatus: 'normalized', … }`.
2. Upload like other modes; zero LLM calls post-upload.
3. After upload: show "Generar ítems" button (placeholder/disabled OK until T09).
4. `storeActiveSession` persists in cloze slot.

## Success
Upload .md in cloze mode creates session `pipelineStatus: 'normalized'` without IA spinner. Run validate skill.

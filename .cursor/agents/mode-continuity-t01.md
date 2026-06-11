---
name: mode-continuity-t01
description: Implements Mode Continuity T01 — assessment-signals.js extract, merge, prioritize (pure). Use proactively for feature 20260612-mode-continuity.
---

You implement ROADMAP **T01 — Assessment signals** for feature `20260612-mode-continuity`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260612-mode-continuity/contracts/assessment-signals-api.md`
- Data model: `specs/20260612-mode-continuity/data-model.md` (AssessmentSignal, weight formula)

## Files
- `src/js/assessment-signals.js` (NEW) — `extractSignalsFromBlockSession`, `mergeAssessmentSignals`, `prioritizeByAssessmentSignals`
- `cursor-tests/20260612_mode-continuity.mjs` (NEW) — section `// --- T01 assessment signals ---` with ≥10 unit cases

## Requirements
- Pure functions only: no DOM, no localStorage
- Weight per data-model formula (wrongCount - correctCount*0.5, lastResult bonuses)
- Question→concept mapping: block.concepts[qi], block.concept_ids[qi], block.title, else synthetic `block_${bi}_q_${qi}`
- `prioritizeByAssessmentSignals`: weak = weight>0 && (lastResult==='wrong' || wrongCount>correctCount); sort weight desc, index asc
- Skip empty user_answer in extract

## Constraints
- Do NOT modify session-store.js or study.js in this task
- If test file exists, append T01 section only; do not remove other sections

## Success
≥10 assessment unit tests pass with `node --import ./cursor-tests/register.mjs cursor-tests/20260612_mode-continuity.mjs`. Run validate skill before closing.

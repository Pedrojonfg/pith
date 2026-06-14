---
name: recall-t03-generation
description: Implements Recall Mode T03 — generateRecallQuestions LLM API + parser in api.js. Use proactively for feature 20260621-recall-mode Wave 2 parallel with T02/T04/T05.
---

You implement ROADMAP **T03 — generateRecallQuestions** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T03
- Contract: `specs/20260621-recall-mode/contracts/recall-generation.md`
- Research: `specs/20260621-recall-mode/research.md` R3–R4
- Spec: FR-002–FR-005

## Files
- `src/js/api.js` — `generateRecallQuestions`, JSON parser, validation (≥1 synthesis, valid concept_ids, source_chunks)

## Requirements
- Prompt in English; temperature ~0.4
- Question count scales with doc size tier
- Weak concepts weighted when assessmentSignals passed
- Parser rejects invalid LLM output with clear error
- Export function for manual/console smoke test

## Constraints
- Do NOT touch study.js orchestration yet

## Success
Manual call with fixture inventory returns valid question array. Run validate skill before closing.

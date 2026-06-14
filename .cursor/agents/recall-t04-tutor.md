---
name: recall-t04-tutor
description: Implements Recall Mode T04 — deepSeekRecallTutor + quality parser in api.js. Use proactively for feature 20260621-recall-mode Wave 2 parallel with T02/T03/T05.
---

You implement ROADMAP **T04 — deepSeekRecallTutor** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contract: `specs/20260621-recall-mode/contracts/recall-tutor.md`
- Research: `specs/20260621-recall-mode/research.md` R5
- Spec: FR-010–FR-011

## Files
- `src/js/api.js` — `deepSeekRecallTutor`, quality normalization

## Requirements
- Tutor receives source_chunk + concept_definitions (not title-only)
- Returns critique, suggested_answer, quality enum
- Empty student_answer rejected before LLM call
- Temperature ~0.2
- Unknown quality → partial with dev warn only

## Constraints
- Do NOT modify RSVP socratic tutor (T10)

## Success
Fixture Q+A returns valid TutorFeedback JSON shape (unit test or parser test without live LLM). Run validate skill before closing.

---
name: recall-t07-downstream
description: Implements Recall Mode T07 — SM-2 ingest + assessment signals from tutor quality. Use proactively for feature 20260621-recall-mode Wave 4 parallel with T08 after T06.
---

You implement ROADMAP **T07 — SM-2 + assessment signals** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- Contract: `specs/20260621-recall-mode/contracts/recall-downstream.md`
- Research: R6–R7; Spec: FR-012–FR-013
- Depends on T04, T06

## Files
- `src/js/sm2-ingest.js` — `ingestSm2FromRecallAnswer`, `RECALL_QUALITY_TO_SM2`
- `src/js/assessment-signals.js` — `syncAssessmentSignalsFromRecall` (sourceMode recall)
- Optional: `src/js/vault/mastery-model.js` — recall observation types

## Requirements
- partial/insufficient → weak signals per concept_id
- strong/adequate → strong signals
- smItems `recall_question` created/updated per concept
- Wire ingest from study.js tutor submit handler

## Success
Quickstart Wave 5 passes; mapping tests in cursor-tests. Run validate skill before closing.

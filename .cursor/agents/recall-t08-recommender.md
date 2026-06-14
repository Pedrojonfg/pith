---
name: recall-t08-recommender
description: Implements Recall Mode T08 — flow recommender shouldSuggestRecall hooks. Use proactively for feature 20260621-recall-mode Wave 4 parallel with T07 after T02.
---

You implement ROADMAP **T08 — Flow recommender hooks** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T08
- Contract: `specs/20260621-recall-mode/contracts/recall-downstream.md`
- Research: R10; Spec: FR-016
- Depends on T02

## Files
- `src/js/recommender.js` and/or flow recommendation tracker — `shouldSuggestRecall` rules
- Flow panel copy in study.js: "Continue with Recall" when appropriate

## Requirements
- After RSVP on high argumentative density → Recall before Cloze in suggestion
- After Slow complete → Recall suggested
- Sparse assessment signals → Recall suggested to seed Cloze

## Success
Quickstart Wave 6 passes. Run validate skill before closing.

---
name: rsvp-assessment-t01-flags
description: Implements RSVP Assessment Reposition T01 — feature flags + isPrePackingAssessmentEnabled(). Use proactively for feature 20260611-rsvp-assessment-reposition.
---

You implement ROADMAP **T01 — Feature flags** for feature `20260611-rsvp-assessment-reposition`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contract: `specs/20260611-rsvp-assessment-reposition/contracts/feature-flags.md`

## Files
- `src/js/config/flags.js` (NEW) — `ASSESSMENT_FLAGS`, `isPrePackingAssessmentEnabled()`

## Requirements
- Default values per spec §7 / contract
- Named exports only; no side effects; no DOM
- `isPrePackingAssessmentEnabled()` returns `true` by default

## Constraints
- Do not modify study.js, session.js, api.js in this task

## Success
Module importable from study.js. Run `.cursor/skills/validate/SKILL.md` before closing.

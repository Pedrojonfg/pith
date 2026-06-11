---
name: rsvp-assessment-t02-session
description: Implements RSVP Assessment Reposition T02 — knowledge_profile session meta helpers. Use proactively for feature 20260611-rsvp-assessment-reposition.
---

You implement ROADMAP **T02 — Session meta persistence** for feature `20260611-rsvp-assessment-reposition`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Data model: `specs/20260611-rsvp-assessment-reposition/data-model.md`

## Files
- `src/js/session.js` — `setKnowledgeProfile`, `getKnowledgeProfile`, `setAssessmentSkipped`, `setPackingIgnoredProfile`
- `cursor-tests/20260611_rsvp-assessment-reposition.mjs` (NEW) — meta CRUD section (≥6 cases)

## Requirements
- Backward compatible optional `_meta` fields
- `assessment_skipped` only on quiz skip; `packing_ignored_profile` only on Ignorar
- Never filter inventory on persist

## Success
Meta tests pass: `node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-assessment-reposition.mjs`. Run validate skill before closing.

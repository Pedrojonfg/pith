---
name: cloze-t12-qa
description: Implements Cloze Mode T12 — cursor-tests + quickstart QA closure. Use proactively after T10 and T11 complete.
---

You implement ROADMAP **T12 — Tests + quickstart QA** for branch `20260529-cloze-mode`. Depends on T10+T11.

## Context
- `specs/20260529-cloze-mode/quickstart.md`

## Files
- `cursor-tests/20260529_t01-cloze-sessions.mjs` (complete if needed)
- `cursor-tests/20260529_t02-cloze-pipeline-status.mjs` (create)
- `cursor-tests/20260529_t03-cloze-valid-items.mjs` (create)

## Requirements
1. Tests cover: cloze slot, pipelineStatus transitions, valid items filter.
2. Run quickstart §1–8 manually documenting results.
3. Verify RSVP/Slow regression §8.

## Success
All 3 cursor-tests pass; quickstart §1–7 verified. Run validate skill.

---
name: recall-t09-qa
description: Closes Recall Mode v1 — integration tests + ROADMAP [x] marks. Use proactively for feature 20260621-recall-mode Wave 5 after T01–T08.
---

You implement ROADMAP **T09 — Integration tests + QA closure** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T09
- Quickstart: `specs/20260621-recall-mode/quickstart.md`
- All contracts + spec success criteria

## Files
- `cursor-tests/20260621_recall-mode.mjs` — complete suite: entry resolution, quality mapping, signal weight, normalizeRecallSlice + hash, regression other modes
- `ROADMAP.md` — mark T01–T09 `[x]`

## Tests must cover
- resolveModeEntryState recall matrix
- RECALL_QUALITY_TO_SM2 mapping
- assessment signal weight for recall weak
- normalizeRecallSlice + inventory hash invalidation
- Regression: other modes bootstrap unchanged

## Success
`node --import ./cursor-tests/register.mjs cursor-tests/20260621_recall-mode.mjs` green; quickstart checklist done; SW validate if assets changed. Run validate skill before closing.

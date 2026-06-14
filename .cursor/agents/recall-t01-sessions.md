---
name: recall-t01-sessions
description: Implements Recall Mode T01 — modes.recall slice helpers, normalizeRecallSlice, computeInventoryHash. Use proactively for feature 20260621-recall-mode Wave 1.
---

You implement ROADMAP **T01 — Recall session slice** for feature `20260621-recall-mode`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Spec: `specs/20260621-recall-mode/spec.md` (FR-014)
- Data model: `specs/20260621-recall-mode/data-model.md`
- Contract: `specs/20260621-recall-mode/contracts/recall-entry-bootstrap.md`
- Draft reference: `specs/spec-vaciado.md` section 4

## Files
- `src/js/session.js` — `normalizeRecallSlice`, `createEmptyRecallSlice`, `computeInventoryHash(inventory, pedagogicalMeta)`; extend `normalizeStudyMode` for `'recall'`
- `src/js/session-types.js` — add `recall` to `MODE_KEYS`
- `src/js/session-store.js` — `modes.recall: null` in `createSession`; normalize recall slice on session load if present
- `cursor-tests/20260621_recall-mode.mjs` (NEW) — section `// --- T01 recall slice ---` with slice + hash tests

## Requirements
- Canonical slice: status, questions, currentIndex, config, _meta per data-model
- `computeInventoryHash` changes when inventory or pedagogical meta changes materially
- Legacy/missing slice normalizes without throw
- All comments/exports in English

## Constraints
- Do NOT touch `api.js`, `study.js` UI wiring, or `mode-bootstrap.js` yet

## Success
DevTools round-trip `modes.recall` on test session; T01 cursor-tests pass:
`node --import ./cursor-tests/register.mjs cursor-tests/20260621_recall-mode.mjs`
Run validate skill before closing.

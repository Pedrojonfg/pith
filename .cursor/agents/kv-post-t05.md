---
name: kv-post-t05
description: Implements Post A+ T05 — misconception model + session-close detection. Use proactively after kv-post-t01 Wave 3 parallel with T07+T09.
---

You implement ROADMAP **T05 — Misconception detection**. Depends on T01.

## Files
- `src/js/vault/misconceptions.js` (NEW)
- `src/js/vault/session-close.js` — wrongAnswer, taskKind; detection after applyObservations
- `src/js/api.js` — optional `detectMisconceptionPattern`
- `src/js/vault/debug-ui.js` — misconceptions in detail view

## Success
≥3 related negative obs → misconception; <3 → none; FR-301–304; quickstart Wave 3 steps 1–3.

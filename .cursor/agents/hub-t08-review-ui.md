---
name: hub-t08-review-ui
description: Implements Exposure/Retrieval Hub T08 — vault Review on doc library, remove per-doc Review from mode select. Use proactively after T06 for feature 20260622-exposure-retrieval-hub Wave 3.
---

You implement ROADMAP **T08 — Review UI relocation** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T08
- Contracts: `vault-review.md`, `retrieval-hub-ui.md`
- Depends on T06

## Files
- `index.html` — `#btnVaultReview` + badge on `screenDocLibrary`; remove `#btnReview` from mode select
- `src/js/study.js` — wire vault Review button; `refreshVaultReviewBadge()` on library enter
- Update `startReviewFromRecommendation()` to use vault Review

## Success
Mode select has no Review button; doc library Review shows aggregate due badge.
Run validate skill before closing.

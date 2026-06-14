---
name: hub-t06-vault-review
description: Implements Exposure/Retrieval Hub T06 — runVaultSm2ReviewSession cross-document SM-2. Use proactively for feature 20260622-exposure-retrieval-hub Wave 2 parallel with T03/T05.
---

You implement ROADMAP **T06 — Vault-level Review session** for feature `20260622-exposure-retrieval-hub`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T06
- Contract: `specs/20260622-exposure-retrieval-hub/contracts/vault-review.md`
- Depends on T01

## Files
- `src/js/review.js` — `runVaultSm2ReviewSession()`; per-item write via `upsertSmItem(item.docId, ...)`
- `src/js/session-store.js` — `getVaultReviewDueCount()` helper if needed
- `src/js/study.js` — redirect `enterModeWithContinuity('review')` to vault path

## Requirements
- Queue built from all sessions' due items via `getSmItemsDueToday()`
- Rating updates origin document without switching active doc
- Empty queue shows existing empty state

## Success
Two docs with due items both appear in vault queue.
Run validate skill before closing.

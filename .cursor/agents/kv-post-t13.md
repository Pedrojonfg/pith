---
name: kv-post-t13
description: Implements Post A+ T13 — vault-driven spaced review to smItems. Use proactively after T07+T11 Wave 4 parallel with T12.
---

You implement ROADMAP **T13 — Vault-driven spaced review**. Depends on T07, T11.

## Files
- `src/js/vault/spaced-review.js` (NEW) — `syncVaultToReviewPool`
- `src/js/study.js` — hook mode-select and session-close
- `src/js/session-store.js` — smItems vaultEntryId if needed

## Success
Decaying concepts enter review pool; centrality boosts priority; review updates vault; quickstart Wave 7.

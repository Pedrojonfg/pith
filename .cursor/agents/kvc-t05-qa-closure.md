---
name: kvc-t05-qa-closure
description: Closes Knowledge Vault Curation T05 — integration tests, SW bump, ROADMAP QA. Use proactively after T01-T04 for feature 20260624-knowledge-vault-curation.
---

You implement T05 QA closure for `20260624-knowledge-vault-curation`.

**Tasks**:
1. `cursor-tests/20260624_knowledge-vault-curation.mjs` — tests: getStudiedConcepts, dual pool merge, migration, observation weights, quality mapping
2. Bump `SW_VERSION` in `src/js/sw-update.js`, `?v=` in `index.html`, `CACHE_NAME` in `sw.js` to `pith-v33` / `20260624_1`
3. Mark ROADMAP T01-T05 `[x]`; verify quickstart checklist

Run: `node cursor-tests/20260624_knowledge-vault-curation.mjs` and `node cursor-tests/20260606_validate-sw-update-flow.mjs`

criterio de éxito: all cursor-tests pass. Ejecuta /validate antes de cerrar este mensaje.

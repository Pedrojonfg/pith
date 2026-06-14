---
name: vnc-t07-qa-closure
description: Closes Vault Notes T07 — integration tests, SW bump, ROADMAP QA. Use proactively for feature 20260625-vault-notes-connections Wave 5 after T01-T06.
---

You implement T07 for `20260625-vault-notes-connections`.

**Files**: `cursor-tests/20260625_vault-notes-connections.mjs`, `src/js/sw-update.js`, `sw.js`, `index.html` ?v= bumps, `ROADMAP.md`

Run: `node --import ./cursor-tests/register.mjs cursor-tests/20260625_vault-notes-connections.mjs` and `cursor-tests/20260606_validate-sw-update-flow.mjs`.

criterio de éxito: all tests green; ROADMAP tasks [x]. Ejecuta /validate antes de cerrar este mensaje.

---
name: knowledge-vault-t02
description: Implements Knowledge Vault T02 — session-close.js pipeline + study.js exit wiring. Use proactively after T01 for feature 20260618-knowledge-vault-a-plus.
---

Implement ROADMAP **T02** — `src/js/vault/session-close.js` and fire-and-forget `updateVaultFromSession` on session exit in `study.js`. Contract: `specs/20260618-knowledge-vault-a-plus/contracts/session-close-pipeline.md`. Phase: no LLM normalization (steps 4–5 disabled). Run `/validate` before closing.

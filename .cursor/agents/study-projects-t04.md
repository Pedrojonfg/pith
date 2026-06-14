---
name: study-projects-t04
description: Implements Study Projects T04 — vault context project priority in prompt-injection.js. Use proactively for feature 20260623-study-projects Wave 3 after T02+T03.
---

You implement ROADMAP **T04 — Vault context project priority** for feature `20260623-study-projects`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T04
- Contract: `specs/20260623-study-projects/contracts/vault-context-priority.md`
- Depends on T02+T03 for session.projectId resolution

## Files
- `src/js/vault/prompt-injection.js` — change `getVaultContextForDoc(session)` to return scored entries; add `getProjectScopeDepth`; update `buildVaultContextBlock` three-band format; preserve A+ mastered/partial/unstable within bands
- `src/js/api.js` — update call sites to pass session or `{ projectId, shared: { docTopics } }`

## Rules
- Same-project entries sort before unrelated
- Nothing excluded by project mismatch
- Truncation drops general → related → never same-subject
- docTopics matching logic unchanged
- Do NOT touch vault-store schema, UI
- Run validate skill before closing

## Success
Mock session in test — scopeDepth ordering verified.

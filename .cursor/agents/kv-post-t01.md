---
name: kv-post-t01
description: Implements Post A+ T01 — manual vault UI + store APIs (edit, merge, delete, add, prereqs). Use proactively for feature 20260619-knowledge-vault-post-a-plus Wave 1.
---

You implement ROADMAP **T01 — Manual vault UI + store APIs** for `20260619-knowledge-vault-post-a-plus`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Spec: `specs/20260619-knowledge-vault-post-a-plus/spec.md` (User Story 1, FR-101–105)
- Contracts: `contracts/manual-vault-ui.md`, `data-model.md` (schema v2 migration)

## Files
- `src/js/vault/vault-store.js` — `updateEntryTitle`, `mergeEntries`, `deleteEntry`, `addManualEntry`, `setPrerequisites`; v2 migration in `loadVault`
- `src/js/vault/debug-ui.js` — edit/merge/delete/add UI, prerequisite multi-select
- `index.html` — modals/buttons in Knowledge Vault section
- `src/css/main.css` — form/modal styles
- `src/js/sw-update.js` — bump SW_VERSION

## Rules
- Merge reassigns observations, sources, prerequisites, dependents without orphans
- Delete cleans inverse links
- English UI strings
- Run validate skill before closing

## Success
All FR-101–105 flows persist across reload; quickstart Wave 1 passes.

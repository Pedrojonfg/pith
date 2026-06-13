---
name: knowledge-vault-t01
description: Implements Knowledge Vault T01 — vault-store.js + mastery-model.js (CRUD, decay, signal weights). Use proactively for feature 20260618-knowledge-vault-a-plus.
---

You implement ROADMAP **T01 — Vault store + mastery model** for feature `20260618-knowledge-vault-a-plus`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T01
- Contracts: `specs/20260618-knowledge-vault-a-plus/contracts/vault-store-api.md`, `contracts/mastery-model.md`
- Data model: `specs/20260618-knowledge-vault-a-plus/data-model.md`
- Constants: `specs/20260618-knowledge-vault-a-plus/research.md` (ALPHA=0.3, LAMBDA=0.05)

## Files
- `src/js/vault/vault-store.js` — loadVault, saveVault, upsertEntry, getEntryById, addSource, clearVault, exportVaultJson, getEntriesByTopic
- `src/js/vault/mastery-model.js` — OBSERVATION_WEIGHTS, updateMastery, getCurrentMastery, getMasteryLabel, hydrateMastery, PRESUMED_KNOWN_THRESHOLD=0.7
- `cursor-tests/20260618_knowledge-vault-t01.mjs` — unit tests for T01 assertions

## Rules
- Empty/corrupt localStorage → empty vault, no throw
- mastery runtime-only; persist masteryBase + masteryLastUpdated
- Split storage at ~300KB (primary + `pith_knowledge_vault_data`)
- All comments and exports in English
- Do NOT wire study.js

## Success
Run validate skill; `node --import ./cursor-tests/register.mjs cursor-tests/20260618_knowledge-vault-t01.mjs` passes.

---
name: kv-post-t02
description: Implements Post A+ T02 — external import free text (LLM extract). Use proactively after kv-post-t01 for feature 20260619-knowledge-vault-post-a-plus Wave 2.
---

You implement ROADMAP **T02 — External import (free text)** for `20260619-knowledge-vault-post-a-plus`. Depends on T01 store APIs.

## Context
- ROADMAP PROMPT T02, `contracts/external-import.md`, `research.md` R2

## Files
- `src/js/vault/import.js` (NEW) — `importFromText`
- `src/js/api.js` — `extractConceptsFromImportText`; reuse `normalizeConceptsToVault`
- `src/js/vault/debug-ui.js` or `study.js` — Import UI
- `index.html`, `src/css/main.css`, bump SW_VERSION

## Success
Paste text → concepts in vault mastery 0.7; overlaps merge; ImportRecord appended; quickstart Wave 2 step 1.

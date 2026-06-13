---
name: kv-post-t03
description: Implements Post A+ T03 — document import without session ("already know"). Use proactively after kv-post-t01 for feature 20260619-knowledge-vault-post-a-plus Wave 2 parallel with T02.
---

You implement ROADMAP **T03 — External import (document without session)**. Depends on T01.

## Context
- ROADMAP PROMPT T03, `contracts/external-import.md`

## Files
- `src/js/vault/import.js` — `importFromDocument`
- `src/js/study.js` — upload branch import-only
- `index.html` — checkbox "Already know this material"

## Success
Document + flag → vault concepts mastery ~0.8, no new session; quickstart Wave 2 step 2.

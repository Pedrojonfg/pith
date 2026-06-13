---
name: kv-post-t14
description: Implements Post A+ T14 — cursor-tests + quickstart QA closure. Use proactively after T01–T13 complete.
---

You implement ROADMAP **T14 — Integration tests + QA closure** for `20260619-knowledge-vault-post-a-plus`.

## Files
- `cursor-tests/20260619_knowledge-vault-post-a-plus.mjs` (NEW)
- `ROADMAP.md` — mark T01–T14 [x]

## Tests must cover
- merge/delete/prereq invariants
- import partial success
- misconception threshold
- co-prerequisite cycle
- importance ordering
- BKT gate (if T08 done)
- A+ session-close regression

## Success
`node cursor-tests/20260619_knowledge-vault-post-a-plus.mjs` passes; quickstart documented.

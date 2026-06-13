---
name: kv-post-t11
description: Implements Post A+ T11 — topological importance scoring. Use proactively after kv-post-t09 parallel with T10.
---

You implement ROADMAP **T11 — Topological importance**. Depends on T09.

## Files
- `src/js/vault/prerequisite-graph.js` — `computeImportanceScore`
- Recompute on prereq/co-prereq changes

## Success
Central concepts score higher than leaves; importance ordering cursor-tests.

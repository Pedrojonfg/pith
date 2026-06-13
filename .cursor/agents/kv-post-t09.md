---
name: kv-post-t09
description: Implements Post A+ T09 — prerequisite cycle detection + co-prerequisites. Use proactively after kv-post-t01 Wave 3 parallel with T05+T07.
---

You implement ROADMAP **T09 — Prerequisite cycles + co-prerequisites**. Depends on T01.

## Files
- `src/js/vault/prerequisite-graph.js` (NEW) — `addPrerequisiteSafe`
- `src/js/vault/vault-store.js` — safe add in setPrerequisites
- `debug-ui.js` — co-prerequisite badge

## Success
A→B + B→A → co-prerequisite pair, no crash; quickstart Wave 5 step 1.

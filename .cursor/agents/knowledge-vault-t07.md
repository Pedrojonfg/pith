---
name: knowledge-vault-t07
description: Implements Knowledge Vault T07 — docTopics on buildDocumentHierarchy + session-types. Use proactively for feature 20260618-knowledge-vault-a-plus; parallel with T01.
---

You implement ROADMAP **T07 — Document topic tags** for feature `20260618-knowledge-vault-a-plus`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T07
- research.md Decision 4; data-model `docTopics` field

## Modify
- `src/js/normalization/hierarchy.js` — LLM prompt/output `topics: string[]` (2–5 tags); parse and return on hierarchy result; default `[]` on deterministic/trivial paths
- `src/js/session-types.js` — document `shared.docTopics: string[]`; validate in validateDocumentSession
- `src/js/session-store.js` — default `docTopics: []` on createSession
- `src/js/study.js` — persist `doc.shared.docTopics` when hierarchy is built (syncSlowDocHierarchyToShared, recommendFlowFromUploadedFile, etc.)

## Rules
- No extra LLM call — piggyback hierarchy call
- Legacy sessions default docTopics []

## Success
Run validate skill; cursor-tests section for docTopics passes.

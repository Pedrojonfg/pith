---
name: kv-post-t10
description: Implements Post A+ T10 — LLM cross-document prerequisite inference. Use proactively after kv-post-t09 parallel with T11.
---

You implement ROADMAP **T10 — LLM cross-document prerequisite inference**. Depends on T09.

## Files
- `src/js/vault/prerequisite-graph.js` — `maybeInferPrerequisites`
- `src/js/api.js` — LLM batch inference
- Trigger after 5 docs per topic (docTopics from A+)

## Success
High-confidence auto-applied; medium queued in debug UI; quickstart Wave 5 step 2.

# Quickstart: Typed & Weighted Concept Connections

## Automated

```bash
node cursor-tests/20260620_typed-weighted-connections.mjs
```

## Manual

1. Upload a document; wait for DPP T1.3 graph with prerequisite-like edge.
2. Engage both concepts until yellow+ in registry (MCQ/recall).
3. Open vault graph — edge shows typed style and initial thin weight.
4. Correct recall involving both concepts — edge thickens on reload.
5. Legacy registry (no connections array) — graph loads with defaults.

## Regression

- Document material graph (`shared.conceptGraph`) unchanged after upload.
- Recall/cloze submission succeeds if connection write fails (devtools: throw in `upsertRegistryConnection`).

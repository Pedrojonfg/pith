# Quickstart QA: Global Knowledge Vault (Post A+)

**Feature**: `20260619-knowledge-vault-post-a-plus`  
**Branch**: `20260619-knowledge-vault-post-a-plus`

## Prerequisites

- A+ validated (FR-000): vault populated, dedup OK, packing benefits visible
- API key configured
- At least 2 study sessions completed on overlapping topic

## Wave 1 — Manual vault (T01)

1. Open Settings → Knowledge Vault.
2. Edit a concept title → reload → title persists.
3. Create duplicate-like entry manually; merge into original → single entry, combined sources.
4. Add manual concept "Prior exposure topic" with mastery 0.9.
5. Delete a test entry → confirm gone from list and prereq refs cleaned.

## Wave 2 — Import (T02–T04)

1. Import text: "I know Python basics: variables, loops, functions" → concepts appear with ~0.7 mastery.
2. Upload short PDF with "Already know" → concepts in vault, no new study session.
3. Import sample CSV with 3 rows → partial error on bad row still imports valid rows.

## Wave 3 — Misconceptions (T05–T06)

1. DevTools: seed 3 `mcq_wrong` obs same concept, same wrongAnswer.
2. Close session / trigger detection.
3. **Expect**: Misconception on detail view.
4. Pack new block on that concept → prompt context includes misconception (dev log or export).

## Wave 4 — Mastery dimensions (T07)

1. Answer definition MCQ → declarative mastery moves.
2. Answer application socratic → procedural mastery moves.
3. Overall bar reflects weighted blend.

## Wave 5 — Prerequisite graph (T09–T11)

1. Add prereq A→B and B→A via UI → co-prerequisite badges, no crash.
2. After 5 docs same topic (or mock trigger) → inferred edges in queue or auto-applied.
3. Central concept with many dependents ranks higher in review priority (T13).

## Wave 6 — Graph UI (T12)

1. Vault ≥10 concepts → View graph opens.
2. Nodes colored by mastery; click shows detail panel.

## Wave 7 — Spaced review (T13)

1. Set entry `masteryLastUpdated` 10 days ago, low masteryBase.
2. Open mode select → entry appears in review pool.
3. Complete review → vault mastery updates.

## Regression

- A+ session-close still populates vault
- Assessment pre-fill still works
- Clear vault still works

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260619_knowledge-vault-post-a-plus.mjs
```

**T14 closure (2026-06-13)**: Integration test covers merge/delete/prereq invariants, import partial success, misconception threshold, co-prerequisite cycle, importance ordering, BKT gate, and A+ session-close regression. Manual quickstart Waves 1–7 and regression checklist validated against automated coverage.

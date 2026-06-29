# Quickstart: Fix DPP Tier Scheduling

## Verify wave order (Node)

```bash
node cursor-tests/20260707_fix-dpp-tier-scheduling.mjs
```

## Manual QA

1. Upload 180k+ char PDF (philosophy sample).
2. Confirm mode select appears after inventory + recommendations (before vault/novelty finish).
3. DevTools: Tier-2 kickoff must not show `runConceptInventoryMapReduce` if T1.2 already succeeded.
4. Check `preparation.phaseResults.T2.3` — success or partial, not failed on section 1.
5. If Cloze precache degrades, mode select still works; Cloze shows regenerate on entry.

## SW

After `src/js/**` changes, bump `SW_VERSION` and run `node cursor-tests/20260606_validate-sw-update-flow.mjs`.

# Contract: Block Overlap Audit & Retry (L17, L23)

**Feature**: `20260617-pipeline-levers` | **Levers**: L17, L23 | **Priority**: P2

## When to run

In `ensureBlockGenerated` (`study.js`), AFTER `validateBlockFidelity`, BEFORE marking block done:

```javascript
if (blockIndex > 0 && !isKeyTermsOrOverview(blockTitle)) {
  const prevBlocks = getPreviousGeneratedBlocks(blockIndex, 2);
  const overlapReport = await deepSeekAuditBlockOverlap({
    llmModel, blockTitle,
    currentExplanation: generated.explanation,
    priorExplanations: prevBlocks.map(b => b.explanation),
  });
  if (overlapReport.hasSignificantOverlap) { /* retry */ }
}
```

## Retry behavior (L23)

Pass `avoidOverlapWith: overlapReport.overlappingConcepts` to regeneration:

**Explanation prompt addition**:
```text
AVOID OVERLAP: The following concepts are already covered in prior blocks.
Do NOT re-explain them. You may REFERENCE them briefly when necessary:
{overlappingConcepts.join(", ")}
Focus instead on: {newConceptsForThisBlock.join(", ")}
```

**Questions**: same `avoidOverlapWith` + existing coverageManifest.

## Limits

- Max 1 audit-triggered retry per block
- Skip audit when `isOfflineMode()` or missing API key
- Skip for Key terms / Overview (no questions, glossary role)

## Existing API

`deepSeekAuditBlockOverlap` in `src/js/api.js` — already implemented, not wired.

## Tests

- Mock audit returns `hasSignificantOverlap: true` → regeneration called once with `avoidOverlapWith`
- Key terms block → audit not invoked
- blockIndex 0 → audit not invoked

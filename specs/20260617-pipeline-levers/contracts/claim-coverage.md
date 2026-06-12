# Contract: Claim Coverage Validation (L21, L20)

**Feature**: `20260617-pipeline-levers` | **Levers**: L21, L20 | **Priority**: P1

## Metrics

### chunk_coverage (L20)

```javascript
chunk_coverage = countChunkKeyTermsInExplanation(chunk, explanation) / totalChunkKeyTerms;
```

### claimCoverageRatio (L21)

```javascript
const claims = extractedClaims.claims; // from deepSeekExtractSourceClaims
const covered = claims.filter(c => claimCoveredInExplanation(c, explanation));
claimCoverageRatio = covered.length / claims.length;
```

## Thresholds

| Mode | Jaccard min | chunk_coverage warn | claimCoverage retry |
|------|-------------|---------------------|---------------------|
| strict | 0.35 | < 0.50 → warn | < 0.60 → retry |
| normal | 0.20 | < 0.40 → warn | < 0.50 → retry |

## Retry prompt

```text
The following claims from the source were not covered in your explanation:
{uncoveredClaims.map(c => c.source_phrase).join(", ")}
Include them in your explanation without adding material outside the chunk.
```

## Module

- `src/js/fidelity-validation.js` — extend `validateBlockFidelity` return type with `claimCoverageRatio`, `uncoveredClaims`, `chunk_coverage`
- `src/js/study.js` — `ensureBlockGenerated` retry loop (max 1)

## Tests

- Explanation omitting 50% of claims → `severity: retry`
- Full coverage → `severity: ok`
- chunk_coverage low with ok Jaccard → warn (thin block signal)

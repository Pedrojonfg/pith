# Data Model — HTML Structure Extraction

## HeadingInferenceDiagnostics

| Field | Type | Description |
|-------|------|-------------|
| candidateCount | number | Blocks scored as potential headings before dedup |
| acceptedCount | number | Headings after threshold + dedup |
| rejectionReasons | Record<string, number> | Counts by reason code |
| bySource | Record<string, number> | Accepted headings grouped by source |

### Rejection reason codes

| Code | Meaning |
|------|---------|
| `artifact` | Block kind artifact |
| `below_threshold` | Score < 35 and not html heading kind |
| `empty_text` | Trimmed text empty |
| `outline_only` | Handled via outline branch |

## HeadingCandidate.source extensions

| Value | Confidence |
|-------|------------|
| `html-tag` | High — semantic tag or mw-headline in h* parent |
| `html-heuristic` | Low — mw-headline without semantic parent or style heuristic |
| `font-size` | Medium |
| `pattern` | Medium |
| `outline` | High |

## NormalizationDebugBag extensions

```javascript
{
  headingInferenceDiagnostics: HeadingInferenceDiagnostics | null,
  headingsFallbackUsed: boolean,  // existing
  tablesDetected: number,         // existing
  tablesEmittedOk: number         // existing
}
```

## Table conversion fallback

Plain-text block prefix: `[Table: could not convert — {rows} rows, {cols} cols]`

# Contract: SM-2 Review Queue Priority

## buildReviewQueue(items, now, options?)

**Options**:
- `gapFillPenalty`: number (default from flags)
- `maxGapFillPerSession`: number (default from flags)

**Ordering**:
1. Primary: `scheduledDue` ascending (unchanged)
2. Secondary (same due bucket ±1 hour): lower penalty score wins
3. `document` < `mnemonic` < `vault_curation` < `gap_fill` (gap_fill penalized)

**Session cap**: After sort, if building session queue, include at most `maxGapFillPerSession` gap_fill items.

## reviewProvenance

Set on `createSmItem` / `normalizeSmItem`. Valid values: `document`, `gap_fill`, `mnemonic`, `vault_curation`. Default `document`.

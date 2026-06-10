# Data Model: RSVP Block Count Recommendation

**Feature**: `20260611-rsvp-block-recommend`

## BlockCountSignals

Entrada a la fórmula determinística. Campos opcionales degradan con defaults.

| Field | Type | Source | Default |
|-------|------|--------|---------|
| `conceptCount` | `number` | `inventory.length` post-index | required |
| `wordCount` | `number` | `TextMetrics.wordCount` | `0` |
| `sectionCount` | `number` | hierarchy leaf count or heading proxy | `0` |
| `conceptualLoad` | `1..5` | `PedagogicalMeta.conceptualLoad` | `3` |
| `argumentativeDensity` | `1..5` | `PedagogicalMeta.argumentativeDensity` | `3` |
| `genre` | enum | `PedagogicalMeta.genre` | `'unknown'` |
| `firstPersonRatio` | `0..1` | `TextMetrics.contentSignals` | `0` |
| `sizeCategory` | enum | `TextMetrics.sizeCategory` | `'medium'` |

## BlockCountRecommendation

| Field | Type | Description |
|-------|------|-------------|
| `computedAt` | `number` | ms timestamp |
| `nBlocks` | `number` | 5–60 clamped |
| `reasoning` | `string` | 1–2 sentences EN for UI |
| `signalsUsed` | `string[]` | e.g. `['conceptCount','wordCount','conceptualLoad']` |
| `factors` | `object` | Debug: `{ conceptN, wordN, sectionN, multiplier, rawN }` |

## BlockSplitCache (ephemeral create-flow)

Vive en `state.blockSplitCache` durante pantalla create RSVP.

| Field | Type | Description |
|-------|------|-------------|
| `fingerprint` | `BlockSplitFingerprint` | Material identity |
| `conceptInventory` | `object[]` | Raw inventory from LLM |
| `recommendation` | `BlockCountRecommendation \| null` | Last computed recommendation |
| `indexedAt` | `number` | ms timestamp |

### BlockSplitFingerprint

| Field | Type | Description |
|-------|------|-------------|
| `fileKey` | `string` | `${name}:${size}:${lastModified}` joined for multi-file v1 single file |
| `studyNotes` | `string` | Trimmed study focus notes |
| `wordCount` | `number` | Extracted word count sanity check |

### Validity rules

- Cache **valid** iff current fingerprint equals stored fingerprint AND `conceptInventory.length > 0`
- **Invalidate** on file replace, study notes change, mode switch away from RSVP
- **Do not invalidate** on `blocksInput` change only

## CreateSessionMaterialContext (read-only aggregate)

No persistido; ensamblado en `study.js` al recommend:

```js
{
  cleanedText,
  textMetrics,        // analyzeText
  pedagogicalMeta,    // shared / hierarchy / deterministic
  sectionCount,
  studyNotes,
  fileKey,
}
```

## State transitions

```text
[empty]
  │ user clicks Recommend (no cache)
  ▼
[indexing] → runConceptInventory → [cached + recommendation]
  │
  │ user changes file OR notes
  ▼
[invalidated / empty]

[cached + recommendation]
  │ user clicks Generate
  ▼
[packing] → packInventoryToBlocks → block list screen
  (inventory NOT cleared until new upload)

[cached + recommendation]
  │ user clicks Recommend again (same fingerprint)
  ▼
[recompute recommendation only] — no re-index
```

## Relationship to existing entities

| Existing | Relationship |
|----------|--------------|
| `TextMetrics` | Reused from `recommendation/analyzer.js` |
| `PedagogicalMeta` | Reused from hierarchy / deterministic builder |
| `twoPhaseConceptSplit` | Wrapper; recommend uses phase 1 only |
| `state.materialGraphContext` | Populated after full generate (unchanged) |
| `DocumentSession.shared` | Read-only source for meta; no new persisted field v1 |

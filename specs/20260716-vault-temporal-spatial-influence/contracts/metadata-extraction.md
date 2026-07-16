# Contract: Vault metadata extraction

## Flag

```js
isVaultMetadataExtractionEnabled(): boolean  // default true after ship; kill-switch
```

## Enqueue API

```js
/** Fire-and-forget. No-op if flag off or entry already has metadataExtractedAt. */
enqueueVaultMetadataExtraction(entryIds: string[]): void
```

## Per-entry LLM (api.js)

### Temporal/spatial

- Model: Mistral Small; temperature 0.1  
- Constant: `MAX_TOKENS_TEMPORAL_SPATIAL_EXTRACTION` (sized for one object + short label)  
- Output JSON:
  ```json
  {
    "temporalRange": { "startYear": 0, "endYear": 0, "label": "" } | null,
    "geoLocation": { "placeName": "" } | null
  }
  ```
- Years: astronomical (negative = BCE). Prefer null over guess.

### Influence

- Constant: `MAX_TOKENS_INFLUENCE_DETECTION`  
- Input: promoted concept + immediate neighbor titles/ids  
- Output JSON:
  ```json
  { "edges": [ { "from": "id", "to": "id", "weight": 0.0 } ] }
  ```
- Must not emit edges already covered by PREREQUISITE|CONTRADICTS|EXEMPLIFIES|PART_OF|ASSOCIATED.

## Persistence after success

1. Set `temporalRange` / `geoLocation` (geo starts `geocodeStatus: "pending"` if placeName present, else field null).
2. Insert `INFLUENCED` connections via registry connection-store.
3. Set `metadataExtractedAt = Date.now()`.
4. If placeName: enqueue geocode (client → `geocode-proxy`).

## Failure

Log; leave fields null; still set `metadataExtractedAt` after a completed attempt so the job does not infinite-retry (optional: only set on success — prefer set on attempt complete to honor idempotency; document choice in code comment).

**Chosen**: set `metadataExtractedAt` after a finished attempt (success or parse failure) so promotion storms do not re-hammer the LLM; geocode failures use `geocodeStatus: "failed"` without clearing placeName.

## Non-goals

- Not a DPP phase; must not appear in `PHASE_RUNNERS` / `PHASE_DEPS` / `PHASE_LABELS`.
- Must not block `updateVaultFromSession` return.

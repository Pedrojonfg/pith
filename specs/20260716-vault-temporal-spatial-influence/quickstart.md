# Quickstart: Vault Temporal, Spatial, and Influence Views

## Dev setup

1. Apply migration `geocode_cache` to linked Supabase project.
2. Deploy Edge Function `geocode-proxy`.
3. Ensure `isVaultMetadataExtractionEnabled()` is true (or force in flags for local test).

## Manual smoke

1. Study a document with historical/geographic concepts until vault promotion fires (exit to mode select).
2. Confirm promotion is instant; shortly after, vault entry shows `temporalRange` / `geoLocation` / `metadataExtractedAt` in vault debug panel (or console).
3. Open vault graph → switch Timeline / Map / Influence Tree.
4. Toggle project checkboxes; confirm filtering.
5. Kill-switch off → promote another concept → no new metadata fields.

## Automated

```bash
node cursor-tests/20260716_vault-project-membership.mjs
node cursor-tests/20260716_influenced-edge-type.mjs
node cursor-tests/20260716_vault-metadata-extraction.mjs
node cursor-tests/20260716_geocode-cache-contract.mjs
node cursor-tests/20260716_vault-graph-views.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

## QA checklist

- [x] Promotion path not blocked by extraction
- [x] Idempotent re-promotion (no duplicate LLM when `metadataExtractedAt` set)
- [x] Geocode cache hit avoids second Nominatim call (Edge Function contract)
- [x] Timeline excludes undated; Map excludes non-resolved
- [x] Influence Tree uses only INFLUENCED edges (`influences[]`)
- [x] Project filter resets on reopen
- [x] SW_VERSION / index.html ?v= / CACHE_NAME bumped together (`20260716_03` / `pith-v146`)

## Temporary subagents

Cleanup: 2026-07-16 — none created (wave tasks executed in parent).

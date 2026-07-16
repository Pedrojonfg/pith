# Quickstart: Pack Import Flow

## Preconditions

- Pack export backend migration applied (`shared_packs` + RPC).
- Owner display-name migration applied (this feature).
- Authenticated user; active project selected.

## Manual path

1. Open a document → Create pack → edit graph if needed → Publish (with or without source).
2. Confirm share code is shown; Copy works.
3. Library → New session → Use pack code → paste code → see title + creator → Confirm.
4. Open imported session; RSVP/Questions/Recall (and Cloze if source included) work without regenerating inventory.
5. Import same code again → second distinct library row.
6. File-upload create path still works unchanged.

## Automated

```bash
node cursor-tests/20260716_pack-import-flow.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

## QA checklist

- [x] Code assigned and unique on publish
- [x] Invalid code → error, no session
- [x] Valid import → new session, no LLM regen of resolved content
- [x] Double import → two sessions
- [x] No creator Vault references on imported session
- [x] Vault link runs for importer (inventory gains importer `globalConceptId` when registry available)
- [x] Upload path unchanged
- [x] SW_VERSION / index `?v=` / CACHE_NAME bumped together

**Automated:** `cursor-tests/20260716_pack-import-flow.mjs` — 63 passed (2026-07-16).  
**Note:** Apply `supabase/migrations/20260716_shared_packs_owner_display_name.sql` before using owner display names in preview.

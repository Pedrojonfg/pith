# Quickstart: Pack Export Backend

## Prerequisites

- Authenticated Supabase user (LLM proxy + RLS)
- Migration `supabase/migrations/20260716_shared_packs.sql` applied
- DocumentSession with shared artifacts (inventory and/or recall optional)

## Manual smoke

1. Apply migration to linked project.
2. From app console or test harness:
   - `createPackDraft(docId, userId)` → row `status=draft`
   - Mutate returned snapshot locally; reload session → unchanged
   - `finalizePack(id, true)` → published; snapshot equals draft
   - New draft → `finalizePack(id, false)` → no rawMarkdown/cloze/images; inventory anchors gone; recall chunks rewritten
3. Force rewrite failure (mock LLM) → row stays draft

## Automated

```bash
node cursor-tests/20260716_pack-export-backend.mjs
```

## Dependent features

- Graph editor: load/update draft `snapshot.conceptInventory` / `conceptGraph`
- Import flow: assign `code`, call `lookup_shared_pack_by_code`

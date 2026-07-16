# Data Model: Pack Concept Graph Editor

## Entity: Pack draft (existing `shared_packs`)

No new tables. Editor reads/writes:

| Field | Role |
|-------|------|
| `id` | Pack draft id |
| `status` | Must be `draft` for edits |
| `snapshot` | Mutated in place for inventory + graph only |
| `owner_user_id` | Auth gate (RLS) |

## Entity: Working editor state (client)

| Field | Type | Notes |
|-------|------|-------|
| `packId` | string (uuid) | Current draft |
| `sourceDocId` | string | Traceability only; never written for edits |
| `snapshot` | PackSnapshot | In-memory working copy |
| `includeSourceDocument` | boolean | Toggle before publish |
| `dirty` | boolean | Unsaved local mutations |
| `saveError` | string \| null | Last persist failure message |

### State transitions

```
library Create pack → createPackDraft → editor (view)
editor mutations → dirty snapshot → debounced updatePackDraftSnapshot → clean
editor Publish → flush save → finalizePack → leave editor (published)
publish fail → stay in editor, dirty/clean as after last successful save
```

## Entity: Concept inventory entry (subset)

| Field | Edit behavior |
|-------|----------------|
| `id` / `canonicalId` / `concept_id` | Set on create; immutable thereafter |
| `title` / `label` | Renamed together when present |
| Other fields | Untouched |

## Entity: Concept graph (snapshot)

Preferred epistemic shape (compatible with existing packs):

```text
nodes[]: { id, text, type?: "CONCEPT" }
edges[]: { source_id, target_id, type }
```

Also accept/normalize `from`/`to` on read when present.

### Validation rules

- Rename: non-empty trimmed title
- Add node: non-empty name; unique concept id within inventory
- Delete node: remove inventory row + node + all incident edges
- Add edge: distinct endpoints; type in allowed picker set; no duplicate identical (from,to,type) required (optional dedupe)
- Delete edge: exact edge identity
- Persist: only when `status === 'draft'`

## Isolation invariant

`DocumentSession` for `source_doc_id` MUST deep-equal a pre-edit baseline after any editor operation (tests clone session before/after).

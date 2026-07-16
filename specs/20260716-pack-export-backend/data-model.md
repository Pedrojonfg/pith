# Data Model: Pack Export Backend

## Entity: SharedPack (`public.shared_packs`)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | uuid | PK, default `gen_random_uuid()` | |
| code | text | UNIQUE, nullable | NULL while draft; set by import feature |
| owner_user_id | uuid | NOT NULL, FK → auth.users ON DELETE CASCADE | |
| source_doc_id | text | NOT NULL | DocumentSession docId (traceability only) |
| title | text | NOT NULL default `''` | From `docMeta.titleInferred` at draft create |
| status | text | NOT NULL, check in (`draft`,`published`) | |
| include_source_document | boolean | nullable | NULL while draft |
| snapshot | jsonb | NOT NULL | See PackSnapshot |
| created_at | timestamptz | NOT NULL default `now()` | |
| published_at | timestamptz | nullable | Set on finalize |

### State transitions

```
(createPackDraft) → draft
draft + finalizePack(success) → published  (immutable thereafter for this feature)
draft + finalizePack(failure) → draft      (unchanged)
```

Published rows are not updated by this feature except via import assigning `code` (out of scope here; column exists).

## Entity: PackSnapshot (jsonb)

Cloned at draft creation from DocumentSession `shared` (+ slow):

| Key | Source | Removed when `includeSourceDocument=false` |
|-----|--------|-----------------------------------------------|
| docMeta | shared.docMeta | no |
| docHierarchy | shared.docHierarchy | no |
| conceptInventory | shared.conceptInventory | fields `source_phrase`, `anchorRange` stripped per item |
| conceptGraph | shared.conceptGraph `{nodes,edges}` | no |
| modeRecommendation | shared.modeRecommendation | no |
| modes.rsvp | shared.modes.rsvp / sessionsByMode | no |
| modes.questions | shared.modes.questions | no |
| modes.cloze | shared.modes.cloze | **yes (entire key)** |
| modes.recall | shared.modes.recall | `questions[].source_chunks` rewritten |
| images | shared.images | **yes** |
| rawMarkdown | session markdown / shared raw | **yes** |
| slowSlice | modes.slow | **yes** |

## Validation rules

- Draft insert requires authenticated `owner_user_id` matching caller.
- Finalize requires `status='draft'` and ownership.
- Rewrite: non-empty string output; Jaccard &lt; 0.3 vs input.
- Fail-closed: any rewrite/quality failure aborts publish.

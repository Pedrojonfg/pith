# Data Model: Pack Import Flow

## shared_packs (delta)

| Column | Type | Notes |
|--------|------|-------|
| `code` | text UNIQUE NULL | Assigned on publish; 8-char alphabet per research |
| `owner_display_name` | text NULL | Set on draft create; frozen when published |

Existing columns unchanged. Published immutability: only `code` may change after publish (already); `owner_display_name` must not change after publish.

## PackAttribution (on DocumentSession.shared.uploadMeta)

| Field | Type | Required |
|-------|------|----------|
| `fileName` | string | yes (use pack title or `"pack"`) |
| `originalFormat` | `"pack"` | yes |
| `uploadedAt` | ISO string | yes |
| `sourcePackId` | string (uuid) | yes |
| `sourcePackOwnerName` | string | yes (fallback allowed) |
| `sourcePackTitle` | string | optional |

## Imported DocumentSession

- `docId`: `pack-{shortPackId}-{base36ts}` (unique, not content-hash)
- `projectId`: importer active project
- `shared`: cloned snapshot fields + attribution `uploadMeta` + `preparation.status = "ready"` (artifacts already resolved) + inventory without creator `globalConceptId`
- `modes`: cloned present slices (`rsvp`/`questions`/`recall`/`cloze`); `modes.slow` from `slowSlice` when present
- No creator vault tables copied

## State transitions

```text
draft pack --finalizePack--> published + code assigned
published --lookup_shared_pack_by_code--> preview
preview confirm --importPackAsSession--> new DocumentSession + runVaultLinkPhase
```

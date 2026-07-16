# Data Model: Vault Temporal, Spatial, and Influence Views

## Vault entry extensions

Additive fields on each Knowledge Vault entry (JSON in existing vault store / sync payload):

| Field | Type | Notes |
|-------|------|-------|
| `temporalRange` | `{ startYear: number, endYear: number, label: string } \| null` | Astronomical years; `endYear >= startYear`; null if N/A |
| `geoLocation` | `{ placeName: string, lat: number \| null, lng: number \| null, geocodeStatus: "pending" \| "resolved" \| "failed" } \| null` | null if no place |
| `metadataExtractedAt` | `number \| null` | epoch ms; set when extraction attempt finished (success or deliberate nulls) |
| `projectIds` | `string[]` (optional) | Denormalized; if absent, resolve via sources |

### Validation

- If `temporalRange` present: both years finite; `endYear >= startYear`; `label` non-empty string.
- If `geoLocation` present: `placeName` non-empty; `geocodeStatus` one of the three; lat/lng finite only when `resolved`.
- Migration: missing fields → `null` / omit; no destructive rewrite.

### Geocode status transitions

```
(absent/null) → pending (placeName set, awaiting geocode)
pending → resolved | failed
```

## Connection type

| Type | Direction | Meaning |
|------|-----------|---------|
| `INFLUENCED` | `sourceId` → `targetId` | source influenced target |

Stored in concept-registry `connections[]` via existing normalize/coerce path. Weight 0–1 as other connections.

## Geocode cache (Supabase)

```sql
create table if not exists geocode_cache (
  place_name_normalized text primary key,
  lat double precision,
  lng double precision,
  resolved_at timestamptz default now(),
  raw_response jsonb
);
```

Normalization: `placeName.trim().toLowerCase()`.

## Graph render mode (UI state, ephemeral)

`graphRenderMode`: `"node" | "timeline" | "map" | "influence_tree"`  
`projectFilterCheckedIds`: `Set<string>` — reset to all projects on open.

## Project membership (derived)

```
membership(entry) =
  entry.projectIds?.length
    ? entry.projectIds
    : unique(session.projectId for each source.docId with a known session)
    : ["misc"]  // if none resolvable
```

Entry included if `membership(entry) ∩ checkedProjects ≠ ∅`.

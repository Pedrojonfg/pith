# Data Model: Shared DPP Cache

**Feature**: `20260704-shared-dpp-cache`

## Supabase: `document_preparation_cache`

| Column | Type | Notes |
|--------|------|-------|
| `cache_key` | TEXT PK | `{docId}:{pipelineVersion}` |
| `doc_id` | TEXT NOT NULL | Content hash (12 hex) |
| `pipeline_version` | TEXT NOT NULL | e.g. `20260704_01` |
| `artifacts` | JSONB NOT NULL | Tier-1 shared artifact bundle |
| `created_at` | TIMESTAMPTZ | First complete write |
| `updated_at` | TIMESTAMPTZ | Last refresh |

## JSONB `artifacts` shape

```typescript
{
  conceptInventory: object[];
  docHierarchy: object | null;
  docTopics: string[];
  textMetrics: object;
  blockRecommendation: object;
  modeRecommendation: object;
  conceptGraph: object | null;
  phaseResults: Record<string, object>;  // tier-1 phases only
  preparation: { status: 'ready'; fingerprint: string; completedAt: number };
}
```

## User session (unchanged row key)

`document_sessions (id=docId, user_id)` — full `DocumentSession` minus cached duplicate fields on read is merged: user fields win for `modes`, `smItems`, `annotations`, `uploadMeta`, `titleInferred`, `projectId`.

## Cache key function

```
buildSharedDppCacheKey(docId, pipelineVersion) => `${docId}:${pipelineVersion}`
```

## State transitions

| Event | Shared cache | User session |
|-------|--------------|--------------|
| Upload new content | MISS → run DPP | create/upsert user row |
| DPP tier-1 complete | UPSERT artifacts | persistFinal user row |
| DPP incomplete/failed | no write | partial/failed user prep only |
| Cache HIT on upload | READ | hydrate shared fields + run T1.6/T1.8/T1.9 |
| Pipeline version bump | old keys ignored | normal DPP run |

## Dev wipe (out of band)

Does not modify `document_preparation_cache`.

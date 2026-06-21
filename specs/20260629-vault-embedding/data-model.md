# Data Model: Vault Embedding Quality Layer

## Supabase Tables

### concept_embeddings

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| user_id | uuid FK auth.users | RLS per user |
| concept_id | text nullable | Registry concept id |
| scope_type | text | `concept` \| `document` |
| project_id | text nullable | Query scoping |
| source_text | text | Audit |
| source_text_hash | text | sha256 hex |
| embedding | vector(768) | cosine HNSW |
| model_version | text | default `gemini-embedding-001` |
| created_at | timestamptz | |

**Unique**: `(user_id, source_text_hash, model_version)`

### dedup_gate_log

| Column | Type |
|--------|------|
| id | uuid PK |
| user_id | uuid |
| concept_id_a | text |
| concept_id_b | text |
| gate_results | jsonb |
| outcome | text | `proposal` \| `rejected` \| `suggestion` |
| evaluated_at | timestamptz |

### merge_rejections

| Column | Type |
|--------|------|
| id | uuid PK |
| user_id | uuid |
| concept_id_a | text |
| concept_id_b | text |
| rejected_at | timestamptz |

**Unique**: `(user_id, concept_id_a, concept_id_b)` with canonical ordering `a < b`

### vault_merge_log

| Column | Type |
|--------|------|
| id | uuid PK |
| user_id | uuid |
| source_concept_id | text |
| target_concept_id | text |
| gate_results | jsonb |
| approved_by | text |
| reasoning | text |
| applied_at | timestamptz |
| reference_relink_count | int |
| reference_relink_detail | jsonb |

### document_similarity

| Column | Type |
|--------|------|
| id | uuid PK |
| user_id | uuid |
| doc_id_a | text |
| doc_id_b | text |
| score | float |
| field_scores | jsonb |
| computed_at | timestamptz |

**Unique**: `(user_id, doc_id_a, doc_id_b)` where `doc_id_a < doc_id_b`

## Session JSON Extensions

### shared.conceptInventory[i]

```typescript
{
  canonicalId: string;
  label: string;
  definition?: string;
  globalConceptId?: string;
  noveltyScore?: number | null;  // 0-1, null = not assessed
}
```

### shared.mergeProposals (ephemeral UI cache)

```typescript
{
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  cosineScore: number;
  confidence: 'high' | 'low' | 'suggestion';
  contradictionLabel?: string;
  gateResults: object;
  status: 'pending' | 'approved' | 'rejected';
}[]
```

### Registry concept soft-delete

```typescript
{
  merged_into?: string;  // target concept id
}
```

## DPP Phases

| Phase | Label | Deps |
|-------|-------|------|
| T1.8 | Scoring concept novelty | T1.2, T1.6 |
| T1.9 | Computing project document similarity | T1.2, T1.8 (soft) |

## RPC Functions

- `find_nearest_concept_embeddings(query_embedding vector(768), match_count int, project_ids text[], exclude_concept_id text)` → rows with cosine similarity
- `relink_embedding_concept_id(source_id text, target_id text)` → update concept_id on embeddings

Cascade merge body runs client-side (`cascade-merge.js`) with snapshot rollback.

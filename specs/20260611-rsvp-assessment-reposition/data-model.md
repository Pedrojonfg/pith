# Data Model: RSVP Assessment Reposition

**Feature**: `20260611-rsvp-assessment-reposition`

## Layer separation (invariant)

| Layer | Storage | Filtered by mastery? |
|-------|---------|---------------------|
| Concept inventory | `splitRunMeta.concept_inventory`, cache, `shared.conceptInventory` | Never |
| Material graph | `session._meta.material_graph` | Never |
| Concept dictionary | Per-block dict built from full inventory | Never |
| Active study flow | `block_index` / `blockIndex` | Yes |
| Learning goals | `BlockMeta.learning_goal` | Yes |

## ConceptInventory

Sin cambios estructurales. Array plano en runtime (`inventory[]`); spec canónico con `concepts` + `edges` cuando se normalice.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | concept_id |
| `label` | `string` | |
| `type` | enum | THESIS, CONCEPT, ARGUMENT, EXAMPLE, TERM |
| `chunk_refs` | `string[]` | optional in runtime |

## KnowledgeProfile

Persistido en `session._meta.knowledge_profile`.

| Field | Type | Validation |
|-------|------|------------|
| `assessed_at` | ISO string | required if present |
| `coverage` | `number` 0–100 | % concept_ids touched by quiz |
| `items` | `KnowledgeProfileItem[]` | min 1 if profile exists |

### KnowledgeProfileItem

| Field | Type | Validation |
|-------|------|------------|
| `concept_id` | `string` | required |
| `mastery` | `'none' \| 'partial' \| 'full'` | required |
| `confidence` | `number` | 0.0–1.0 |
| `edge_mastery` | `{ from, to, mastered }[]` | optional |

## AssessmentItem (transient, pre-eval)

| Field | Type | Notes |
|-------|------|-------|
| `item_id` | `string` | |
| `concept_id` | `string \| null` | null if edge item |
| `edge` | `{ from, to }` | optional |
| `question` | `string` | |
| `type` | `'mcq'` | v1 MCQ only in UI |
| `options` | `string[]` | includes synthetic "I don't know" in UI, not in LLM options |
| `correct` | `string` | for evaluator reference |

## BlockMeta (extensions)

| Field | Type | Notes |
|-------|------|-------|
| `learning_goal` | `string` | e.g. `default`, `relational`, `prerequisite_review` |
| `mastery_adjusted` | `boolean` | optional; true if compressed by profile |

**Removed from design**: `skipped_by_mastery` — dominated blocks absent from index, not marked.

## SessionMeta extensions

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `knowledge_profile` | `KnowledgeProfile \| undefined` | undefined | persisted even if packing ignores profile |
| `assessment_skipped` | `boolean` | `false` | true only on quiz skip (not "Ignorar") |
| `packing_ignored_profile` | `boolean` | `false` | true when user picks full study despite profile |

## PackRunMeta extensions

En `splitRunMeta` / pack return:

| Field | Type | Notes |
|-------|------|-------|
| `requested_n` | `number` | user ceiling N |
| `final_n` | `number` | `blockIndex.length` |
| `profile_applied` | `boolean` | false on skip/ignore/fallback |
| `baseline_n` | `number` | optional; equals `requested_n` for diff UI v1 |

## PrePackingFlowState (ephemeral `study.js`)

| Field | Type | Notes |
|-------|------|-------|
| `phase` | enum | `inventory`, `assessment`, `evaluating`, `results`, `packing`, `confirm` |
| `conceptInventory` | array | from cache or fresh |
| `assessmentItems` | `AssessmentItem[]` | prefetched |
| `responses` | `{ item_id, answer }[]` | |
| `knowledgeProfile` | `KnowledgeProfile \| null` | |
| `packingPromise` | `Promise \| null` | parallel pack |
| `uniformBlockCount` | `number` | for diff display |

## State transitions

```text
[upload / bootstrap]
  → inventory (LLM or cache)
  → graph shown
  → { skip assessment } → pack(max N, no profile) → confirm blocks → ready
  → { quiz }
       → prefetch items (parallel with graph)
       → user answers
       → evaluate → knowledge_profile
       → { parallel } pack(max N, profile) + results UI
       → { accept } → confirm blocks → ready
       → { ignore profile } → pack(max N, no profile), profile kept, packing_ignored_profile=true
```

## Validation rules

- Omit concept from active `blockIndex` only if `mastery === 'full' && confidence > ASSESSMENT_MASTERY_THRESHOLD`
- Prerequisite rule: dominated concept stays if required by non-dominated concept
- `final_n` ≤ `requested_n` always
- `concept_inventory` length unchanged after profile application

## Backward compatibility

- Sessions without `knowledge_profile` load normally
- New `BlockMeta` fields optional; old sessions ignore them
- Legacy `_meta.assessment` (post-packing) ignored when new flow active

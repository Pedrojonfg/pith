# Data Model: Vault Personal Notes, Connections & Resumable Upload

## Vault container (schemaVersion 3)

Unchanged top-level except `schemaVersion: 3`. Still stores `entries`, `reviewItems`, etc.

## KnowledgeVaultEntry v2 fields

| Field | Type | Default (migration) | Notes |
|-------|------|---------------------|-------|
| `type` | `"CONCEPT"\|"CLASS"\|"CONVERSATION"\|"PROJECT"` | `"CONCEPT"` | Only CONCEPT written in v1 flow |
| `area` | `string[]` | `topic ? [topic] : []` | Primary categorization |
| `tags` | `string[]` | `[]` | Free-form |
| `notes` | `string` | `""` | Markdown body |
| `notesUpdatedAt` | `number \| null` | `null` | Set on notes write |
| `related` | `string[]` | `[]` | Entry IDs, symmetric |
| `status` | `"pending" \| "ready"` | `sources.length > 0 ? "ready" : "pending"` | Inbox marker |

Existing fields unchanged including `topic`, `prerequisites`, `dependents`.

## VaultUploadQueue (`pith_vault_upload_queue`)

```typescript
{
  docId: string,
  createdAt: number,
  items: Array<{
    conceptId: string,
    status: "pending" | "processing" | "done" | "error",
    payload: {
      definition: { text: string, sourceChunk?: string, accepted: boolean },
      reviewItems: Array<{ facet, prompt, answer, accepted }>,
      notes: string,
      area: string[],
      tags: string[],
      relatedAccepted: string[]
    },
    error?: string
  }>
}
```

## BatchContext (transient)

```typescript
{
  docId: string,
  concepts: Array<{ id, title, module, prerequisite_ids, concept_type }>,
  existingVaultAreas: string[]
}
```

## VaultSettings (`pith_vault_settings`)

```typescript
{ autoDraftNotes: boolean }  // default true
```

## State transitions

### Queue item

`pending` → `processing` → `done` | `error`  
Stale `processing` at boot → `pending` (retry)

### Entry status

`pending` → `ready` on successful Upload to Vault curation commit (merge or new).

Neighbor backlink-only updates: `status` unchanged.

## Validation rules

- `area` always array (coerce single string → one-element array on write)
- `related` IDs must exist in vault or be batch sibling IDs resolved at commit
- Invalid related IDs skipped silently
- Notes merge on re-curation: append `## Update YYYY-MM-DD` section

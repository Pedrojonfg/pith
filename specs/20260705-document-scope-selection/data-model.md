# Data Model: Document Scope Selection

## Shared fields (schemaVersion 4)

| Field | Type | Notes |
|---|---|---|
| `scopeSelection` | `ScopeSelection \| null` | `null` = full document |
| `scopedMarkdown` | `string` | Derived study text; equals raw when full doc |
| `scopeContext` | `string \| null` | LLM blurb when partial scope |
| `scopeResolvedAt` | `number \| null` | Epoch ms when user confirmed scope gate |

```ts
interface ScopeSelection {
  sectionIds: string[];
  contiguous: boolean;
  selectedAt: number;
  charCount: number;
}
```

## Migration (v3 → v4)

On load when `scopeSelection` absent:
- `scopeSelection = null`
- `scopedMarkdown` = resolved `rawMarkdown`
- `scopeContext = null`
- If `conceptInventory.length > 0`: set `scopeResolvedAt = updatedAt` (legacy bypass)

## Invariants

- T1.1 always uses `rawMarkdown`.
- T1.2+ always uses `scopedMarkdown`.
- `scopeResolvedAt` must be set before T1.2 runs for new sessions.

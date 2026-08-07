# Data Model: Hierarchical Scope Selection UX

No schemaVersion bump. Extends behavior around existing entities.

## ScopeSelection (unchanged shape)

| Field | Type | Notes |
|-------|------|-------|
| `sectionIds` | `string[]` | Canonical ids after normalize (parent-only when fully selected) |
| `contiguous` | `boolean` | Computed on ordered selectable ids |
| `selectedAt` | `number` | ms epoch |
| `charCount` | `number` | Length of deduped scoped markdown |

`null` = entire document (unchanged).

## SelectableHierarchyNode (UI/helper)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | `hierarchyNodeId(node)` |
| `node` | `HierarchyNode` | title, level, offsets; children may be empty on leaf |
| `children` | `SelectableHierarchyNode[]` | selectable descendants only (`level <= maxLevel`) |

## Picker UI state (ephemeral)

| Field | Type | Notes |
|-------|------|-------|
| `scopePickerSelectedIds` | `Set<string>` | Working selection (may include redundant child ids until normalize) |
| `scopePickerFullDocument` | `boolean` | Entire-document mode |
| `scopePickerExpandedIds` | `Set<string>` | Expanded parent ids; reset on render |

## Derived parent checkbox state

Given parent `P` with selectable descendants `D`:

| Condition | `checked` | `indeterminate` |
|-----------|-----------|-----------------|
| Full document mode | true | false |
| `P` in selected (or all of `D` selected after promote rules) | true | false |
| Some but not all of `D` selected and `P` not selected | false | true |
| None of `P`/`D` selected | false | false |

## Validation rules

- Confirm partial scope: normalized `sectionIds.length >= 1` and deduped markdown length `> 0`.
- Ids not found in tree are dropped when building markdown.
- Expand state is not validated or persisted.

## State transitions

```
fullDocument ──uncheck any──► partial(Set seeded with all ids − unchecked)
partial ──check parent──► add parent + all descendants
partial ──uncheck parent──► remove parent + all descendants
partial ──all ordered ids selected──► fullDocument
partial ──confirm──► persist normalize(ids) | buildScopedMarkdown
fullDocument ──confirm──► scopeSelection = null
```

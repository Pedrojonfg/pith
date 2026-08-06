# Data Model: Scope-Gated Generation

**Feature**: `specs/20260806-scope-gated-generation`  
**Date**: 2026-08-06

## Entities

### DocumentSession.shared (changes)

| Field | Type | Notes |
|-------|------|-------|
| `rawMarkdown` | string | Full document; unchanged |
| `scopedMarkdown` | `string \| null \| undefined` | **Unset/null until scope resolved**; never seeded at create |
| `scopeSelection` | `ScopeSelection \| null` | `null` = entire document after resolve; non-null = section pick |
| `scopeResolvedAt` | `number \| null` | Set only on real user confirm; migration must not invent from inventory |
| `scopeContext` | string \| null | Unchanged (partial-scope LLM blurb) |
| `docHierarchy` | DocHierarchy \| null | Full-document tree from T1.1 |
| `scopedHierarchy` | DocHierarchy \| null | **New (optional persist)**: mini-tree after resolve; may be recomputed ephemerally if cheaper |

### ScopeSelection (unchanged shape)

```text
{ sectionIds: string[], contiguous: boolean, selectedAt: number, charCount: number }
```

Prefer storing `sectionIds` in document order after confirm (aligned with `buildScopedMarkdown`).

### DocHierarchy / mini-tree

Same shape as full hierarchy: `{ tree: HierarchyNode[], pedagogical_meta?: object, ... }`.

Each mini-tree node:
- `startOffset` / `endOffset` relative to `scopedMarkdown`
- Titles/levels preserved from chosen full-tree nodes
- Children: subset structure or flattened siblings (see research R7)

### Slow slice (removals)

| Field | Change |
|-------|--------|
| `readingScope` | **Removed** from create/init and all read/write sites |
| `fillableMap` / `checkpoints` / `criticalMode` | Set once via `decideSlowReadingModifiers` at Slow session creation |

### Scope identity (T2.3)

`scopeKey`: `"full_document"` when `scopeSelection == null` after resolve; else stable join of ordered `sectionIds` (e.g. `sectionIds.join("|")`).

## State transitions

```text
[created] scopeResolvedAt=null, scopedMarkdown unset
    → structure ready (T0.1–T1.1)
[awaiting scope] picker shown; gated phases excluded
    → user confirms (partial | entire)
[resolved] scopeResolvedAt=now, scopedMarkdown set, mini-tree available
    → T1.2+ / T2.* may run
[immutable] no further scope transitions for this session
```

## Validation rules

1. Gated phases must not run unless `isScopeGateResolved(session)`.
2. `resolveScopedMarkdown` returns study text only when resolved.
3. Guide chat may still read `rawMarkdown` via `resolveChatScopeFields`.
4. Legacy sessions without `scopeResolvedAt` stay unresolved (re-prompt).

## Migration

- Remove inventory→`scopeResolvedAt` inference.
- Do not seed missing `scopedMarkdown` from `rawMarkdown`.
- Leave `schemaVersion` at 4 unless a new persisted field requires bump; if `scopedHierarchy` persisted, keep additive under v4 or bump only if validators require it (prefer ephemeral recompute to avoid bump).

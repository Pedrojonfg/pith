# Contract: Scope gate & resolveScopedMarkdown

## `isScopeGateResolved(session) → boolean`

True iff `shared.scopeResolvedAt` is a finite number > 0.

## `resolveScopedMarkdown(session) → string`

1. If `!isScopeGateResolved(session)` → return `""`.
2. Else if `typeof scopedMarkdown === "string"` → return it (may equal `rawMarkdown` for entire-document).
3. Else → return `""` (do not silently fall back to `rawMarkdown` for study consumers).

## Chat exception

`resolveChatScopeFields(session)` continues to expose `backgroundMarkdown = rawMarkdown` when partial scope; must not be narrowed by study-text resolution changes.

## Confirm handlers

| Choice | Writes |
|--------|--------|
| Entire document | `scopeSelection=null`, `scopedMarkdown=rawMarkdown`, `scopeResolvedAt=Date.now()` |
| Sections | `scopeSelection=buildScopeSelection(...)`, `scopedMarkdown` from `buildScopedMarkdown`, `scopeResolvedAt=Date.now()`, mini-tree available |

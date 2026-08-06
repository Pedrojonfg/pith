# Contract: Slow scope removal & navigation

## Removed

- `#screenSlowScope` and child controls
- `ui.js` `slowScope` screen registry
- `session.modes.slow.readingScope` and all read/write sites
- User toggles for fillable map / checkpoints / critical mode (scope screen + Phase 0 duplicates + create-form critical toggle)

## Replaced by

| Old | New |
|-----|-----|
| Slow scope screen | Universal `screenScopeSelection` |
| `getScopeText` / readingScope slice | `scopedMarkdown` / `normalizedTextFull` |
| Section boundaries from readingScope | Mini-tree offsets |
| Manual modifiers | `decideSlowReadingModifiers(textMetrics, pedagogicalMeta)` |
| Export `scope.label (start–end)` | Joined chosen section titles |

## Navigation index

In-reader (sidebar/reader chrome): list mini-tree section titles; click → jump/paginate to section `startOffset` within scoped text. Not a scope picker.

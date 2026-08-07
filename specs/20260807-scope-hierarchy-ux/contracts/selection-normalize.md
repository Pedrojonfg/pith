# Contract: Scope section id normalize + deduped markdown

**Module**: `src/js/scope-selection.js`

## `normalizeScopeSectionIds(sectionIds, tree)`

`tree` = result of `listSelectableHierarchyTree` (or equivalent parent map).

### Algorithm

1. Resolve each id to a selectable node; drop unknown ids.
2. **Drop covered children**: if an ancestor id is in the set, remove all descendant ids.
3. **Promote full child sets**: if a parent is not in the set but every selectable direct-or-nested descendant under that parent is selected, add the parent id and remove those descendants.
4. Return ids sorted by `startOffset` ascending.

### Invariants

- Idempotent: `normalize(normalize(ids)) === normalize(ids)` (same membership + order).
- Empty input → `[]`.

## `buildScopedMarkdown(raw, docHierarchy, sectionIds)`

1. Run `normalizeScopeSectionIds` on `sectionIds` against the selectable tree.
2. Map ids → ranges `[startOffset, endOffset)`.
3. **Dedupe ranges**: sort by start; skip range fully contained in a kept prior range; otherwise keep (union merge if partial overlap).
4. Slice + trim + join with `SCOPE_SECTION_DELIMITER`.
5. `contiguous` uses normalized ids against ordered flat ids from `listSelectableHierarchyNodes`.

## `buildScopeSelection`

MUST pass the same normalized ids into persisted `sectionIds` and derive `charCount` from deduped markdown.

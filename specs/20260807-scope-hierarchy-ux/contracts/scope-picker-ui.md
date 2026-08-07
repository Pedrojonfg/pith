# Contract: Scope picker UI (`screenScopeSelection`)

**Modules**: `study.js` (`renderScopeSelectionScreen`, `wireScopeSelectionHandlers`), CSS

## Render

1. Build tree via `listSelectableHierarchyTree`.
2. For each visible node (roots always; children iff parent id ∈ `scopePickerExpandedIds`):
   - Row: optional expand button (parents with `children.length > 0` only) + checkbox + `"${title} (${formatCharCount})`.
   - Indent by `node.level` (CSS).
3. Expand control toggles membership in `scopePickerExpandedIds` and re-renders or shows/hides child `<li>`s without clearing selection.
4. Default: `scopePickerExpandedIds` empty on screen entry.

## Checkbox change

1. Full-doc leave seed: unchanged (seed all ordered ids, then apply toggle).
2. **Check parent**: add parent id + all descendant ids to Set.
3. **Uncheck parent**: remove parent id + all descendant ids.
4. **Check/uncheck leaf**: add/remove that id only; then refresh ancestor mixed/checked display.
5. Call `maybePromoteScopePickerToFullDocument(orderedIds)`.
6. `updateScopeSelectionUi` uses `buildScopedMarkdown` (normalized/deduped) for char count.

## Mixed state

For each parent with children, set `indeterminate` / `aria-checked="mixed"` per data-model table. In full-document mode all checkboxes appear checked and not indeterminate.

## Confirm

- Full document → `applyScopeSelectionToDoc({ fullDocument: true })`.
- Else → `normalizeScopeSectionIds([...scopePickerSelectedIds], tree)` then `applyScopeSelectionToDoc({ sectionIds })`.

## A11y

- Expand button: `aria-expanded`, accessible name e.g. “Expand section” / “Collapse section”.
- List may keep `role="listbox"` or move to grouped list; do not break keyboard checkbox activation.

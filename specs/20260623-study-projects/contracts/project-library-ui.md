# Contract: Project Library UI

**Screens**: `screenDocLibrary` (extended), breadcrumbs on library / mode select / review

## Library browser (`screenDocLibrary`)

### Root level

- List projects where `parentId === null` (includes Misc)
- Actions: `New Project`
- Tap project → drill down

### Project level

- Breadcrumb: `Library › [Ancestor…] › [Current]`
- Subprojects list (direct children)
- Documents assigned to **this** project only (not descendants unless browsing into them)
- Actions: `New Subproject`, per-document `Move to project…`

### Document tap

→ Existing flow to `screenModeSelect` with breadcrumb `[Project path] › [Document name]`

## Breadcrumb component (`ui.js`)

```javascript
renderBreadcrumb(segments: { label: string, onClick?: () => void }[]): HTMLElement
```

- Generic depth — no hard limit
- Clickable segments with `onClick` navigate back
- Mount points:
  - Library / project browser
  - Mode select (when from library)
  - Active study modes (project path + document + mode)
  - Review config: `Review › [scope]`

## Upload (`screenPlaceholder`)

- Control: Project selector (flat tree with indentation)
- Prefill rules:
  - From library inside project P → default P
  - From general hub → default `misc`
- Never blocks upload; always valid default

## Mode select hub (general entry)

When **not** opened for a specific document from library:

| Action | Target |
|--------|--------|
| Continue | Active document continuity (existing) |
| Library | `screenDocLibrary` root |
| Review | `screenReviewConfig` with scope picker |

When opened **from library** with document selected → existing 5-mode hub + breadcrumb.

## UI strings (English)

| Context | String |
|---------|--------|
| Library entry | `Library` |
| New root | `New Project` |
| New child | `New Subproject` |
| Default project | `Misc` |
| Reassign | `Move to project…` |
| Review scope all | `All subjects` |
| Review scope project | `This subject` |
| Include subprojects | `Include subprojects` |

## CSS

- Project color swatch optional on list rows
- Indented flat selector for pickers (no drag-drop v1)

## Non-goals v1

- Drag-and-drop reorder
- Auto-suggest project from docTopics
- Multi-select bulk move

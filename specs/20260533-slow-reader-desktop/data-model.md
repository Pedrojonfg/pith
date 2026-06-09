# Data Model: Slow Mode Reader Desktop UX

**Feature**: `20260533-slow-reader-desktop`

## Session fields (existing — extended semantics)

### `session.slow.typography`

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `fontSizePx` | number | 18 | Range 14–28 (unchanged) |
| `lineHeight` | number | 1.6 | Range 1.3–2.2; UI exposes ± controls |
| `fontFamily` | string | `"DM Sans", sans-serif` | Unchanged |

**Validation**: On save, clamp values to ranges; invalidate pagination cache on change.

### `session.slow.sidebarOpen`

| Type | Default (new logic) | Persistence |
|------|-------------------|-------------|
| boolean \| undefined | `undefined` → derive from viewport | Stored on toggle |

**Default resolution** (`resolveSidebarOpen`):

```text
if sidebarOpen !== undefined → Boolean(sidebarOpen)
if viewport >= 1024px → false
else → true  (mobile: panel visible or tab per layout CSS)
```

### `session.slow` (unchanged contracts)

- `annotations[]` — `charStart`, `charEnd` in **scope plain text** coordinates
- `currentPageIndex`, `maxReadCharEnd`, `readingScope` — unchanged
- `normalizedTextFull`, `normalizedFormat` — source for render + offsets

## DOM / UI state (not persisted)

| State | Storage | Set by |
|-------|---------|--------|
| `body.slow-reader-active` | classList | `showScreen('slowReader')` |
| `.slow-reader-layout.focus-mode` | classList | `initSlowReader` + Focus btn |
| `.slow-reader-layout.sidebar-open` | classList | `applySidebarOpenState` |
| Page indicator text | `#slowReaderPageIndicator` | `renderProgress` |

## Render pipeline

```text
scopeText (plain markdown source)
  → computePageBreakpoints(scopeText, container, typography)
  → slice = scopeText[charStart:charEnd]
  → displayHtml = markdownToHtml(slice)  [if markdown]
  → pageEl.innerHTML = displayHtml + md-content class
  → selection map: DOM Range → offset in scopeText (plain)
```

## State transitions

```text
[any slow phase screen]
  → showScreen('slowReader')
      → body.slow-reader-active = true
      → initSlowReader → focus-mode on (unless user disabled this session)
      → resolveSidebarOpen (viewport default)

[slowReader]
  → toggle sidebar → slow.sidebarOpen persist
  → toggle focus → aria-pressed (session-optional v1: DOM only)
  → leave reader → body.slow-reader-active = false
```

## No migration required

No new required JSON fields. Optional: persist `slow.focusModeDisabled` only if needed to remember user opt-out across reloads (v1: DOM-only focus on entry is acceptable per quickstart).

# Contract: Slow Reader Desktop Layout

**Feature**: `20260533-slow-reader-desktop` | **FR**: FR-001, FR-002, FR-003, FR-004, FR-012

## DOM structure

```text
body.slow-reader-active
main (padding: 0, full width)
  #screenSlowReader.slow-screen
    .slow-reader-layout[.sidebar-open][.focus-mode]
      .slow-reader-main
        .slow-reader-toolbar
        .slow-reader-content
          .slow-reader-page-wrap
            #slowReaderPage.slow-reader-page.md-content
            #slowReaderMargin.slow-reader-margin
      #slowReaderSidebar.slow-reader-sidebar
      #slowSidebarTab.slow-sidebar-tab
```

**Note**: `#screenSlowReader` MUST be direct child of `main` or equivalent full-bleed wrapper — NOT inside `.container` with `max-width: 840px`.

## CSS breakpoints

| Breakpoint | Layout |
|------------|--------|
| &lt; 768px | Single column; sidebar drawer; tab ☰; móvil actual preservado |
| 768–1023px | Transición; sidebar overlay opcional |
| ≥ 1024px | Grid 3-col: texto + margen (32px) + sidebar (300–360px) |

## Grid (desktop)

```css
.slow-reader-layout.sidebar-open {
  grid-template-columns: minmax(0, 1fr) 32px minmax(300px, 360px);
}
.slow-reader-layout:not(.sidebar-open) {
  grid-template-columns: minmax(0, 1fr) 32px;
}
```

## Chrome visibility (`body.slow-reader-active`)

| Element | Visible |
|---------|---------|
| `.corner-plus`, `#changeKeyLink` | hidden |
| `.sidebar-toggle`, `#guide-sidebar` | hidden |
| `#studyProgress` | hidden (ya por showScreen) |
| `.slow-reader-toolbar` | visible (focus-mode reduces) |

## Sidebar default

```js
// resolveSidebarOpen(session)
if (session.slow.sidebarOpen !== undefined) return Boolean(session.slow.sidebarOpen);
return !window.matchMedia('(min-width: 1024px)').matches;
```

## Margin column

- `#slowReaderMargin` in grid column 2 (not `position: absolute; right: -36px`)
- Marks: `position: absolute` within margin column only

## Prohibited

- Sidebar width as `20vw` of viewport inside a capped container
- Reader content inside `.card` wrapper

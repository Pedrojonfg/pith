# Contract: Slow Reader Responsive Overlays & Sidebar

**Feature**: `20260533-slow-reader-desktop` | **FR**: FR-011 + User Story 5

## IA overlay

| Viewport | Presentation | Dismiss |
|----------|--------------|---------|
| ≥ 1024px | Centered modal, `max-width: 560px`, `max-height: 70vh` | Click backdrop, ×, Escape |
| &lt; 1024px | Bottom sheet (current) | Swipe down, ×, Escape |

CSS:

```css
@media (min-width: 1024px) {
  .slow-ia-overlay { align-items: center; padding: 24px; }
  .slow-ia-overlay-panel { border-radius: 14px; max-height: 70vh; }
}
```

## Sidebar IA input

- Replace `#slowSidebarIAInput` type=text with `<textarea rows="3">` on desktop (`@media min-width 1024px`) or always textarea with min-height.
- Enter → submit (preventDefault); optional Shift+Enter → newline (document in quickstart).

## Sidebar typography (desktop)

```css
@media (min-width: 1024px) {
  .slow-sidebar-ann-item { font-size: 0.9rem; }
  .slow-sidebar-section-title { font-size: 0.8rem; }
  .slow-sidebar-dict-term { font-size: 0.92rem; }
}
```

## Steel-man nudge & checkpoint chip

- Desktop: keep centered modal (already OK).
- Checkpoint chip: on desktop, anchor bottom-right of text column instead of viewport center (optional P3 — document in quickstart if deferred).

# Contract: Slow Reader Toolbar & Keyboard

**Feature**: `20260533-slow-reader-desktop` | **FR**: FR-007, FR-008, FR-009, FR-010

## Toolbar elements

| ID | Role |
|----|------|
| `#slowReaderPrevBtn` | Previous page |
| `#slowReaderNextBtn` | Next page |
| `#slowReaderPageIndicator` | Text: `3 / 42` (1-based current, total pages) |
| `#slowReaderProgress` | Visual bar (unchanged) |
| `#slowFontSmallerBtn` / `#slowFontLargerBtn` | fontSizePx ±2 |
| `#slowLineSmallerBtn` / `#slowLineLargerBtn` | lineHeight ±0.1 |
| `#slowFocusModeBtn` | Toggle focus-mode |
| `#slowReaderCompleteBtn` | Phase 3 transition |

## Page indicator

Updated in `renderProgress(session)`:

```js
const total = getPageCount(breakpoints);
const idx = session.slow.currentPageIndex;
indicator.textContent = total ? `${idx + 1} / ${total}` : '—';
```

## Keyboard (`onSlowReaderKeydown`)

When `screenSlowReader` active AND no blocking overlay/menu AND activeElement not INPUT/TEXTAREA:

| Key | Action |
|-----|--------|
| `ArrowLeft` | `goToReaderPage(session, idx - 1)` |
| `ArrowRight` | `goToReaderPage(session, idx + 1)` |
| `Escape` | existing menu/overlay dismiss (unchanged) |
| `1-9` | annotation hotkeys when selection pending (unchanged) |

Prevent default on ArrowLeft/Right when handled.

## Focus mode auto

On `initSlowReader(session)`:

```js
if (!session.slow.focusModeOptOut) {
  layout.classList.add('focus-mode');
  focusBtn.setAttribute('aria-pressed', 'true');
}
```

Optional persist `slow.focusModeOptOut` when user disables focus.

## Typography persistence

```js
session.slow.typography.lineHeight = clamp(1.3, 2.2, value);
invalidatePaginationCache();
renderSlowReaderPage(session);
storeActiveSession(session);
```

## Prohibited

- Removing swipe navigation on touch devices
- Blocking keyboard when IA overlay open (Escape only, unchanged)

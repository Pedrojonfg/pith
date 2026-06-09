# Contract: Slow Reader Markdown Render & Offsets

**Feature**: `20260533-slow-reader-desktop` | **FR**: FR-005, FR-006

**Extends**: `specs/20260528-slow-mode/contracts/annotation-char-offsets.md`

## Render

```js
const slice = scopeText.slice(bp.charStart, bp.charEnd);
if (session.slow.normalizedFormat === 'markdown') {
  pageEl.classList.add('md-content');
  pageEl.innerHTML = markdownToHtml(slice); // from markdown.js
} else {
  pageEl.classList.remove('md-content');
  pageEl.textContent = slice;
}
```

## Offset coordinate system

- **Unchanged**: `charStart` / `charEnd` index into `scopeText` (plain markdown source, same as pagination input).
- Pagination `computePageBreakpoints` continues to use plain `scopeText` and container metrics.

## Selection → offset

Replace or extend `selectionToScopeOffsets(session)`:

```js
// Input: Range within #slowReaderPage (may span HTML nodes)
// Output: { charStart, charEnd, selectedText, rect } in scope coordinates
```

**Algorithm (required behavior)**:

1. Clone range; extract `selectedText` as visible text (textContent of range).
2. Map start/end to plain offsets by walking text nodes in document order and correlating with `slice` plain string OR maintain `data-plain-offset` on text nodes at render time.
3. Add `slice.charStart` to local offsets.

**Acceptance**: Selecting "foo bar" in rendered bold must produce same offsets as selecting same substring in plain `scopeText`.

## Highlight / margin marks

- `highlightRange`: may inject `<span class="slow-highlight-pulse">` in DOM; restore plain render on timeout.
- `measureMarkY`: must work with HTML content (Range from char offset in plain → DOM position).

## Legacy

- `html_min`: if not migrated, `textContent` path remains valid.
- Post `migrate-html-min`: treat as markdown.

## Prohibited

- Storing offsets in HTML node paths or CSS selectors
- Breaking existing `session.slow.annotations[]` on load

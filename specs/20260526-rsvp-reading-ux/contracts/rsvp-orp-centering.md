# Contract: RSVP ORP Centering

**Module**: `src/js/rsvp.js` + `src/css/main.css`

## `renderRsvpTextChunk(content) → HTMLElement`

Returns `#rsvp-word-display` with structure:

```html
<span id="rsvp-word-display" class="rsvp-word-display">
  <!-- per word -->
  <span class="rsvp-word">
    <span class="rsvp-before">…</span>
    <span class="rsvp-orp">X</span>  <!-- only on anchor word -->
    <span class="rsvp-after">…</span>
  </span>
  …
</span>
```

**Rules**:
1. Tokenize with existing `tokenizeWords` / split on whitespace preserving spacing attached to prior word.
2. `anchorWordIndex = Math.floor((words.length - 1) / 2)`.
3. Only word at `anchorWordIndex` uses `getORP(word)` split into before/orp/after.
4. Non-anchor words: single `<span class="rsvp-word">` with full text, no red.

**Backward compatibility**: `wordsPerFlash === 1` → one word, anchor index 0 (same as single-word mode).

## `centerOrpInContainer(displayEl, containerEl) → void`

**Preconditions**: `displayEl` connected; `.rsvp-orp` exists (text chunks only).

**Behavior**:
1. Reset `displayEl.style.transform = ''`.
2. Let layout flush (sync `getBoundingClientRect` after append).
3. `orpRect = orp.getBoundingClientRect()`, `containerRect = containerEl.getBoundingClientRect()`.
4. `delta = (containerRect.left + containerRect.width/2) - (orpRect.left + orpRect.width/2)`.
5. `displayEl.style.transform = \`translateX(${delta}px)\``.

**Postconditions**: Horizontal center of ORP glyph within ±4px of container center.

**Math chunks**: No-op (no `.rsvp-orp`).

## CSS requirements

```css
.rsvp-word-display {
  transform: translateX(0); /* reset baseline */
  will-change: transform;   /* optional, perf */
}
.rsvp-word { display: inline; white-space: pre; }
```

**Must NOT**: Change global `--fg` or overlay z-index.

## `getORP(word)` (unchanged signature)

| Letter count (a-zA-Z only) | ORP index |
|----------------------------|-----------|
| ≤1 | 0 |
| 2–5 | 1 |
| 6–9 | 2 |
| 10–13 | 3 |
| ≥14 | 4 |

Documented limitation: Spanish accented letters not counted in length (v1).

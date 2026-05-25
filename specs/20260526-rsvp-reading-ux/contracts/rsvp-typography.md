# Contract: RSVP Session Typography

**Module**: `src/js/rsvp.js`  
**Consumers**: RSVP overlay only (`study.js` imports public API unchanged)

## `computeRsvpTypographyProfile(containerEl, wordsPerFlash) → RsvpTypographyProfile`

**Preconditions**:
- `containerEl` connected, `clientWidth` and `clientHeight` > 0
- `wordsPerFlash` integer 1–10

**Behavior**:
1. Build probe string: repeat `PROBE_WORD` (config constant, default `"internacionalización "`) `wordsPerFlash` times.
2. Run existing binary-search fit logic **once** against probe in a hidden or reused `#rsvp-word-display` test node.
3. Return `{ fontSizePx, mathScale: 0.85, containerWidth, containerHeight, wordsPerFlash, computedAt }`.

**Postconditions**:
- `fontSizePx` is the maximum size where probe fits within 75% width × 60% height thresholds (same as today).

**Must NOT**: Accept per-chunk `content` to vary font size.

## `applySessionFontSize(displayEl, profile, meta)`

| `meta.type` | `displayEl.style.fontSize` |
|-------------|----------------------------|
| `text` | `${profile.fontSizePx}px` |
| `math` | `${Math.round(profile.fontSizePx * profile.mathScale)}px` |

**Must NOT**: Call `calcRSVPFontSize` with chunk word count.

## Deprecations

- `applyRsvpFontSizingForChunk(meta)` → replaced by profile + `applySessionFontSize`
- Per-chunk `calcRSVPFontSize(containerWidth, containerHeight, wordCount)` — `wordCount` parameter ignored/removed

## Events triggering recomputation

| Event | Recompute |
|-------|-----------|
| `startRsvpForText` | Yes |
| `setWordsPerFlash` (mid-session) | Yes |
| `ResizeObserver` on `.rsvp-container` | Yes (debounce 50ms optional) |
| `showChunkByIndex` / each flash | **No** |

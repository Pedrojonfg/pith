# Contract: Recommend Blocks UI

**Files**: `index.html`, `src/css/main.css`, `src/js/ui.js`, `src/js/study.js`

## DOM IDs (normative)

| ID | Element | Visibility |
|----|---------|------------|
| `#recommendBlocksBtn` | `button type="button"` | RSVP create only, inside `#rsvpBlocksSection` |
| `#recommendBlocksStatus` | `span` or `div.hint` | Progress / error for recommend action |
| `#recommendBlocksWhy` | `p.hint` | Reasoning text after success; hidden until recommendation |
| `#blocksInput` | existing | Pre-filled with recommended N |

## Copy (English)

| Element | Text |
|---------|------|
| Button | `Recommend block count` |
| Loading | `Indexing concepts…` |
| Success hint prefix | `Recommended:` |
| Why label | Shown in `#recommendBlocksWhy` (full reasoning sentence) |
| Error generic | `Could not recommend block count. Try again or set blocks manually.` |

## Layout

- Button placed **above** `#blocksInput` label or between label and input
- `#recommendBlocksWhy` directly below input, `aria-live="polite"`
- Do not disable `#blocksInput` after recommend — user override always allowed
- `#recommendBlocksBtn` disabled while recommend in flight; re-enabled after

## Visibility rules

- `hidden` when `studyMode !== 'rsvp'`
- Visible when `#rsvpAdvancedDetails` is open (same as blocks section)
- No button on mode select, blocks list, or study screens

## Interaction

1. Click `#recommendBlocksBtn`
2. Require file selected (same validation as generate); else inline error
3. On success: set `blocksInput.value = nBlocks`; show `#recommendBlocksWhy`
4. On invalidate: clear `#recommendBlocksWhy`; do not reset `blocksInput` to 20 unless stale recommend flag set

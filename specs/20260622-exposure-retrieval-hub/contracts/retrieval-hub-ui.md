# Contract: retrieval-hub-ui

**Modules**: `index.html`, `src/css/main.css`, `src/js/ui.js`  
**FR**: FR-002, FR-005, User Story 5

## screenRetrievalHub

**Section id**: `screenRetrievalHub`

### Required elements

| id | Purpose |
|----|---------|
| `retrievalHubTitle` | H1 — "Practice this document" |
| `retrievalHubLead` | Neutral subtitle — no recommender copy |
| `retrievalHubOptions` | Container for mode cards |
| `retrievalHubBackBtn` | Return to mode select or library |
| `[data-retrieval-mode]` | One button/card per document retrieval mode |

### Per-option card (generated from taxonomy)

- `data-retrieval-mode="questions|cloze|recall"`
- Title from `MODE_TAXONOMY[key].label`
- Hint from taxonomy
- **No** disabled state for Cloze
- **No** "recommended" class or badge

### showScreen integration

`ui.js` `showScreen('retrievalHub')` sets `aria-hidden` on hub; hides other screens.

## CSS

- `.retrieval-hub-screen` — card layout consistent with `mode-select-screen`
- `.retrieval-hub-option` — equal visual weight (same padding, no primary accent on one option)

## Entry points (markup)

- `#btnPracticeDocument` on `screenModeSelect` (new) — opens hub for active doc
- Optional: doc library row action (wired in study.js)

## Removed / relocated

- `#btnReview` removed from `screenModeSelect` (moves to doc library vault row)

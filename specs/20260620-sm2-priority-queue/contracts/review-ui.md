# Contract: review-ui

**Modules**: `index.html`, `study.js`, `review.js`, `src/css/main.css`  
**FR**: FR-007, FR-012, User Stories 3–4

## Mode select (`screenModeSelect`)

### Markup

```html
<button type="button" id="btnReview" class="btn-secondary">
  Review
  <span id="reviewBadge" class="review-badge hidden" aria-label="Items due now"></span>
</button>
```

Placement: inside `mode-select-card`, near doc library row.

### Behavior (`study.js`)

On `showModeSelect` / equivalent:
```javascript
const stats = getQueueStats(normalizedSmItems);
if (stats.dueNow > 0) {
  reviewBadge.textContent = String(stats.dueNow);
  reviewBadge.classList.remove('hidden');
} else {
  reviewBadge.classList.add('hidden');
}
```

`btnReview` click → `runSm2ReviewSession(activeDocId)`.

## Review session (`review.js`)

```javascript
runSm2ReviewSession(docId) → void
```

Flow:
1. `queue = buildReviewQueue(session.shared.smItems)`
2. If empty → empty state message, return
3. For each item: render `title`, `contentPreview`, source badge
4. If `!isOnTime(item)` → show `.review-early-chip` ("Early review")
5. Quality buttons: Perfect (5), Good (4), Hard (3), Forgot (1)
6. `updated = updateSmItem(item, quality)` → `upsertSmItem`
7. If `sourceType === 'vault_concept'` → `applyVaultReviewObservation`
8. Next item or summary screen

### Quality button mapping

| Label | quality |
|-------|---------|
| I knew it perfectly | 5 |
| I knew it | 4 |
| With effort | 3 |
| I did not know it | 1 |

## CSS

```css
.review-badge { /* pill on btnReview */ }
.review-early-chip { /* subtle inline chip */ }
```

## Coexistence

- `reviewSessionBtn` / LLM block review unchanged
- `screenReview` shared for SM-2 flow; set `aria-hidden` via existing `showScreen` helpers

## Empty state copy

"No review items yet. Study in RSVP, Cloze, or Slow Mode to build your queue."

## Accessibility

- Badge has `aria-label` with count
- Quality buttons are `button type="button"` with visible labels

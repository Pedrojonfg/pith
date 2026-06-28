# Research: Vault Study Trail

**Date**: 2026-06-28

## R1 — Event field name

**Finding**: Per-event log is `entry.observations[]`, not `history`/`events`/`studyLog`.

**Shape** (from `mastery-model.js` `updateMastery`):

```js
{ type, rawSignal, timestamp, docId, taskKind?, facet?, wrongAnswer? }
```

**Types** in `OBSERVATION_WEIGHTS`: `cloze_correct|wrong`, `review_correct|partial|wrong`, `socratic_passed|partial`, `assessment_mastered|partial|unknown`, `mcq_correct|wrong`.

**Decision**: Map `type` → mode + result for display. No data model extension required.

## R2 — Concept detail render site

**Finding**: `renderDetail(host, entry)` in `src/js/vault/debug-ui.js` builds `.vault-detail` HTML. Used from vault overlay panel and `vaultGraphDetailPanel` via `study.js`.

**Decision**: Inject Study trail section at end of `renderDetail` innerHTML / DOM.

## R3 — CSS variables

**Finding**: `main.css` uses `--success`, `--error`, `--accent`, `--text-muted` (via `--text-secondary` / muted hints). No `--color-success` prefix.

**Decision**: Use existing `--success`, `--error`, `--accent`, `--text-muted`.

## R4 — Icons

**Finding**: No Lucide script in `index.html`.

**Decision**: Inline SVG icons (~16px) matching Lucide paths for zap, book-open, puzzle, mic, repeat.

## R5 — Relative time

**Finding**: `formatRelativeTime` in `debug-ui.js` only covers minutes/hours/days.

**Decision**: New `formatStudyTrailRelativeTime` in `study-trail.js` per spec buckets.

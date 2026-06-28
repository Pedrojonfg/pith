# Spec: Vault Study Trail

**Date:** 2026-06-28  
**Status:** Ready for implementation  
**Priority:** Medium ([B] — data exists, view is missing)  
**Supersedes:** Nothing  
**Related specs:** `20260618-knowledge-vault-a-plus`, `20260619-knowledge-vault-post-a-plus`, `20260624-knowledge-vault-curation`

---

## Context

Every time a concept enters or is reinforced in the Knowledge Vault, an event is recorded — the mode that triggered it (RSVP, Slow, Cloze, Recall, Review), the timestamp, and the result (correct, incorrect, promoted, reviewed, etc.). This data is already stored in `vault-store.js` as part of each vault entry.

What is missing: a UI that surfaces this chronological history per concept, so the user can see at a glance *how* they learned something and *when*. This is the Study Trail.

---

## Goal

Add a Study Trail section to the vault concept detail view (wherever a single vault concept is currently displayed — likely the `#knowledgeVaultOverlay` or the vault panel in `screenVaultBranch`). The trail shows a reverse-chronological list of study events for that concept.

---

## Data model

### Existing structure to read from

Each vault entry in `pith_knowledge_vault` (managed by `vault-store.js`) has a history or events array. Before implementing, Cursor must confirm the exact field name by inspecting `vault-store.js`. Expected candidates:

- `entry.history[]`
- `entry.events[]`  
- `entry.studyLog[]`
- `entry.signals[]` (less likely — signals may live in `assessmentSignals` on the session)

Each event record is expected to have at minimum:

```js
{
  ts: number,          // Unix timestamp (ms)
  mode: string,        // "rsvp" | "slow" | "cloze" | "recall" | "review"
  result: string,      // e.g. "correct" | "incorrect" | "promoted" | "reviewed" | "added"
  // possibly: docId, blockIndex, sessionId
}
```

**If no per-event log exists:** If inspection reveals that vault entries only store aggregate data (e.g. `reviewCount`, `lastReviewed`) and no per-event array, this spec must be paused and the data model must be extended first. Do not fabricate or infer events from aggregate fields. In that case, file a note in the spec folder and stop — do not implement a fake trail.

---

## Rules

### R1 — Location in UI

The Study Trail must appear inside the concept detail view — the panel or overlay that shows a single vault concept's full details (name, definition, notes, related concepts, etc.). It must be a collapsible section at the bottom of that view, collapsed by default.

Section header: **"Study trail"**  
Collapsed state: shows header + item count ("12 events").  
Expanded state: shows the full event list.

### R2 — Event list format

Each row in the trail shows, from left to right:

```
[mode icon]  [mode label]  [result badge]  [relative date]
```

- **Mode icon:** a small Lucide icon representing the mode:
  - RSVP → `zap` (fast/flash)
  - Slow → `book-open`
  - Cloze → `puzzle`
  - Recall → `mic`
  - Review → `repeat`
- **Mode label:** "RSVP", "Slow read", "Cloze", "Recall", "Review" — capitalised, in the study language or always English (match whatever locale the rest of the vault UI uses).
- **Result badge:** small pill badge with 2–3 word label and colour:
  - `correct` → green, "Correct"
  - `incorrect` → red/muted-red, "Missed"
  - `promoted` → teal (accent), "Added to vault"
  - `reviewed` → neutral, "Reviewed"
  - `added` → teal, "Added"
  - Unknown/missing result → neutral, "—"
- **Relative date:** human-readable relative time ("2 days ago", "just now", "3 weeks ago"). Use a lightweight implementation — no external library. A simple function covering: just now (<1 min), N minutes ago, N hours ago, yesterday, N days ago, N weeks ago, N months ago.

List is sorted reverse-chronological (most recent first). Maximum 50 events shown; if more exist, show a muted "… and N more earlier events" footer — no pagination needed.

### R3 — Empty state

If the event array exists but is empty, show:

```
No study history yet for this concept.
```

Small muted text, centred in the section.

### R4 — Read-only

The trail is display-only. No delete, edit, or filter controls. No interaction beyond the collapse/expand toggle.

### R5 — Performance

The trail renders only when the section is expanded. Do not render the event list on concept panel open — render lazily on first expand. This avoids layout thrashing for concepts with large histories.

### R6 — Design system compliance

- DM Sans, existing CSS variables for colours (`--color-accent`, `--color-text-muted`, `--color-success`, `--color-error`, etc.). Verify variable names in `src/css/main.css` before writing inline styles.
- 3–4px border radius on badges.
- Icons: Lucide only, consistent size with other icons in the vault panel.
- No new CSS files — extend the existing vault CSS (likely `src/css/main.css` or a vault-specific file; check what exists).
- The section must not break the "compress before overflow" layout rule — if the concept panel is space-constrained, the collapsed trail header must take ≤ one line.

### R7 — No writes

This spec adds only a read view. Do not add, modify, or backfill any vault entry data. Do not create fake history records for concepts that were added before this feature existed — they will simply show an empty trail (R3).

---

## Non-goals

- No filtering by mode or date range.
- No export of the trail.
- No aggregate stats ("X% correct rate") — those belong to a separate analytics feature.
- No changes to how events are written — that already works.
- No backfill of historical data.

---

## Files likely touched

| File | Change |
|------|--------|
| `vault/debug-ui.js` or concept panel render file | Add collapsible trail section to concept detail view |
| `index.html` (possibly) | Add trail section markup if concept panel is static HTML |
| `src/css/main.css` or vault CSS | Add trail row, badge, and collapse styles |

---

## Open questions for Cursor before implementing

1. **Critical:** Inspect `vault-store.js` — confirm the exact field name of the per-event array on vault entries, and the exact shape of each event object (fields, value enumerations for `mode` and `result`). If no per-event array exists, stop and report before proceeding.
2. Confirm where the concept detail view is rendered (which file, which function) — the study trail section must be injected there.
3. Confirm the existing CSS variable names for success/error/accent colours in `src/css/`.
4. Confirm which Lucide icons are already loaded in `index.html` (to avoid adding new icon imports if they're not needed).

---

## Test

1. Open a vault concept that has study history → trail section appears collapsed at the bottom, showing correct event count.
2. Expand the trail → events appear in reverse-chronological order with correct mode icons, result badges, and relative dates.
3. Open a vault concept with no history → trail section shows the empty state message.
4. Verify no layout breakage in the concept panel at normal viewport sizes.
5. Verify collapse/expand works without re-fetching data (renders once on first expand, stays rendered).
6. Run SW update flow test after cache bumps.

---

## SW / cache bump checklist

- [ ] `?v=` bumped on every modified JS file imported in `index.html`
- [ ] `SW_VERSION` bumped in `sw-update.js`
- [ ] `CACHE_NAME` bumped in `sw.js`

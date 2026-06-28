# Deep Dive: Vault Study Trail

**Date:** 2026-06-28  
**Module:** `src/js/vault/study-trail.js`, `debug-ui.js`

---

## 1. What we built

A read-only **Study trail** section on the vault concept detail panel (`renderDetail` in `debug-ui.js`). It surfaces `entry.observations[]` — the per-study signals already written by session-close and vault review — as a reverse-chronological list with mode label, outcome badge, and relative time. The section is collapsed by default, shows an event count in the header, and renders the list lazily on first expand so large histories do not slow panel open.

---

## 2. Design decisions

### Use `observations[]` instead of a new event log

**Chosen:** Map existing `VaultObservation` records (`type`, `timestamp`, `docId`, …) to display rows.

**Alternatives:** Add `history[]` / `studyLog[]` as the source spec guessed; backfill from aggregates.

**Why discarded:** Inspection of `vault-store.js` and A+ data model confirmed observations are already the canonical per-event log. A parallel array would duplicate data and violate R7 (no writes).

**Trade-off:** Display semantics are inferred from `type` strings (`mcq_correct` → RSVP + Correct), not stored mode/result fields. New observation types need mapper updates.

### Pure module + DOM wiring split

**Chosen:** `study-trail.js` exports pure functions; `debug-ui.js` owns `<details>` lifecycle and lazy render.

**Alternatives:** All logic inline in `renderDetail` innerHTML; React-like component file.

**Why discarded:** Keeps mapping/time logic unit-testable without JSDOM; matches existing vault debug panel style (imperative DOM).

**Trade-off:** Two files to touch for UI tweaks; no shared component reuse outside vault detail yet.

### Inline SVG icons instead of Lucide CDN

**Chosen:** Small inline SVG paths in `ICON_SVG` keyed by mode.

**Alternatives:** Add Lucide script to `index.html`; Unicode emoji; no icons.

**Why discarded:** Project does not load Lucide anywhere; adding a CDN dependency for five icons violates compress-before-overflow.

**Trade-off:** Icons are approximate Lucide shapes, not the real library; maintenance is manual if design changes.

### Lazy render via `<details toggle>`

**Chosen:** `rendered` flag + one-shot listener on first open.

**Alternatives:** Render all rows on panel open; virtualized list; pagination.

**Why discarded:** Spec caps at 50 rows with overflow footer; lazy first expand satisfies R5 without pagination complexity.

**Trade-off:** Relative times are frozen at first expand (not live-updating). Re-opening same concept re-runs `renderDetail` and resets the section.

### Keep "Recent observations" debug list

**Chosen:** Additive Study trail at bottom; leave raw observation list for debug overlay users.

**Alternatives:** Replace debug list entirely.

**Why discarded:** Overlay is still a debug/settings surface; raw types help developers. Product trail is learner-facing formatting.

**Trade-off:** Redundant information when expanded — acceptable until debug panel is simplified.

---

## 3. Concepts applied

| Concept | Where |
|--------|--------|
| **Adapter / presentation mapping** | `mapObservationToTrailRow`, `RESULT_BY_TYPE`, `MODE_BY_TYPE_PREFIX` translate domain types to UI DTOs |
| **Stable sort** | `buildStudyTrailRows` copies array then sorts by `timestamp` desc — O(n log n) |
| **Cap + overflow pattern** | `slice(0, MAX_STUDY_TRAIL_EVENTS)` with `overflow = total - max` for footer copy |
| **Lazy initialization** | `rendered` boolean gate in `toggle` handler — classic deferred work |
| **Native collapsible** | `<details>/<summary>` — no JS state machine for open/closed |
| **CSS grid layout** | `.vault-trail-row` — icon, label, badge, time columns |
| **Design tokens** | Badge modifiers use `--success`, `--error`, `--accent`, `--text-muted` |
| **Pure functions for testability** | `formatStudyTrailRelativeTime(ts, now)` accepts injectable `now` for deterministic tests |

---

## 4. Technical debt and improvements

**Well done:** Read-only boundary is clear; no vault mutations. Mapper is isolated and covered by cursor-tests. SW bump followed project rules.

**Duct tape:** Mode is inferred from type prefix (`mcq` → RSVP), so Slow mode has no observation types today and never appears. `vault_added` / `concept_added` result types are mapped but not emitted by current writers — "Added to vault" badges will rarely show. Relative time in rows uses `Date.now()` at render time, not the injectable `now` used in tests.

**Won't scale:** Prefix-based lookup breaks if types stop using `_` convention (e.g. `slow-annotation`). Very long histories still sort the full array on every first expand — fine at hundreds, wasteful at thousands (would need server-side trail or indexed tail). Duplicate debug + trail lists confuse power users.

**Missing:** No DOM/integration test for lazy expand; cursor-tests only hit pure module. `formatRelativeTime` in `debug-ui.js` duplicates a subset of trail time logic.

---

## 5. Consolidation questions

1. Which code paths append to `entry.observations`, and what `type` values can each path emit today? (Needed before adding a new badge or mode.)
2. Why does `renderDetail` slice observations to 10 for the debug list but pass the full array to the trail — and should those two views share one sorted source?
3. If a new study mode adds observations, what is the contract for `type` naming so `resolveTrailMode` / `resolveTrailResult` stay correct without silent "Study / —" fallbacks?

---

## 6. Suggested update for .cursorrules

1. **Vault event history:** Per-concept study events live in `entry.observations[]` (`VaultObservation`), not `history`/`events`. Read-only UI must map `type` → display; do not invent parallel logs.

2. **Vault detail UI:** New vault concept panel sections should use collapsible + lazy render when lists can exceed ~20 items; cap display at 50 with overflow footer unless spec says otherwise.

3. **Icons:** Do not add Lucide CDN for vault UI — use inline SVG consistent with `study-trail.js` unless a project-wide icon strategy is introduced.

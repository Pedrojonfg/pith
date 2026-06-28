# Deep Dive: Assessment Toggle UI (RSVP)

**Date:** 2026-06-28  
**Feature:** `specs/20260628-assessment-toggle-ui`  
**ROADMAP:** `ROADMAP-assessment-toggle-ui.md`

---

## 1. What we built

We exposed an existing but invisible RSVP configure-screen checkbox so learners can turn the pre-packing knowledge assessment on or off before generating blocks. The preference persists globally in `localStorage` (`pith_assessment_before_packing`, default ON) and drives `isPrePackingAssessmentEnabled()` at runtime. When OFF, RSVP skips `screenPrePackingAssessment` / results and proceeds straight to packing; when ON, behavior matches the previous hardcoded flag. The toggle is RSVP-only and hidden offline.

---

## 2. Design decisions

### Reuse existing markup instead of new UI

**Chosen:** Keep `#rsvpAssessmentOption` / `#rsvpRunAssessment` in `index.html`; update copy only.

**Alternatives:** New toggle in Settings, or a new DOM structure with fresh CSS classes.

**Why discarded:** Markup and `shouldRunPrePackingAssessment()` already existed; the bug was wiring, not product design. Settings was explicitly out of scope (per-session configure context, not app-wide settings screen).

**Trade-off:** We inherit the `create-already-know` class name on a control that is not “already know material” — cosmetic debt, no functional impact.

### Single gate via `isPrePackingAssessmentEnabled()`

**Chosen:** `isPrePackingAssessmentEnabled()` reads `localStorage`; deprecate static `ASSESSMENT_BEFORE_PACKING` but leave it in `ASSESSMENT_FLAGS`.

**Alternatives:** (a) New function `isAssessmentBeforePackingEnabled()` per spec draft; (b) keep hardcoded flag and only use checkbox state in `shouldRunPrePackingAssessment()`.

**Why discarded:** (a) duplicates an existing name already imported in `study.js`, holistic assessment, and adaptive probing. (b) leaves downstream callers (`isHolisticAssessmentEnabled`, `isAdaptiveProbingEnabled`) blind to user preference.

**Trade-off:** “Feature flag” and “user preference” are conflated in one function — fine for a PWA with no remote flag service, but confusing if we later add server-side toggles.

### Toggle stays visible when preference is OFF

**Chosen:** Visibility = `isRsvp && !isOfflineMode()` only.

**Alternatives:** Hide when `!isPrePackingAssessmentEnabled()` (previous broken logic).

**Why discarded:** If hidden when OFF, the user cannot re-enable without clearing `localStorage` manually.

**Trade-off:** Slightly noisier UI for users who turned it off — acceptable for a reversible preference.

### Strict checkbox check in `shouldRunPrePackingAssessment()`

**Chosen:** `els.rsvpRunAssessment?.checked === true` (was `!== false`).

**Alternatives:** Rely only on `isPrePackingAssessmentEnabled()` after sync.

**Why changed:** Explicit boolean avoids ambiguous “indeterminate / missing element defaults to run assessment” behavior; checkbox and storage are synced on RSVP render.

**Trade-off:** If sync fails, assessment won't run even if storage says ON — defensive, matches visible UI state.

### Preference helpers colocated with flags (`flags.js`)

**Chosen:** `getAssessmentBeforePackingPreference()` / `saveAssessmentBeforePackingPreference()` next to `getSourceFidelityStrictPreference()`.

**Alternatives:** New `preferences.js` module.

**Why discarded:** Project already stores user prefs in `flags.js` for source fidelity; one pattern, minimal import churn.

**Trade-off:** `flags.js` mixes compile-time constants and runtime prefs — growing file, but consistent with existing code.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Feature flag indirection** | Runtime behavior gated by a function, not a constant | `isPrePackingAssessmentEnabled()` in `flags.js`; callers in `study.js`, holistic/adaptive paths |
| **Persistent client state** | User preference survives sessions via browser storage | `LS_ASSESSMENT_BEFORE_PACKING_KEY`, JSON boolean read/write in `flags.js` |
| **DOM registry / element cache** | Central `els` map avoids repeated `getElementById` | `rsvpAssessmentOption`, `rsvpRunAssessment` in `ui.js` |
| **Mode-conditional UI** | Show/hide controls based on study mode | `updateCreateScreenModeVisibility()` in `study.js` |
| **Event-driven persistence** | UI change immediately writes storage | `change` listener on `rsvpRunAssessment` in `wireStudyModeSelector()` |
| **Fail-safe defaults** | Corrupt/missing storage → safe default (ON) | `try/catch` + `pref === null ? true` in `getAssessmentBeforePackingPreference()` |
| **PWA cache busting** | Version markers force clients to load new JS | `SW_VERSION`, `CACHE_NAME`, `?v=` in `index.html` |

---

## 4. Technical debt and improvements

**Well done**

- Minimal diff; fixed root cause (`rsvpAssessmentOption` missing from `els`).
- Follows existing source-fidelity preference pattern.
- Default ON preserves production behavior for existing users.
- Pure preference helpers are easy to unit-test in Node (`cursor-tests/20260628_assessment-toggle-ui.mjs`).

**Functional duct tape**

- `isPrePackingAssessmentEnabled()` name no longer means “is this feature shipped?” — it means “did the user opt in?”. Grep for `ASSESSMENT_BEFORE_PACKING` still finds the deprecated constant; new code should use the getters only.
- Checkbox state and `localStorage` can theoretically drift if something sets storage without calling `syncRsvpAssessmentToggleFromPreference()` — only RSVP configure path syncs today.
- `JSON.parse(pref) === true` rejects `"true"` string (non-JSON) and falls back to default ON — fine, but inconsistent with source fidelity using plain `"true"` string.

**Would not scale**

- Global single key: no per-project or per-document assessment defaults (spec explicitly rejected DocumentSession storage).
- No migration if we rename the key or change default for new users vs returning users.
- No analytics on opt-out rate — product blind spot if assessment skip becomes common.

---

## 5. Consolidation questions

1. **Why was the toggle invisible before this change, and what other `els` entries might be missing the same way?**  
   Trace: `updateCreateScreenModeVisibility` sets `.hidden` on `els.rsvpAssessmentOption`, which was `undefined` → no-op → element stayed `hidden` from HTML.

2. **If a user disables assessment, which downstream features besides pre-packing screens are affected?**  
   Follow `isPrePackingAssessmentEnabled()` into `isHolisticAssessmentEnabled()`, `isAdaptiveProbingEnabled()`, and `shouldRunPrePackingAssessment()` — list each path that short-circuits.

3. **What happens in offline RSVP mode, and is hiding the toggle the right product call?**  
   Offline already skips assessment in `shouldRunPrePackingAssessment()`; confirm whether users should see a disabled toggle with explanation vs complete hide.

---

## 6. Suggested update for .cursorrules

1. **When adding DOM controls referenced in JS, register both the container and the input in `ui.js` `els` in the same PR** — orphaned `#id` in HTML with a missing `els` entry fails silently for visibility toggles.

2. **User-facing booleans in `screenPlaceholder` that affect flow gating must persist via named `LS_*` keys in `config.js` and read/write helpers in `flags.js`**, following `getSourceFidelityStrictPreference` — not hardcoded `ASSESSMENT_FLAGS` constants.

3. **RSVP-only controls: visibility must depend on mode (and offline), not on the current value of the preference** — otherwise OFF preferences hide the control needed to turn the feature back ON.

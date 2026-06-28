# Spec: Assessment Toggle UI (RSVP)

**Date:** 2026-06-28  
**Status:** Ready for implementation  
**Priority:** High ([A] — feature exists in logic but is inaccessible to user)  
**Supersedes:** Nothing  
**Related specs:** `20260611-rsvp-assessment-reposition`, `20260618-holistic-assessment-coverage`

---

## Context

The pre-packing assessment flow is fully implemented: `screenPrePackingAssessment`, `screenPrePackingResults`, and the flag `ASSESSMENT_BEFORE_PACKING` in `config/flags.js` all exist. The assessment itself works correctly when triggered.

The problem: there is no UI control that lets the user turn the assessment on or off. The flag is hardcoded. The user has no agency over whether to take the assessment before RSVP starts. This is a missing wiring problem, not a missing feature.

---

## Goal

Add a toggle in `screenPlaceholder` (the RSVP configuration screen) that lets the user choose whether to take the pre-packing assessment. The toggle's value must persist across sessions (localStorage), not just for the current document. The underlying `ASSESSMENT_BEFORE_PACKING` flag must be driven by this persisted preference at runtime.

---

## Rules

### R1 — Toggle location

The toggle must appear in `screenPlaceholder` in the RSVP configuration section, alongside existing RSVP-specific controls (block count, reading mode, etc.). It must NOT appear for other study modes (Questions, Slow, Cloze, Recall).

The toggle is only visible when `studyMode === "rsvp"`. If the placeholder renders for another mode, the toggle must be hidden (CSS `display: none` or conditional render — verify how existing RSVP-only controls are conditionally shown, and use the same pattern).

### R2 — Label and copy

```
[ ] Quick assessment before studying
    Adapts block difficulty to what you already know.
```

- Label: **"Quick assessment before studying"**  
- Sublabel (small, muted): **"Adapts block difficulty to what you already know."**  
- Default state: **ON** (checked). This matches the current hardcoded `ASSESSMENT_BEFORE_PACKING: true` behaviour, so no regression for users who never see the toggle.

### R3 — Persistence

Store the preference in `localStorage` under the key `pith_assessment_before_packing` as a JSON boolean (`true` / `false`).

```js
// Read
const pref = localStorage.getItem('pith_assessment_before_packing');
const assessmentEnabled = pref === null ? true : JSON.parse(pref); // default ON

// Write (on toggle change)
localStorage.setItem('pith_assessment_before_packing', JSON.stringify(checked));
```

Do NOT store this preference inside `DocumentSession`. It is a global user preference, not a per-document setting.

### R4 — Runtime flag override

The runtime check that gates the assessment flow must read from the persisted preference rather than the hardcoded flag. Locate the call site(s) that read `ASSESSMENT_BEFORE_PACKING` from `config/flags.js` (likely in `study.js` or `rsvp.js`) and replace the flag read with a helper:

```js
function isAssessmentBeforePackingEnabled() {
  const pref = localStorage.getItem('pith_assessment_before_packing');
  return pref === null ? true : JSON.parse(pref);
}
```

Place this helper in `config/flags.js` or in a small inline utility — whichever is consistent with how other dynamic flag reads are handled in the codebase. Do NOT remove the static `ASSESSMENT_BEFORE_PACKING` constant from `config/flags.js`; mark it `@deprecated` and leave it in place so Cursor can find references.

### R5 — Toggle initialisation

When `screenPlaceholder` renders for RSVP, the toggle's checked state must be initialised from the persisted preference (via the same read logic as R3). Do not assume the default — always read from storage.

### R6 — No impact on other modes

Questions mode also uses `assessmentSignals`, but its assessment path is separate. This toggle controls only the RSVP pre-packing assessment. Do not touch Questions mode logic.

### R7 — Design system compliance

- Use the same toggle/checkbox component pattern already present in `screenPlaceholder` for other boolean controls (verify the existing HTML pattern — likely `<label class="toggle-row">` or similar).  
- Do not introduce new CSS classes if existing ones cover the case.  
- Font: DM Sans. No new icons needed.

---

## Non-goals

- Do not add a toggle in Settings (this is a per-session choice, not a global app preference — the localStorage key is a convenience, not a Settings concern).
- Do not change the assessment flow itself.
- Do not add the toggle to the Questions mode placeholder.
- Do not add any animation or confirmation when toggling.

---

## Files likely touched

| File | Change |
|------|--------|
| `index.html` | Add toggle element inside the RSVP section of `screenPlaceholder` |
| `config/flags.js` | Add `isAssessmentBeforePackingEnabled()` helper; mark `ASSESSMENT_BEFORE_PACKING` as `@deprecated` |
| `study.js` or `rsvp.js` | Replace `ASSESSMENT_BEFORE_PACKING` flag read with `isAssessmentBeforePackingEnabled()` call |
| `ui.js` (possibly) | Initialise toggle state when placeholder renders, if placeholder init lives here |

---

## Open questions for Cursor before implementing

1. Confirm exact location(s) where `ASSESSMENT_BEFORE_PACKING` is read at runtime (search across all `src/js/`).
2. Confirm the existing HTML pattern for boolean toggles in `screenPlaceholder` to reuse the same markup.
3. Confirm whether placeholder rendering/initialisation for RSVP lives in `study.js`, `ui.js`, or a dedicated file — to know where to wire the toggle init and change handler.
4. Confirm the existing mechanism used to show/hide RSVP-only controls in the placeholder (CSS class toggle, `hidden` attribute, or conditional innerHTML).

---

## Test

1. Enter RSVP mode from any document → `screenPlaceholder` must show the toggle, checked ON by default.
2. Uncheck the toggle → proceed to blocks. The assessment screens (`screenPrePackingAssessment`, `screenPrePackingResults`) must NOT appear; packing proceeds immediately.
3. Check the toggle back ON → proceed to blocks. The assessment must appear as before.
4. Reload the app and re-enter RSVP → toggle state must reflect what was last saved.
5. Enter Questions, Slow, Cloze, or Recall mode → toggle must not be visible in placeholder.
6. Run `cursor-tests/20260606_validate-sw-update-flow.mjs` after SW bumps.

---

## SW / cache bump checklist

- [ ] `?v=` bumped on every modified JS file imported in `index.html`
- [ ] `SW_VERSION` bumped in `sw-update.js`
- [ ] `CACHE_NAME` bumped in `sw.js`

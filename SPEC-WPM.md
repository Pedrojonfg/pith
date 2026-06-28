# SPEC: Adaptive WPM Calibration for RSVP
**Date:** 2026-06-28  
**Status:** Approved  
**Supersedes:** nothing  

---

## 1. Goal

Automatically adjust each user's RSVP base WPM over time using their actual MCQ performance as a comprehension signal. The user never has to self-report whether they understood — the system infers it from results and updates silently.

---

## 2. Non-goals

- No logarithmic slider scale (stays linear, 150–1000 wpm).
- No hard ceiling below 1000 wpm.
- No per-block mid-session interruption ("you're going too fast").
- No separate calibration mode or onboarding test.
- No changes to how MCQs are generated or scored.
- No changes to the Paced Reader / Slow Mode.

---

## 3. Definitions

| Term | Definition |
|------|------------|
| **WPM base** | The user's persisted recommended speed. Shown as a marker on the RSVP slider. User can override freely in any session. |
| **Session WPM** | The speed the user actually ran during the session (may differ from WPM base). |
| **Comprehension score** | % of MCQ items classified as detail/inference answered correctly in a block. See R4. |
| **Eligible block** | A block with ≥1 detail/inference MCQ answered (not skipped). |
| **Qualifying session** | A session with ≥3 eligible blocks completed. |

---

## 4. Rules

### R1 — WPM base storage
- Stored in `localStorage` under key `pith_rsvp_wpm_base`.
- Default if missing: **300 wpm**.
- Type: integer, clamped to [150, 1000].

### R2 — Session WPM used for evaluation
- The WPM used to evaluate a session is the **median WPM across all eligible blocks** in that session (blocks can differ if the user adjusts mid-session).
- If the user never touched the slider, this equals the session-start WPM.

### R3 — Minimum blocks before any adjustment
- An adjustment only fires if the session has **≥3 eligible blocks**.
- Sessions with fewer than 3 eligible blocks are ignored for calibration purposes.

### R4 — Classifying MCQ items
- **Detail/inference items:** any MCQ item where `questionClass` in the concept inventory is `"factual"`, `"inferential"`, or `"applied"`.
- **Gist items:** `questionClass === "conceptual"` or `"definitional"`.
- Only detail/inference items count toward the comprehension score.
- If a block has zero detail/inference items, it is not an eligible block.

> **Open question for Cursor:** Confirm the exact `questionClass` values emitted by `api.js` / `deepSeekGenerateBlockJson`. The classification above is based on the values documented in `session-types.js`; verify against live output before implementing R4.

### R5 — Comprehension score calculation
- Per block: `score = correct_detail_inference / total_detail_inference`.
- Per session: **mean of per-block scores** across all eligible blocks (not pooled item count, to prevent long blocks from dominating).

### R6 — Adjustment logic
Applied once, at session end, after `screenComplete` is reached:

| Session comprehension score | Adjustment to WPM base |
|-----------------------------|------------------------|
| ≥ 0.75 | **+25 wpm** |
| 0.50 – 0.74 | **no change** |
| < 0.50 | **−25 wpm** |

- The adjustment is applied to the **WPM base**, not to the session WPM.
- The result is clamped to [150, 1000].
- The new value is written to `localStorage` immediately.

### R7 — Adjustment uses session WPM, not base WPM
- If the user ran the session at a WPM different from their base (e.g., they manually set 600), the adjustment still fires based on their actual performance — it's their real signal.
- The adjustment is always to the base, so if they ran at 600 and scored ≥0.75, the base goes up by 25 from wherever it was, not to 625. This prevents wild jumps from one-off overrides.

### R8 — UI: recommended speed marker
- On the RSVP speed slider in `screenPlaceholder` (or wherever the WPM slider lives), display a small visual marker labeled **"recomendado"** at the WPM base position.
- The marker moves when the base changes (next session).
- The user can ignore it and set any value they want.
- No tooltip required; the label is enough.

### R9 — No notification, no explanation
- The WPM base update is silent. No toast, no modal, no "your speed has been adjusted."
- The updated marker position on the next session's slider is the only signal.

---

## 5. Data flow

```
screenTest (RSVP blocks)
  → user answers MCQs
  → responses stored in session (existing path)

screenComplete reached
  → [NEW] computeSessionComprehension(session)
      → filter eligible blocks (≥1 detail/inference item answered)
      → if eligible blocks < 3 → return null (no adjustment)
      → compute per-block scores → session mean
      → derive adjustment (+25 / 0 / −25)
      → read pith_rsvp_wpm_base from localStorage
      → apply adjustment, clamp [150, 1000]
      → write back to localStorage

screenPlaceholder (next session)
  → [NEW] read pith_rsvp_wpm_base
  → render marker at that position on slider
```

---

## 6. Implementation sequence (risk-ordered)

1. **Verify `questionClass` values in live MCQ output** (R4 open question). Do this before writing any logic — if the classification is wrong, the whole signal is wrong.
2. Add `computeSessionComprehension(session)` in a new small module or inline in `study.js` near the session-complete handler.
3. Add localStorage read/write helpers for `pith_rsvp_wpm_base` (read with default 300, write with clamp).
4. Wire the call at session complete (after existing complete-screen logic, fire-and-forget — must not block navigation).
5. Add the "recomendado" marker to the WPM slider UI.
6. Test: manually run 3+ blocks, check localStorage before and after session complete.

---

## 7. Testing checklist

- [ ] Session with 2 eligible blocks → no adjustment fires.
- [ ] Session with 3 eligible blocks, score ≥0.75 → base +25.
- [ ] Session with 3 eligible blocks, score 0.50–0.74 → base unchanged.
- [ ] Session with 3 eligible blocks, score <0.50 → base −25.
- [ ] Base at 150 with score <0.50 → stays at 150 (clamp floor).
- [ ] Base at 1000 with score ≥0.75 → stays at 1000 (clamp ceiling).
- [ ] User ran session at WPM ≠ base → adjustment still applies to base (not session WPM).
- [ ] Slider marker appears at base WPM on next session load.
- [ ] No toast/modal fires at session complete.
- [ ] Blocks with zero detail/inference items are excluded from eligible count.

---

## 8. Open questions for Cursor before implementing

1. **`questionClass` values:** Confirm exact string values emitted for MCQ items in `deepSeekGenerateBlockJson`. Which values map to detail/inference vs gist? (R4)
2. **Where is the session-complete handler?** Identify the exact function/line in `study.js` that fires when the user reaches `screenComplete` from an RSVP/Questions session, to know where to hook the calibration call.
3. **Where is the WPM slider rendered?** Confirm the DOM element ID and the JS that initializes its value, to know where to add the marker (R8).
4. **Are per-block MCQ responses already structured with `questionClass`?** Or does the response object only store correct/incorrect without the item metadata? If the latter, we need to join against the block's question list to classify items.

# Deep Dive — Session Preparation Gate

## 1. What we built

We added a **navigation gate** between document upload and mode select. Until Tier 1 of the Document Preparation Pipeline (DPP) finishes—concept inventory, study-flow recommendation, and RSVP block count—the user stays on a full-screen “Processing document…” state instead of landing on an empty mode picker.

The gate applies to every path that uploads material and then opens mode select: Create session, hub upload (`recommendFlowFromUploadedFile`), and interview synthesis. Tier 2 work (Cloze items, Recall questions, Slow orientation) still runs, but only **after** the gate passes, in the background.

## 2. Design decisions

### Tier 1 only as the gate (not full DPP)

**Chosen:** Block until `conceptInventory`, `modeRecommendation`, and `blockRecommendation` exist; allow `partial` status if Tier 1 artifacts are present.

**Alternatives:** (a) wait for full Tier 1+2 — rejected because it adds minutes before any study choice; (b) progressive readiness (enter mode select while Tier 2 runs) without blocking — rejected because RSVP opened before block count existed.

**Trade-off:** Cloze/Recall may still be generating when the user enters a mode; mode-bootstrap already handles `partial` prep.

### `ensureTier1Preparation` with in-flight deduplication

**Chosen:** A `Map<docId, Promise>` in `document-preparation.js` so file-pick background prep and Continue-click await share one Tier 1 run.

**Alternatives:** Always start a new pipeline run — risks duplicate LLM calls and race writes to `shared`.

**Trade-off:** In-flight map is module-global; tab duplication or multiple windows could still double-run (same as rest of localStorage PWA).

### Reuse `reviewGenerating` screen for the loading UX

**Chosen:** `showDocumentPreparingScreen()` toggles `screenReviewGenerating` with phase labels from DPP `onProgress`.

**Alternatives:** New dedicated screen — more HTML/CSS for a transient state.

**Trade-off:** Same screen used for review question generation; cancel button hidden during prep to avoid ambiguous semantics.

### `kickoffTier2PreparationInBackground` after gate

**Chosen:** After Tier 1, call `runDocumentPreparationPipeline` with `stopAfterTier: 2` without awaiting.

**Problem solved:** `startDocumentPreparation` used to return early when `prep.status === "ready"`, which blocked Tier 2 after Tier 1 set status to `ready`. Added `hasPendingTier2Preparation()` to detect missing T2.x phase results.

**Trade-off:** Two entry points for DPP (`ensureTier1Preparation` vs `kickoffTier2`); callers must remember the sequence.

### Stricter `isTier1PreparationComplete`

**Chosen:** Require inventory + block recommendation + mode recommendation; reject `running` even if artifacts appear mid-flight.

**Previously:** `ready` status alone returned true; inventory-only check on `partial`.

**Trade-off:** Legacy sessions with `ready` but missing block rec (corrupt data) now fail the gate until retry.

## 3. Concepts applied

| Concept | Where it appears |
|--------|------------------|
| **Promise deduplication / single-flight** | `tier1InFlight` Map in `document-preparation.js` — concurrent callers await the same `runDocumentPreparationPipeline` promise |
| **Pipeline staging (tiered batch jobs)** | DPP `stopAfterTier: 1` vs `2`; gate uses Tier 1 only |
| **State machine / readiness predicate** | `isTier1PreparationComplete` in `session-types.js` — pure function over `preparation.status` + shared artifacts |
| **Facade / orchestration** | `enterModeSelectAfterTier1Gate` in `study.js` — coordinates UI, await, background kickoff, navigation |
| **Idempotent phase skip** | `phaseSucceeded` + fingerprint in DPP — Tier 2 run skips completed Tier 1 phases |
| **Fire-and-forget async** | `void startDocumentPreparation` on file pick; `kickoffTier2PreparationInBackground` after gate |
| **Run ID cancellation** | `createSessionStartRunId` — stale upload callbacks ignored after user picks a new file |

## 4. Technical debt and improvements

**Well done**

- Single canonical gate function reused across three entry points.
- Pure `isTier1PreparationComplete` testable without browser DOM.
- Copy and behavior aligned (no more “continue anyway” on prep failure).

**Duct tape**

- `study.js` still owns UI orchestration; gate logic split across `study.js`, `document-preparation.js`, and `session-types.js`.
- `reviewGenerating` screen overloaded for unrelated flows.
- `enterModeSelectAfterTier1Gate` on failure returns to `createSessionStart` even when failure originated from interview or hub upload.

**Would not scale**

- In-flight map is per-tab memory only; no cross-tab lock on prep.
- No explicit “Retry preparation” button on gate failure—user must tap Continue again or fix API key.
- Re-opening a session from library that is still `running` does not auto-resume the loading screen unless user hits a gated entry point again.

## 5. Consolidation questions

1. Why does `prep.status === "ready"` after Tier 1 block a naive Tier 2 start, and how does `hasPendingTier2Preparation` fix it without a new status enum?
2. If file-pick starts Tier 1 in the background and the user taps Continue before it finishes, what guarantees exactly one LLM inventory run?
3. Under what `preparation.status` values does `mode-bootstrap` allow RSVP bootstrap, and how does the stricter gate predicate interact with that?

## 6. Suggested update for .cursorrules

1. **Upload → mode select:** Any new upload path that calls `enterModeSelectScreen` MUST await `ensureTier1Preparation` (or `enterModeSelectAfterTier1Gate`); never fire-and-forget DPP before mode select.

2. **DPP tier semantics:** Setting `stopAfterTier: 1` marks `preparation.status` as `ready`; Tier 2 continuation MUST use `kickoffTier2PreparationInBackground` or `hasPendingTier2Preparation`, not a bare `startDocumentPreparation` early-return.

3. **Gate predicate:** `isTier1PreparationComplete` requires inventory + `blockRecommendation.nBlocks` + `modeRecommendation`; do not gate on `preparation.status` alone.

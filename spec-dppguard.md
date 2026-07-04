# Fix: DPP Status Race Condition (Infinite Guard Loop)

## Context

From production logs (2026-07-03), during a DPP run for `docId: aa8a24c8e454`:

- `document-preparation.runDocumentPreparationPipeline` logs `Finished` with `status: 'ready'`, `errorCount: 0`, `conceptCount: 37`.
- Immediately after, `study.startDocumentPreparation` logs `Finished` with `status: 'running'` for the **same** `docId`.
- `study.enterModeSelectAfterTier1Gate` reads `prepStatus: 'running'`, `hasGateResolved: false`.
- `DPP-GUARD.evaluateConceptInventoryGuard` repeatedly returns `waiting — preparation already running`, even though `conceptCount: 37` is already correctly populated.
- `DPP-GUARD.pollUntilConceptInventoryReady` polls every 2000ms for up to `maxWaitMs: 660000` (11 minutes), with no early exit despite the data already being ready.

Confirmed by the user to be **document-agnostic** — it blocks all users from reaching mode select after DPP completes, unless they wait out the full timeout or reload. This is a critical funnel blocker: it presents as the app hanging.

This overlaps directly with two already-flagged partial items in `application-overview.md` §15(a):
- `20260629-fix-dpp-persist-race` — stale `preparation` read
- `20260629-fix-dpp-prep-ui` — "Preparing document…" persists after DPP `ready`

This spec supersedes and completes both. Remove both entries from tracking once this ships.

## Root cause hypothesis (Cursor must verify against live code before implementing)

Two independent readers of DPP status appear to exist:

1. `document-preparation.js` — owns actual pipeline execution, emits `Finished`/`ready` after the last phase completes.
2. Persisted `shared.preparation` state (via `session-store.js`) — read by `study.startDocumentPreparation` and `study.enterModeSelectAfterTier1Gate`, used by the guard as source of truth.

If (1) logs "ready" before the persisted write in (2) is committed and re-readable, any downstream read — including the guard's very first evaluation — observes stale `running`. This is a read-before-write-commit race, not necessarily a logic bug in the guard's loop itself. Given `session-store.js` is the documented single-owner write model with `runId` stale-detection already implemented (per the DPP persistence overhaul), the likely defect is one or more of:

- **(a)** the in-pipeline "Finished" log fires before the corresponding persistence write call resolves (write not awaited, or fire-and-forget)
- **(b)** `evaluateConceptInventoryGuard` reads from a cached/in-memory snapshot of `shared.preparation` taken before the gate function started, rather than issuing a fresh read on each poll tick
- **(c)** `runId` mismatch is not checked/enforced at the guard level, so a just-completed run's write isn't recognized as authoritative over an older in-flight snapshot

Cursor must trace the write path (`document-preparation.js` phase completion → `session-store.js` persistence) and the read path (`evaluateConceptInventoryGuard` → its data source) to confirm which of (a)/(b)/(c) is actually occurring before implementing R1–R3 below.

## Non-goals

- Not rewriting the DPP phase execution model.
- Not changing the `runId` stale-detection design from the DPP persistence overhaul — assumed correct; this spec addresses why the guard isn't benefiting from it.
- Not addressing document-processing quality issues (heading inference, table extraction) — covered separately in `20260703-html-structure-extraction-hardening`.

## Rules

**R1 — Guard must read fresh, not cached, status on every poll tick.**
`evaluateConceptInventoryGuard` must not rely on any snapshot of `shared.preparation` captured before the polling loop began. Each tick must re-fetch authoritative state from `session-store.js`.

**R2 — Persistence write must be confirmed (awaited) before the pipeline logs/emits a terminal `ready` status.**
If `document-preparation.js` currently logs `status: 'ready'` before its write to `session-store.js` resolves, reorder so the write is awaited first. `Finished` must only be logged after the persisted write is confirmed committed.

**R3 — `runId` must be the staleness tiebreaker, not just presence of a `status` string.**
If the guard reads a `running` status attached to an older `runId` than the one associated with the just-completed pipeline run, treat it as stale and disregard it. Verify `runId` is threaded through both the write and read paths for this specific check; if the primitive exists elsewhere but isn't wired into this guard, wire it in — do not reinvent it.

**R4 — Poll loop must have a bounded, user-visible failure path.**
`maxWaitMs: 660000` (11 min) is currently a silent ceiling with no evidence in the log of what happens on expiry. Define and implement explicit behavior: after N failed polls or `maxWaitMs`, surface an error state to `screenCreateSessionStart` status messaging rather than an indefinite spinner. Once R1–R3 remove the root cause, reduce `maxWaitMs` to a realistic ceiling (60–90s) — 11 minutes is a symptom-masking value, not a real design choice, and must not remain load-bearing.

**R5 — Idempotent re-check on mount/resume.**
If a user reloads or navigates away and back during the guard's wait, `enterModeSelectAfterTier1Gate` must re-evaluate fresh state rather than resuming a previous poll loop's assumptions.

## Implementation sequence (risk-ordered)

1. Trace and confirm root cause (a/b/c above) against live code — do not implement blind.
2. R2 (write-before-log ordering) — lowest risk; resolves root cause if (a).
3. R1 (fresh read per tick) — resolves (b); moderate risk, touches the guard's core loop.
4. R3 (runId tiebreak) — resolves (c); depends on confirming runId is already threaded through persistence.
5. R4 (bounded failure UX) — safety net regardless of root cause; ship even if R1–R3 fully resolve the race.
6. R5 (resume correctness) — polish, lowest priority.

## Testing checklist

- [ ] Upload a document; confirm DPP completes and mode select is reached with no visible wait once concept inventory is populated.
- [ ] Artificially delay the persistence write (test harness permitting) and confirm the guard no longer falls into `waiting` once the write eventually completes.
- [ ] Simulate a `runId` mismatch (superseded run) and confirm the guard does not wait on stale data.
- [ ] Confirm behavior at `maxWaitMs` expiry: user sees an actionable error, not an infinite spinner.
- [ ] Reload mid-wait; confirm the gate re-evaluates rather than resuming stale assumptions.
- [ ] Regression: confirm `20260622-fix-dpp-recalculation-guard` behavior (inventory guard in DPP T1.2) is unaffected.

## Open questions for Cursor

- Is `document-preparation.js`'s `Finished` log currently fired before or after the `session-store.js` write promise resolves? (Determines whether R2 is even needed.)
- Does `evaluateConceptInventoryGuard` take `shared.preparation` as a parameter (potentially stale/closed-over) or call into `session-store.js` fresh on each invocation?
- Is `runId` already present on both the write payload and whatever the guard reads? If not, what's the minimal plumbing to add it?
- What is the current (undocumented) behavior at `maxWaitMs` expiry — silent give-up, throw, or hung UI?

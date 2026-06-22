# Deep Dive: Fix DPP Recalculation Guard

**Date:** 2026-06-22  
**Feature:** `20260622-fix-dpp-recalculation-guard`

---

## 1. What we built

We stopped the concept inventory LLM pipeline from running three times per upload (DPP at upload, mode entry, and “Generate blocks”). A single guard layer in `session.js` decides whether existing `shared.conceptInventory` is good enough to reuse. Call sites in DPP T1.2, mode-select gate, and RSVP block generation now skip recalculation when valid, surface failures instead of silently retrying, poll while preparation is in progress, and offer a manual “Retry preparation” path via `forceRerun`.

---

## 2. Design decisions

### Central guard in `session.js` vs per-call-site checks

**Chosen:** `isConceptInventoryValid`, `evaluateConceptInventoryGuard`, and `pollUntilConceptInventoryReady` exported from `session.js`.

**Alternatives:** Duplicate `if (inventory.length)` checks in `study.js`, `document-preparation.js`, and `mode-bootstrap.js`.

**Why discarded:** Three independent heuristics already diverged (`hasConceptInventory`, `isTier1PreparationComplete`, `resolvePreparedRsvpInventory`). One function with explicit status branches prevents a fourth drift.

**Trade-off:** `session.js` grows orchestration surface area; any new inventory trigger must import the guard (documented in the call-site comment block).

### Decision enum (`skip` | `run` | `failed` | `waiting` | `degraded`) vs boolean

**Chosen:** `evaluateConceptInventoryGuard` returns a `decision` string.

**Alternatives:** Boolean `shouldRunInventory()`; throwing errors for failed state.

**Why discarded:** Boolean cannot express “failed — show UI, don’t retry” vs “waiting — poll” vs “degraded — use sparse inventory”. Throws would mix control flow with user-facing states.

**Trade-off:** Callers need a `switch`/if ladder; `study.js` duplicated some branching in `resolveInventoryForBlockFlow` and generate-blocks submit.

### Keep old inventory on `forceRerun`

**Chosen:** Reset `preparation.status` to `pending` and clear `failReason`, but do not clear `conceptInventory` until a new run succeeds.

**Alternatives:** Wipe inventory at retry start.

**Why discarded:** Wiping causes a flash of “no inventory” in UI and can trigger downstream `generate_fresh` paths mid-retry.

**Trade-off:** Stale inventory remains visible if retry fails again; guard must still treat `failed` as invalid even if array is non-empty.

### Did not widen `isTier1PreparationComplete`

**Chosen:** Guard block-generation with `isConceptInventoryValid` directly in `study.js`, leave `resolveRsvpInventoryForPack` / `isTier1PreparationComplete` unchanged.

**Alternatives:** Make tier-1 complete ≡ valid inventory.

**Why discarded:** Tier-1 also requires `blockRecommendation` and `modeRecommendation`. Conflating them would mark preparation “complete” when only inventory exists.

**Trade-off:** Two overlapping predicates remain; developers must know which to use where.

### Polling in UI layer (`study.js`) not in DPP

**Chosen:** `pollUntilConceptInventoryReady` called from mode-select gate and block flow with 3s interval.

**Alternatives:** Event bus from DPP completion; Service Worker push.

**Why discarded:** DPP already persists to session store; polling `getActiveSession()` is minimal and matches spec.

**Trade-off:** Up to 3s latency after DPP finishes; 5-minute cap then surfaces timeout message.

---

## 3. Concepts applied

| Concept | Where it appears |
|--------|------------------|
| **Guard clause / preflight validation** | `isConceptInventoryValid` short-circuits expensive LLM work at T1.2 and generate-blocks (`session.js`, `document-preparation.js`) |
| **State machine branching** | `evaluateConceptInventoryGuard` maps `preparation.status` → action (`failed`, `waiting`, `degraded`, `run`) |
| **Idempotency** | Skipping T1.2 when inventory already valid makes DPP re-entry safe (`runPhaseT12`) |
| **Optimistic UI / stale-while-revalidate** | `forceRerun` keeps old inventory during retry (`startDocumentPreparation` in `study.js`) |
| **Polling with backoff cap** | `pollUntilConceptInventoryReady` — fixed 3s interval, 300s max (`session.js`) |
| **Feature flag / threshold constants** | `MIN_CONCEPTS_ABSOLUTE`, `MIN_CHARS_PER_CONCEPT`, `minViableConcepts` from `flags.js` |
| **Structured logging for ops** | `[DPP-GUARD]` prefix on every branch (`evaluateConceptInventoryGuard`, `runPhaseT12`) |
| **Separation of orchestration vs domain** | Pure guard in `session.js`; UI wiring in `study.js` (`renderPreparationFailedUi`, retry handlers) |

---

## 4. Technical debt and improvements

**Well done**

- Pure, testable guard functions with 13 unit tests in `cursor-tests/20260622_dpp-recalculation-guard.mjs`.
- Explicit `forceRerun` bypass prevents infinite guard loops on manual retry.
- Failed preparation no longer auto-triggers API spend.

**Duct tape**

- `resolveInventoryForBlockFlow` in `study.js` re-calls `evaluateConceptInventoryGuard` for degraded detection after polling — redundant evaluation.
- `twoPhaseConceptSplit` in `session.js` still calls `runConceptInventoryWithFallback` internally; only guarded at `study.js` call sites, not inside the function itself.
- `vault/import.js` inventory path is intentionally unguarded (different user intent) but undocumented at the call site.

**Would not scale**

- Fixed 3s polling per waiting user ties UI thread to session reload; many tabs = redundant polls.
- Guard logic spread across `study.js` (~150 lines of helpers) and `session.js`; no single `DppGuardController` for all screens (Recall, Cloze, Vault).
- `isConceptInventoryValid` duplicates threshold math from `minViableConcepts` (same formula, two code paths).

---

## 5. Consolidation questions

1. **Why does `isTier1PreparationComplete` still return false when `isConceptInventoryValid` is true, and which code paths care about each?** Trace `enterModeSelectAfterTier1Gate` vs `resolveRsvpInventoryForPack` before changing either predicate.

2. **What happens if `preparation.status` is `ready` but `conceptInventory` was manually edited in DevTools to drop below `minViableConcepts`?** Walk through `evaluateConceptInventoryGuard` → `degraded` → generate-blocks branch vs T1.2 skip.

3. **Where can `runConceptInventoryWithFallback` still run without passing through `evaluateConceptInventoryGuard`?** Audit `twoPhaseConceptSplit`, Recall controller, and vault import; decide if each is intentional.

---

## 6. Suggested update for .cursorrules

1. **Any new call site that invokes `runConceptInventoryWithFallback`, `twoPhaseConceptSplit`, or DPP T1.2 must first call `evaluateConceptInventoryGuard` (or document why it is exempt, e.g. vault import).**

2. **Do not use `hasConceptInventory()` or non-empty array checks alone to skip inventory LLM calls — use `isConceptInventoryValid(session)` which includes `preparation.status` and `minViableConcepts`.**

3. **Automatic retry of `startDocumentPreparation` on `preparation.status === 'failed'` is forbidden; only user-initiated `forceRerun: true` may bypass the guard.**

# Spec: Fix DPP Recalculation Guard

**ID:** `20260622-fix-dpp-recalculation-guard`  
**Status:** Approved  
**Priority:** A — Urgent & Important (wastes API budget, breaks UX, causes cascading failures)  
**Supersedes:** none  
**Depends on:** `20260622-fix-inventory-merge-truncation` — implement that spec first. This spec reads `preparation.status === 'failed'` as a meaningful signal; that value is only correctly set after the merge fix is applied.

---

## Problem Statement

The concept inventory pipeline (`runConceptInventoryWithFallback` or equivalent in `api.js` / `session.js`) runs **three times** for a single document upload session:

1. **During DPP at upload** — correct, this is the intended trigger.
2. **When the user enters RSVP mode** — should be a no-op if inventory already exists.
3. **When the user clicks "Generate blocks"** — should be a no-op if inventory already exists.

Occurrences 2 and 3 happen because each code path independently checks whether it "has" a usable inventory, finds the current one inadequate (either because it's empty, or because the merge failed and returned 3-stub garbage), and re-triggers the full pipeline. After spec `20260622-fix-inventory-merge-truncation` is applied, the 3-stub garbage will no longer exist — but the triple-run will still occur if the inventory legitimately fails, since the code will re-attempt rather than surface the failure.

This spec adds a **single reusable guard function** and wires it into every call site that can trigger inventory generation, so re-triggering only happens when genuinely warranted, and failure states are surfaced rather than silently retried in loops.

---

## Secondary Problem: Missing "Retry Preparation" affordance

Currently, when DPP fails, there is no user-visible way to retry it other than re-uploading the document. After this spec is applied, failed preparation will be surfaced rather than silently retried — so a manual retry path must exist. This spec adds a minimal retry entry point.

---

## Rules

### R1 — Define `isConceptInventoryValid(session)` in `session.js`

Add this function and export it:

```javascript
import { MIN_CONCEPTS_ABSOLUTE, MIN_CHARS_PER_CONCEPT } from './config/flags.js';

/**
 * Returns true if session.shared.conceptInventory is populated with
 * enough concepts to be considered a valid, usable result.
 * Used as a pre-flight check before triggering any DPP inventory phase.
 *
 * @param {Object} session — full DocumentSession object
 * @returns {boolean}
 */
export function isConceptInventoryValid(session) {
  const shared = session?.shared;
  if (!shared) return false;

  const status = shared.preparation?.status;
  // Only 'ready' and 'partial' are valid terminal states from DPP.
  // 'failed', 'running', 'pending', 'legacy', undefined → not valid.
  if (status !== 'ready' && status !== 'partial') return false;

  const inventory = shared.conceptInventory;
  if (!Array.isArray(inventory) || inventory.length === 0) return false;

  const charCount = shared.docMeta?.charCount ?? 0;
  const minRequired = Math.max(
    MIN_CONCEPTS_ABSOLUTE,
    Math.floor(charCount / MIN_CHARS_PER_CONCEPT)
  );

  return inventory.length >= minRequired;
}
```

**Constants** (`MIN_CONCEPTS_ABSOLUTE = 5`, `MIN_CHARS_PER_CONCEPT = 5000`) are defined in `config/flags.js` by spec `20260622-fix-inventory-merge-truncation`. Import them here; do not redefine.

### R2 — Guard call sites: the three locations

Cursor must locate and add a guard at **all three** of the following call sites. For each: if `isConceptInventoryValid(session)` returns `true`, skip any inventory generation and log a single line. If it returns `false`, proceed to the existing logic — but see R3, R4, and R5 for how to handle specific false-return cases.

**Call site A — DPP re-trigger check in `document-preparation.js`**  
The function that starts the DPP pipeline (likely `startDocumentPreparation` or similar) must check inventory validity before re-running T1.2. If the session already has a valid inventory (e.g. DPP was already run and succeeded), only run the phases that are missing — do not restart T1.2.

**Call site B — Mode entry in `mode-bootstrap.js` / `applyModeEntry`**  
Before triggering any background DPP work when entering RSVP or Questions mode, call `isConceptInventoryValid(session)`. If true: proceed directly to mode bootstrap (block packing, placeholder screen) without touching DPP.

**Call site C — Block generation trigger in `study.js`**  
The handler for the "Generate blocks" button (search for `packInventoryToBlocks` call site in `study.js`, or the click handler for `#generateBlocksBtn` / `#rsvpGenerateBtn` — verify exact name) must check `isConceptInventoryValid(session)` before calling any inventory generation. If true: proceed directly to `packInventoryToBlocks`. If false: see R3.

### R3 — When guard returns false AND status is `'failed'`: surface error, do NOT silently retry

If `isConceptInventoryValid` returns false and `session.shared.preparation.status === 'failed'`:

- Do NOT trigger a new DPP run automatically.
- Show a user-visible error state on the current screen with the message:

  > "Document preparation failed. The concept analysis could not complete. You can retry preparation or continue with limited functionality."

- Provide a **"Retry preparation"** button that calls `startDocumentPreparation(session, { forceRerun: true })` (or equivalent). This is a user-initiated retry, not an automatic one.
- The `forceRerun: true` flag (or equivalent parameter) must bypass the `isConceptInventoryValid` guard to allow a deliberate retry. Add this parameter if it does not exist.
- This error state applies to mode entry (call site B) and block generation (call site C). For call site A (DPP itself), the failed state is already the terminal — no error UI needed there beyond what DPP already shows.

### R4 — When guard returns false AND status is `'running'` or `'pending'`: show loading, do NOT start second run

If `isConceptInventoryValid` returns false and `session.shared.preparation.status` is `'running'` or `'pending'`:

- Do NOT start a second DPP instance.
- Show a loading/waiting state: "Document preparation in progress…"
- Poll `preparation.status` every 3 seconds and re-check `isConceptInventoryValid`. When it becomes true, proceed automatically.

This handles the race condition where the user navigates to mode select before DPP has finished.

### R5 — When guard returns false AND status is `'ready'` or `'partial'` (inventory too sparse)

This case means: DPP succeeded according to its own status, but the inventory is below the minimum viable threshold (e.g. the 3-stub garbage case before spec 1 was applied, or a legitimately tiny document with fewer than 5 concepts).

If status is `'ready'`/`'partial'` but inventory count is below minimum:
- Log `[DPP-GUARD] Inventory below minimum threshold (N < minRequired). Treating as degraded.`
- Proceed with the available inventory rather than retrying — a degraded inventory is better than a retry loop.
- Do NOT show an error UI in this case.
- This is a safety net for edge cases; after spec `20260622-fix-inventory-merge-truncation` is applied, this branch should rarely trigger.

### R6 — Add `[DPP-GUARD]` console logs at every decision point

Every guard evaluation must produce one of these log lines (at `console.log` level):

```
[DPP-GUARD] isConceptInventoryValid → TRUE (N concepts, charCount C). Skipping recalculation.
[DPP-GUARD] isConceptInventoryValid → FALSE. Status: {status}, inventory: {length} concepts.
[DPP-GUARD] Skipping DPP re-trigger: already running.
[DPP-GUARD] Status 'failed' — surfacing error state. Not auto-retrying.
[DPP-GUARD] Force rerun requested — bypassing guard.
```

These logs are essential for debugging production issues without having to reproduce them locally.

### R7 — `forceRerun` must clear failed state before re-running

When `startDocumentPreparation` is called with `forceRerun: true`:

```javascript
session.shared.preparation.status = 'pending';
session.shared.preparation.failReason = null;
// Do NOT clear conceptInventory here — keep old inventory until new one is validated
await saveSession(session);
// Then begin DPP T1.2 normally
```

Do not clear the existing `conceptInventory` at the start of a forced rerun. Only replace it once the new run produces a result with `length >= minViableConcepts(charCount)`. This prevents a flash of "no inventory" state during retry.

### R8 — Verify call sites exhaustively

**Cursor:** after implementing the guard, search the entire `src/js/` directory for all occurrences of the following identifiers and verify each one is either (a) covered by one of the three call sites above, or (b) an internal call that is already downstream of a guard:

- `runConceptInventoryWithFallback`
- `startDocumentPreparation`
- `packInventoryToBlocks`
- Any function name that contains both `inventory` and (`run` or `generate` or `start`)

If any uncovered call site is found, add the guard there and add it to the list of "Call sites patched" in a comment block at the top of `session.js`.

---

## Non-Goals

- Do NOT refactor DPP phases into a queue/scheduler system — that is a larger architectural change.
- Do NOT change what DPP phases do — only when they are allowed to run.
- Do NOT add persistent retry state across page reloads — a `forceRerun` triggered in session is sufficient.
- Do NOT change the `preparation.status` state machine beyond what is described here.
- Do NOT add the "Retry preparation" button to any screen other than mode select and the block generation screen.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/js/session.js` | Add and export `isConceptInventoryValid`; add guard at `packInventoryToBlocks` call site |
| `src/js/mode-bootstrap.js` | Add guard at mode entry (call site B) |
| `src/js/study.js` | Add guard at block generation trigger (call site C); add error UI for `'failed'` state |
| `src/js/document-preparation.js` | Add `forceRerun` parameter support; clear failed state on force rerun (R7) |
| `src/js/config/flags.js` | Already modified by spec `20260622-fix-inventory-merge-truncation` — no new changes here unless constants are missing |

---

## Implementation Sequence (risk order)

1. Add `isConceptInventoryValid` to `session.js` — pure function, no side effects, can be added and exported without breaking anything.
2. Add `[DPP-GUARD]` logs at all three call sites without yet changing behavior (log-only mode). Deploy and test: verify the logs show the guard would have triggered correctly.
3. Activate the guard at call site A (DPP re-trigger in `document-preparation.js`) — lowest risk, affects background process.
4. Activate the guard at call site B (mode entry in `mode-bootstrap.js`).
5. Activate the guard at call site C (block generation in `study.js`).
6. Add `forceRerun` support and "Retry preparation" button UI.
7. Add R4 polling for `'running'`/`'pending'` state.
8. Run exhaustive call site search (R8).

---

## Testing Checklist

- [ ] Upload a document, wait for DPP to complete (status `'ready'`). Navigate to RSVP. Verify that `[DPP-GUARD] isConceptInventoryValid → TRUE` appears in the console and no new "Inventariando…" / merge-related logs appear.
- [ ] From RSVP, click "Generate blocks". Verify same: `TRUE` log, no re-calculation.
- [ ] Count total calls to `api.deepseek.com` during a complete upload + mode entry + generate-blocks flow. Calls related to inventory generation must appear **only** during the initial DPP window after upload.
- [ ] Simulate `preparation.status = 'failed'` by manually setting it in DevTools after upload. Navigate to RSVP mode. Verify: error state appears with "Retry preparation" button. No automatic retry fires. No loop.
- [ ] Click "Retry preparation". Verify DPP re-runs and `forceRerun: true` bypasses the guard. Verify console shows `[DPP-GUARD] Force rerun requested — bypassing guard.`
- [ ] Simulate DPP in-progress: set `preparation.status = 'running'` in DevTools, then navigate to mode select. Verify loading state appears. Change status to `'ready'` and add a valid inventory in DevTools. Verify the polling picks it up and proceeds automatically (within ~3 seconds).
- [ ] Upload a short document (< 1 page, < 2,000 chars). Verify `isConceptInventoryValid` uses the absolute floor of 5 correctly and does not require 10+ concepts for this document size.

---

## Open Questions for Cursor

1. What is the exact name of the function in `session.js` that triggers `runConceptInventoryWithFallback`? Is it called directly from `study.js` and `mode-bootstrap.js`, or through an intermediary? The answer determines exactly where the guard must sit.
2. Does `startDocumentPreparation` already have a parameter object it accepts, or is it called with just `(session)`? Verify before adding `forceRerun`.
3. Is there a DPP status indicator visible to the user currently when `preparation.status === 'failed'`? If yes, the "Retry preparation" button should be added to that existing element rather than creating a new one.

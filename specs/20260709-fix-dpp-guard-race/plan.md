# Implementation Plan: Fix DPP Guard Status Race

**Branch**: `20260709-fix-dpp-guard-race` | **Date**: 2026-07-09 | **Spec**: [spec.md](./spec.md)

## Summary

Fix infinite DPP guard wait by aligning tier-1 gate bypass with `hasTier1GateArtifacts` (not full `hasTier1Artifacts`), ensuring fresh session reload on poll/gate entry, tightening poll timeout to 90s, and promoting stuck `running` status when gate artifacts are present.

## Technical Context

| Item | Detail |
|------|--------|
| Root cause | Guard bypass requires `modeRecommendation`; tier-1 upload stops before T1.5 |
| Files | `session.js`, `study.js`, `session-types.js` (read-only) |
| Tests | `cursor-tests/20260709_fix-dpp-guard-race.mjs` |
| SW bump | Required (JS change) |

## Constitution Check

- Minimal diff; English logs; no new UI screens; user-visible error reuses existing prep-failed UI.
- Passes post-design.

## Implementation Phases

### Phase A — Guard artifact alignment (FR-006, FR-007)

1. Import `hasTier1GateArtifacts` in `session.js`.
2. Replace `hasTier1Artifacts` with `hasTier1GateArtifacts` in guard bypass and `repairStuckRunningPreparationIfNeeded`.

### Phase B — Fresh read + runId (FR-001, FR-003, FR-005)

1. Add `reloadSessionForGuard(docId)`.
2. Wire `pollUntilConceptInventoryReady` default reload and `enterModeSelectAfterTier1Gate` to use it.
3. In guard `running` branch: if gate artifacts + !inFlight, return `skip` before generic wait.

### Phase C — Timeout UX (FR-004)

1. Add `DPP_GUARD_POLL_MAX_MS = 90_000`.
2. Use as default `maxWaitMs` in poll.
3. Ensure timeout path in `enterModeSelectAfterTier1Gate` shows actionable message.

### Phase D — Tests + tracking

1. New cursor-test covering running + gate artifacts → skip.
2. Remove superseded entries from `application-overview.md`.

## Project Structure

```text
src/js/session.js          # guard, poll, repair, reload helper
src/js/study.js            # gate entry fresh reload
cursor-tests/20260709_fix-dpp-guard-race.mjs
```

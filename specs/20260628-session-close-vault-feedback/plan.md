# Implementation Plan: Session Close Vault Feedback

**Feature**: `specs/20260628-session-close-vault-feedback`  
**Date**: 2026-06-28

## Summary

Add a read-only vault summary panel to `screenRetrievalHub` after exposure-complete sessions. Pure computation in `session-vault-summary.js`; vault-store re-exports read API; study.js wires async render.

## Technical Context

| Item | Detail |
|------|--------|
| Hub entry | `enterRetrievalHub()` in `study.js`; `retrievalHubContext.entrySource` |
| Data | `collectObservations`, `loadVault`, concept inventory titles |
| UI | `#retrievalHubVaultSummary` in `index.html`; CSS in `main.css` |
| Gate | Read-only; English UI; Focus Mode styling |

## Implementation

1. **`session-vault-summary.js`**: `resolveStudyVisitStartedAt`, `buildSessionVaultSummary`, `renderVaultSummaryHtml`, `getVaultConceptIdsForDoc`.
2. **`vault-store.js`**: Export `getSessionVaultChanges` wrapper.
3. **`index.html` + `ui.js`**: Panel slot + ref.
4. **`study.js`**: `renderRetrievalHubVaultSummary` on hub entry when `exposure_complete`.
5. **`main.css`**: `.retrieval-hub-vault-summary` panel styles.
6. **Tests**: `cursor-tests/20260628_session-close-vault-feedback.mjs`
7. **SW bump**: `20260628_04`

## Constitution Check

All gates pass: minimal UI, no LLM, read-only vault access, English copy.

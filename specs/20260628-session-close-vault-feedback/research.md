# Research: Session Close Vault Feedback

## Decision: Vault storage layer

**Decision**: Read vault via `loadVault()` in `vault-store.js` (localStorage).  
**Rationale**: File header and implementation confirm local persistence; no Supabase entry CRUD.  
**Alternatives**: Raw Supabase query — rejected (not how vault works today).

## Decision: Session boundary (Option B)

**Decision**: `resolveStudyVisitStartedAt(session, modeSlices)` — minimum `answered_at`, assessment signal `lastAt`, and pending observation timestamps across mode slices.  
**Rationale**: No `sessionId` on vault observations; no existing visit-start field; spec forbids new write paths for tracking (R5).  
**Alternatives**: Option A (sessionId tagging) — not present; Option C (in-memory) — fallback only if timestamps unavailable.

## Decision: Added vs reinforced classification

**Decision**: Snapshot vault sources for doc before classifying `collectObservations` positive signals in the visit window.  
**Rationale**: Mirrors `filterNewConcepts` / session-close semantics without running writes.  
**Alternatives**: Diff vault before/after session-close — would require write timing coordination.

## Decision: Async non-blocking render

**Decision**: Hub shows immediately; summary panel slot empty until async computation completes.  
**Rationale**: FR-009 / R7; vault read is sync but observation collection loads mode slices async.

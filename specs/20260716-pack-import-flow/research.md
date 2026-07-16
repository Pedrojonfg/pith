# Research: Pack Import Flow

## R1 — Share code format and assignment timing

**Decision**: 8-char codes from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `0/O/1/I/L`). Generate in `generatePackCode()`, assign inside `finalizePack` after status→published (immutability trigger already allows `code`-only updates). Retry on unique violation (≤8 attempts). Normalize lookup input with `trim().toUpperCase()`.

**Rationale**: Collision space ~31^8 is ample for demo scale; assignment at finalize keeps publish atomic from the publisher’s view.

**Alternatives**: Separate `assignPackCode` RPC; 6-char codes; client-only assignment after alert — rejected (extra round-trips / weaker UX).

## R2 — docId for imported sessions

**Decision**: Explicit `docId = "pack-" + packIdWithoutHyphens.slice(0,8) + "-" + Date.now().toString(36)` passed to session create/persist. Never `computeDocId(rawMarkdown)`.

**Rationale**: Content-hash would collide with the creator’s session when source is included.

**Alternatives**: UUID-only; hash(packCode+userId+ts) — acceptable but less readable in debugging.

## R3 — Attribution storage

**Decision**: Extend `uploadMeta` with `originalFormat: "pack"`, `sourcePackId`, `sourcePackOwnerName`, optional `sourcePackTitle`; extend `setUploadMeta` whitelist. Library list remains title-based (no regression).

**Rationale**: Spec Open Q2; library ignores `uploadMeta` today.

**Alternatives**: New `shared.packAttribution` — more schema churn for no UI benefit.

## R4 — T1.6 isolation

**Decision**: Export `runVaultLinkPhase(doc)` wrapping existing `runPhaseT16`. On import, strip `globalConceptId` from cloned inventory entries before linking so IDs bind to the importer’s registry. Do **not** call `runPostCacheUserPhases` (requires `blockRecommendation` + tier-1 gate; pack snapshot does not include `blockRecommendation`).

**Rationale**: Spec Open Q3; T1.8/T1.9 are embeddings/dedup and must not be forced on import.

**Alternatives**: Fake `blockRecommendation` to unlock post-cache path — rejected as brittle.

## R5 — Cloze / mode slice clone

**Decision**: Deep-clone `modes.cloze` (and other mode slices) as published. Cloze `pipelineStatus` is a status string; runtime uses live `doc.docId` from the session, not embedded creator ids in the slice for study entry. No rewrite required unless a future fixture shows embedded creator `docId` fields — then strip those keys if present.

**Rationale**: Spec Open Q4; pipeline persist helpers write using current session id.

## R6 — Creator display name without profiles table

**Decision**: Add nullable `owner_display_name text` on `shared_packs`; set in `createPackDraft` from `user.user_metadata.full_name || email local-part || "Pack creator"`. Import preview reads it from RPC row. Extend published immutability trigger to freeze this column after publish.

**Rationale**: No `profiles` table in repo; UUID alone is a poor UX.

**Alternatives**: Always show “Pack creator” — weaker SC for preview; admin API — not available client-side.

## R7 — UI placement

**Decision**: Additive branch under existing “or” divider on `#screenCreateSessionStart`: toggle/section “Use pack code” with input + Import; preview card (title + creator) + Confirm. Do not alter file-staging handlers.

**Rationale**: Spec §4 / FR-003 / FR-005.

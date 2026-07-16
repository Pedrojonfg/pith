# Contract: Pack Import

## `generatePackCode(): string`

Returns an 8-character code from the safe alphabet. Pure (no I/O).

## `finalizePack(packDraftId, includeSourceDocument, deps?) → { id, code, title, ... }`

After successful publish UPDATE, assigns unique `code` (retry on collision) and returns the published row including `code` and `owner_display_name`.

## `lookupPublishedPackByCode(code, deps?) → PackRow | null`

Client wrapper: `supabase.rpc('lookup_shared_pack_by_code', { p_code: normalizePackCode(code) })`. Returns null when empty.

## `importPackAsSession(packCode, importingUserId, projectId, deps?) → DocumentSession`

1. Lookup published pack; throw user-facing invalid-code error if missing.
2. Build new session with new `docId`, `projectId`, cloned snapshot → shared/modes.
3. Set `uploadMeta` pack attribution; strip inventory `globalConceptId`.
4. Persist via session-store.
5. `await runVaultLinkPhase(session)` then re-persist if mutated.
6. Must not call inventory/block/question LLM APIs.

## `runVaultLinkPhase(doc) → doc`

Exported DPP helper: same behavior as internal T1.6 (`resolveGlobalConcept` + `backfillGlobalConceptIds` with `persist: false` per entry).

## UI contracts

- Publish success: show code + Copy (not only `alert("Pack published.")`).
- Create-session: additive pack-code branch; invalid code → “Invalid pack code”; preview shows title + creator name before confirm.

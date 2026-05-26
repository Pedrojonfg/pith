# Contract: Prefetch Ready → Session Write-Through & Dictionary

**Feature**: `20260527-zero-latency-blocks`  
**Covers**: FR-009, FR-009a, FR-010, FR-010a, FR-012

## Trigger

When `triggerPrefetch(idx, cfg)` resolves successfully:

```text
prefetchState.status = "ready"
prefetchState.data = BlockJson
```

**Before** returning control to UI consumers, call `applyPrefetchReadySideEffects(idx, data, cfg)`.

## `applyPrefetchReadySideEffects(blockIndex, data, cfg)`

### 1. Write-through block (FR-010)

```javascript
// Pseudocode — session.js
state.activeSession.blocks[idx] = normalizeBlockJson(data, cfg);
storeActiveSession(state.activeSession, { bumpRev: true });
```

- Do **not** clear `prefetchState` (slot stays `ready` until `getPrefetchedBlock` consumes).
- `getPrefetchedBlock` may return the same object; `persistNextBlock` in transition is idempotent.

### 2. Dictionary — per-block store (FR-009, FR-012)

**Storage key**: `session_concepts_by_block` (JSON object: `{ "0": Concept[], "1": Concept[] }`).

| Step | Action |
|------|--------|
| On ready / regen for `idx` | `conceptsByBlock[String(idx)] = normalizeConcepts(data.concepts)` |
| Aggregate for UI/export | `mergeAllBlockConcepts(conceptsByBlock)` ∪ legacy `session_concepts` (dedup) |
| On block finish | `commitSessionConceptsForBlock(idx)` still runs (idempotent merge into aggregate) |

**Replace semantics (FR-012)**: Updating `conceptsByBlock[idx]` replaces that block's contribution; other indices unchanged.

### 3. UI callback (FR-009)

Optional hook registered from `study.js`:

```javascript
onPrefetchReady?.({ blockIndex: idx });
```

Must call:

- `updateDictionaryButtonVisibility()`
- If transition overlay open: re-render collapsed dictionary with `getSortedSessionConcepts()`

## `ensureBlockGenerated(idx)` (FR-010a)

```text
if hasGeneratedBlockContent(session.blocks[idx]):
  return session.blocks[idx]   // includes write-through
else:
  generate via API (existing path)
```

`hasGeneratedBlockContent`: non-empty `explanation` OR non-empty `questions` array.

## Regen / Adjust / invalidate

Any path that writes a new `BlockJson` to `session.blocks[idx]` MUST call the same dictionary update as prefetch ready (set `conceptsByBlock[idx]` from new `concepts`).

## Errors

- Write-through failure (storage quota): log + continue; prefetch slot still `ready` in memory.
- Empty `concepts`: still write-through block; clear `conceptsByBlock[idx]` to `[]`.

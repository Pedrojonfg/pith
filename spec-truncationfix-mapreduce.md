# Spec: Concept Inventory Truncation Fix + Map-Reduce

**Date**: 2026-06-16  
**Status**: Proposed  
**Deep-dive source**: `deep-dives/2026-06-16_concept-inventory-truncation.md`  
**Priority**: P0 — blocking bug on main user flow (pre-packing ON, default config)

---

## 1. Problem

`deepSeekConceptInventory` (Phase 1 of the two-phase split pipeline) makes LLM calls
without an explicit `max_tokens` budget. For dense documents (philosophy, long academic PDFs)
with high concept targets (up to 120 concepts × ~200 tokens/concept = ~24 000 output tokens),
the LLM response is silently truncated mid-JSON. Every parse attempt fails. The user sees a
blocking error with no recovery path on the default flow (`ASSESSMENT_BEFORE_PACKING: true`).

Phase 2 (`deepSeekPackConceptsToBlocks`) has had three layers of protection since 2026-06-11
(`CONCEPT_PACK_MAX_TOKENS`, truncation detection, terse retry, deterministic fallback). Phase 1
has none. This spec closes that asymmetry and introduces map-reduce as the permanent structural
solution for documents above the 8 000-word threshold.

---

## 2. Supersedes / Updates

| Artefact | Change |
|----------|--------|
| `specs/20260526-block-split-dedup/contracts/two-phase-split-api.md` | Add `max_tokens` contract for Phase 1; document truncation vs. schema error distinction; document unified fallback requirement across all routes |
| `twoPassInventory` lever (`pipeline-levers.js`) | **Removed entirely** — dead code (see §3). Map-reduce in this spec supersedes its intent |
| `deepSeekConceptInventoryPhase2` in `api.js` (if exists as separate function) | **Removed** — subsumed by map-reduce merge pass |
| `deep-dives/2026-06-16_concept-inventory-truncation.md` | This spec is the resolution of all open questions in that document |

---

## 3. Dead Code Removal

The following must be deleted, not commented out:

### 3.1 `twoPassInventory` lever

**Where**: `src/js/pipeline-levers.js`, and all callers.

`twoPassInventory` was designed to run a second inventory pass over document sections when
the first pass produced fewer concepts than 80% of the target. It was never wired correctly:
the branch condition checks `docHierarchy?.tree?.length`, but no caller to `runConceptInventory`
ever passed `docHierarchy`. The flag has been `true` by default with the branch never executing.

**Delete**:
- The `twoPassInventory` key from the levers object and its default value.
- The branch in `runConceptInventory` (or wherever in `session.js` / `api.js`) that checks
  `if (levers.twoPassInventory && docHierarchy?.tree?.length …)`.
- Any related prompt construction code for the second pass.
- Any reference to `twoPassInventory` in specs, comments, or tests.

### 3.2 Debug telemetry (`fetch` to `127.0.0.1:7501`)

**Where**: `src/js/study.js` and/or `src/js/ui.js` (`#region agent log`).

These `fetch` calls to a local ingest server that does not exist in production generate console
noise on every session and have been misread as related to inventory failures. Delete all of them
before merging this fix. No replacement — if telemetry is reintroduced it must be opt-in and
gated behind a debug flag.

---

## 4. Layer 1 — Immediate Fix

Applies to the **single-pass path** (documents ≤ 8 000 words) and to **each per-chunk call**
in the map-reduce path (§5). Must be implemented first; map-reduce builds on top.

### 4.1 New constants in `api.js`

```js
// Phase 1 single-pass: covers ≤8 000 word docs (target ≤54 concepts × ~200 tok = ~10 800 tok)
const CONCEPT_INVENTORY_MAX_TOKENS = 12288;

// Phase 1 map-reduce: per-chunk calls (~3 500 words → ~22 concepts × ~200 tok = ~4 400 tok)
const CONCEPT_INVENTORY_CHUNK_MAX_TOKENS = 6144;

// Phase 1 map-reduce: merge pass (output ≤ combined partials; consolidation reduces size)
const CONCEPT_INVENTORY_MERGE_MAX_TOKENS = 8192;
```

Each constant must have a comment explaining the sizing rationale (target concept count ×
tokens/concept) so future feature additions prompt reconsideration.

### 4.2 Pass `max_tokens` on all attempts

In `deepSeekConceptInventory`, every call to `callLlmSplit` (all three existing attempts —
full, compact, compact without `json_object` mode) must pass `max_tokens: CONCEPT_INVENTORY_MAX_TOKENS`.
No attempt may omit it.

### 4.3 Truncation detection

Before throwing on parse failure, call `looksLikeTruncatedModelJson(lastRaw)` (already exists
in `api.js` for the pack path). If it returns `true`, throw a typed error:

```js
const err = new Error('concept_inventory_truncated');
err.code = 'CONCEPT_INVENTORY_TRUNCATED';
err.raw = lastRaw;
throw err;
```

If it returns `false` (genuine schema/parse error), throw the existing generic error unchanged.
Callers must distinguish these two codes (see §6).

### 4.4 Fourth attempt — terse mode

Add a 4th retry attempt in `deepSeekConceptInventory` before throwing. This attempt:

- Uses a stripped-down system prompt: instruct the model to return **only** `id`, `order`,
  `title`, `scope_one_line` per concept — no `source_phrase`, no `anchor_type`, no `module`,
  no `concept_type`, no `prerequisite_ids`.
- Uses `max_tokens: CONCEPT_INVENTORY_MAX_TOKENS` (same as other attempts).
- On success, marks the result with `inventoryMode: 'terse'` at the array level (e.g., a
  wrapper object `{ items: ConceptInventoryItem[], inventoryMode: 'terse' }`).

**Downstream impact of terse mode**: source fidelity Phase B (`fidelity-validation.js`) relies
on `source_phrase` and `anchor_type` for anchor validation. When `inventoryMode === 'terse'`,
skip anchor validation for this document — log a warning but do not fail. The user already
received a message (§6) explaining the quality trade-off.

### 4.5 Unified fallback across all routes

Currently, only the `twoPhaseConceptSplit` code path (pre-packing OFF, no assessment) has a
fallback to `deepSeekSplitIntoBlocks` (mono-phase). The following routes have no fallback:

| Route | Entry point | Gap |
|-------|-------------|-----|
| Generate blocks, pre-packing ON (default) | `runConceptInventory` direct | ❌ |
| Recommend blocks | `runConceptInventory` | ❌ |
| Ingest-only vault | `runIngestOnlyPipeline → runConceptInventory` | ❌ |
| Recall / hub bootstrap | `runConceptInventoryForDoc` | ❌ |

**Required**: extract the fallback logic from `twoPhaseConceptSplit` into a shared helper
`runConceptInventoryWithFallback(materialText, splitOpts, docHierarchy?)`. All routes above
must call this helper instead of `runConceptInventory` directly.

Fallback cascade inside `runConceptInventoryWithFallback`:
1. Call `runConceptInventory` (with map-reduce if applicable, see §5).
2. If `CONCEPT_INVENTORY_TRUNCATED` after all 4 attempts → surface user message (§6.1), then
   attempt `deepSeekSplitIntoBlocks` (mono-phase), flag result as `pipeline: 'fallback_mono'`.
3. If any other error → surface generic message (§6.2), same mono-phase fallback.
4. If mono-phase also fails → throw to caller; no silent swallow.

**Special case — pre-packing assessment ON**: when `ASSESSMENT_BEFORE_PACKING: true`, the
assessment runs on the inventory result. If the inventory fell back to mono-phase
(`pipeline: 'fallback_mono'`), skip the pre-packing assessment entirely (the mono-phase result
does not produce `ConceptInventoryItem[]` with the schema the assessment expects). Log a console
warning and proceed directly to packing. Do not show an assessment screen on an incomplete
inventory.

---

## 5. Layer 2 — Map-Reduce Inventory

Activated when `wordCount > 8000` AND `docHierarchy.tree` is available and non-empty.
When either condition is false, falls through to the Layer 1 single-pass path.

### 5.1 Dependency: `docHierarchy` availability

Map-reduce requires `docHierarchy.tree` before starting. Callers of
`runConceptInventoryWithFallback` that may supply `docHierarchy` must:

- Pass it as the third argument (already in the proposed signature above).
- If `wordCount > 8000` but `docHierarchy` is not yet available (still computing), await it
  before calling — do not start map-reduce without the hierarchy.
- If `docHierarchy` computation failed, fall through to single-pass with `CONCEPT_INVENTORY_MAX_TOKENS`.

No caller should pass `docHierarchy` to the single-pass path for the purpose of map-reduce
triggering — the `wordCount` gate handles that.

### 5.2 Chunk building — `buildInventoryChunks(docHierarchy, rawMarkdown)`

New pure function in `api.js` (or a co-located utility). Returns `InventoryChunk[]`:

```ts
interface InventoryChunk {
  label: string;          // e.g. "Chapter 1 — Empirismo" (for LLM context + merge pass)
  text: string;           // extracted markdown for this chunk
  wordCount: number;
}
```

Algorithm:

```
TARGET_CHUNK_WORDS = 3500
MAX_PARALLEL_CALLS = 8

chunks = []
pending = { sections: [], wordCount: 0 }

for each topLevelSection S in docHierarchy.tree:
  sectionText = extractSectionText(S, rawMarkdown)
  sectionWords = countWords(sectionText)

  if sectionWords > TARGET_CHUNK_WORDS * 2:
    // Section is individually too long — flush pending, then split by children
    if pending.sections.length > 0: flush pending → chunks
    for each child C of S:
      childText = extractSectionText(C, rawMarkdown)
      chunks.push({ label: S.title + ' / ' + C.title, text: childText, wordCount: countWords(childText) })
  else if pending.wordCount + sectionWords > TARGET_CHUNK_WORDS AND pending.sections.length > 0:
    flush pending → chunks
    pending = { sections: [S], wordCount: sectionWords }
  else:
    pending.sections.push(S)
    pending.wordCount += sectionWords

if pending.sections.length > 0: flush pending → chunks

// Safety: if chunking produced only 1 chunk, fall through to single-pass
if chunks.length < 2: return null  // caller interprets null as "use single-pass"
```

`flush`: combine section texts in order; label = first section title + (if >1 section) " + N more".

If `chunks.length > MAX_PARALLEL_CALLS`: group excess chunks sequentially in batches of
`MAX_PARALLEL_CALLS` to avoid rate-limiting. Log a warning.

### 5.3 Per-chunk calls — `deepSeekConceptInventoryChunk(chunk, splitOpts)`

Identical to `deepSeekConceptInventory` with these differences:
- Uses `CONCEPT_INVENTORY_CHUNK_MAX_TOKENS` instead of `CONCEPT_INVENTORY_MAX_TOKENS`.
- Concept target per chunk: `Math.ceil(globalTarget * (chunk.wordCount / totalWordCount))`.
  Minimum 5 concepts per chunk regardless of word proportion.
- System prompt includes the chunk label so the LLM understands it is seeing a section, not
  the full document. Instruct it to still extract `prerequisite_ids` within-chunk (cross-chunk
  prerequisites are resolved in the merge pass).
- Same 4-attempt cascade (full → compact → compact no json_object → terse) with truncation
  detection. If all 4 attempts fail for a chunk, do not abort the whole inventory — continue
  with remaining chunks and flag this chunk as `failed` in the results. The merge pass must
  handle partial chunk results gracefully.

Chunks are dispatched in parallel (Promise.allSettled, not Promise.all — one chunk failure
must not abort others).

### 5.4 Merge pass — `deepSeekMergeConceptInventories(partials, splitOpts)`

Single LLM call. Input serializes all successful partial inventories as a JSON array, labelled
by chunk. The prompt instructs the model to:

1. **Deduplicate**: concepts that appear under different names across chunks but represent the
   same idea must be merged into one entry. Use the most specific `title` and `source_phrase`.
2. **Assign final IDs**: re-number as `c1`, `c2`, … in document order (by first appearance chunk).
3. **Resolve cross-chunk `prerequisite_ids`**: if concept A (chunk 1) is a prerequisite of
   concept B (chunk 3), the merge pass must express this in the final `prerequisite_ids` using
   the new final IDs.
4. **Set `module`**: use the chunk label as the `module` value for concepts originating in that
   chunk. For merged cross-chunk concepts, use the chunk of first appearance.
5. **Preserve all fields**: `concept_type`, `anchor_type`, `source_phrase` from the richest
   partial entry for each concept.

`max_tokens: CONCEPT_INVENTORY_MERGE_MAX_TOKENS`.

Same parse/retry logic as single-pass (3 attempts + terse). If merge fails completely:
fall through to mono-phase fallback via `runConceptInventoryWithFallback`'s cascade (§4.5).

### 5.5 Map-reduce result contract

`runConceptInventoryWithFallback` must attach provenance to the result:

```js
{
  items: ConceptInventoryItem[],
  inventoryMode: 'full' | 'terse' | 'map_reduce' | 'map_reduce_terse' | 'fallback_mono',
  chunkCount?: number,          // map_reduce only
  failedChunks?: string[],      // chunk labels that failed, map_reduce only
}
```

`shared.conceptInventory` stores the `items` array as before. The `inventoryMode` and
provenance fields are stored in `modes.rsvp._meta` (or the relevant mode slice) for
debugging and downstream conditional logic.

---

## 6. User-Facing Error Messages

All messages must be in the document's study language (already resolved via `{language}` in
prompt context — apply same pattern here). The strings below are the English originals.

### 6.1 Truncation (after all 4 attempts, including terse)

> **The document is too long to process in one pass.**
> The model ran out of space before finishing the concept list.
> Try studying a shorter section, or use the document hierarchy to select a chapter.
> *(If map-reduce was already active: "Concept inventory partially recovered — some sections
> could not be processed. Results may be incomplete.")*

Show as a dismissable banner, not a blocking modal. The user must still be able to fall through
to mono-phase or cancel.

### 6.2 Schema/parse error (not truncation)

Keep the existing generic message unchanged:
> **Model returned concept inventory JSON we could not parse. Please try generating blocks again.**

### 6.3 Fallback to mono-phase

If the app silently fell back to `pipeline: 'fallback_mono'`:

> **Concept inventory could not be generated. Using a simplified block split instead.**
> Concept-level features (assessment, vault tagging) will not be available for this session.

This must be shown — never swallowed silently.

---

## 7. Changes by File

| File | Change |
|------|--------|
| `src/js/api.js` | Add `CONCEPT_INVENTORY_MAX_TOKENS`, `CONCEPT_INVENTORY_CHUNK_MAX_TOKENS`, `CONCEPT_INVENTORY_MERGE_MAX_TOKENS`; update `deepSeekConceptInventory` to pass `max_tokens` on all attempts; add 4th terse attempt; add truncation-typed throw; add `buildInventoryChunks`; add `deepSeekConceptInventoryChunk`; add `deepSeekMergeConceptInventories` |
| `src/js/session.js` | Add `runConceptInventoryWithFallback`; update `runConceptInventory` to call it (or inline the new logic); remove `twoPassInventory` branch entirely |
| `src/js/pipeline-levers.js` | Delete `twoPassInventory` key and default value |
| `src/js/study.js` | Route all callers (`recommend`, `ingest`, pre-packing ON) through `runConceptInventoryWithFallback`; delete `fetch` calls to `127.0.0.1:7501` |
| `src/js/ui.js` | Delete `fetch` calls to `127.0.0.1:7501` (if present); add banner rendering for §6 messages |
| `src/js/fidelity-validation.js` | Skip anchor validation when `inventoryMode === 'terse'`; log warning |

---

## 8. `.cursorrules` Additions

Add the following rules:

1. Every LLM call that expects a JSON response larger than ~20 fields **must** declare an explicit
   `max_tokens` constant — named, with a comment stating the sizing rationale (expected item count
   × tokens-per-item). Omitting `max_tokens` is a bug, not an omission.

2. Post-LLM parse failures must distinguish three categories in their error path:
   - `TRUNCATED` — `looksLikeTruncatedModelJson` returned true
   - `PARSE_ERROR` — `JSON.parse` threw on non-truncated output
   - `SCHEMA_ERROR` — parsed but failed business validation
   Each category must produce a distinct user message and may have a distinct recovery path.

3. Any fallback path documented in a spec or contract must be implemented in **every** call site
   that can reach that failure, not only in the original call site. Fallback parity is a contract
   requirement. New entry points to a pipeline phase inherit its fallback by default.

---

## 9. Tests — `cursor-tests/20260616_inventory-truncation-map-reduce.mjs`

Mirror the structure of `cursor-tests/20260611_concept-pack-truncation-fix.mjs`.

### Required test cases

| ID | What is tested |
|----|----------------|
| T01 | `looksLikeTruncatedModelJson` with the exact fragment from the bug report (cuts off in `"source_phrase": "Locke llega…`) → `true` |
| T02 | `looksLikeTruncatedModelJson` with a short, genuinely invalid JSON → `false` |
| T03 | `api.js` exports `CONCEPT_INVENTORY_MAX_TOKENS` (number > 8192) |
| T04 | `api.js` exports `CONCEPT_INVENTORY_CHUNK_MAX_TOKENS` and `CONCEPT_INVENTORY_MERGE_MAX_TOKENS` |
| T05 | `parseConceptInventoryFromModelResponse` with complete valid JSON (including `c1` from bug log) → returns array with correct fields |
| T06 | `buildInventoryChunks` with a mock `docHierarchy` of 6 sections (500/800/1200/2000/3000/4000 words) → produces ≥2 chunks, no chunk exceeds `TARGET_CHUNK_WORDS * 1.5` |
| T07 | `buildInventoryChunks` with a single section of 500 words → returns `null` (single-pass fallback) |
| T08 | `pipeline-levers.js` does not export or reference `twoPassInventory` |
| T09 | `session.js` does not contain the string `twoPassInventory` |
| T10 | `study.js` does not contain `127.0.0.1` or `:7501` |

---

## 10. Phasing

### Phase A (implement first — fixes the live bug)

- §4.1 Constants
- §4.2 Pass `max_tokens`
- §4.3 Truncation detection
- §4.4 Terse attempt
- §4.5 Unified fallback
- §6 User messages
- §3.2 Delete `:7501` telemetry
- Tests T01–T05, T08–T10

### Phase B (implement second — permanent structural fix)

- §5.1–5.5 Map-reduce full implementation
- §3.1 Delete `twoPassInventory`
- §7 `fidelity-validation.js` terse mode skip
- Tests T06–T07

Phase A can be merged and deployed independently. Phase B requires `docHierarchy` to be
reliably available at the point `runConceptInventoryWithFallback` is called — verify this
wiring before shipping Phase B.

---

## 11. Open Questions (non-blocking for Phase A)

1. **Terse + assessment**: if the inventory returned `inventoryMode: 'terse'` (no `concept_type`,
   no `prerequisite_ids`), the pre-packing assessment quiz can still run (it only needs `title`
   and `scope_one_line`). Confirm whether assessment quality degrades acceptably without
   `concept_type` to classify question difficulty.

2. **Chunk parallelism + rate limits**: DeepSeek and Gemini have different rate limit profiles.
   `MAX_PARALLEL_CALLS = 8` is a conservative default. Consider making this configurable in
   `pipeline-levers.js` under a new `inventoryMaxParallelChunks` lever (non-breaking addition,
   not dead code — this one would actually be wired from day one).

3. **Map-reduce + vault ingest**: `runIngestOnlyPipeline` calls `runConceptInventory` for vault
   tagging. Long documents ingested in bulk (future vault batch import) will benefit from
   map-reduce. Ensure `docHierarchy` is computed before the ingest inventory call when batch
   importing.

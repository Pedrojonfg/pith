# Deep Dive — Concept Inventory Truncation Fix + Map-Reduce

**Status**: Implemented (commit `3c912a9`)  
**Diagnosis predecessor**: [2026-06-16_concept-inventory-truncation.md](./2026-06-16_concept-inventory-truncation.md)  
**Pack fix precedent**: [2026-06-11_concept-pack-truncation-fix.md](./2026-06-11_concept-pack-truncation-fix.md)  
**Spec**: `specs/20260627-inventory-truncation-map-reduce/`

---

## 1. What we built

Phase 1 of the two-phase RSVP split (`deepSeekConceptInventory`) was silently truncating LLM output on dense long documents, producing unparseable JSON and a blocking error on the default flow (pre-packing assessment ON). We closed the asymmetry with Phase 2 (pack): explicit `max_tokens`, truncation detection, a fourth terse retry, and a unified mono-phase fallback across all inventory entry points. For documents over 8 000 words with document hierarchy, inventory now runs as map-reduce (chunk → parallel extract → merge) instead of one monolithic JSON blob. Dead code (`twoPassInventory`, debug `:7501` ingest fetches) was removed.

---

## 2. Design decisions

### Mirror the pack truncation fix for inventory (Layer 1)

**Chosen**: Named constants (`CONCEPT_INVENTORY_MAX_TOKENS = 12288`), four-attempt cascade (full → compact → no json_object → terse), `looksLikeTruncatedModelJson` + `CONCEPT_INVENTORY_TRUNCATED` error code.

**Alternatives rejected**:
- Raise global `max_tokens` on `callLlmSplit` — would inflate unrelated split calls.
- Heuristic JSON repair on truncated arrays — pack fix already rejected this as fragile.

**Trade-off**: Four sequential LLM calls on failure is slow and costly, but only on the error path; happy path is one call with adequate headroom.

### Map-reduce when `wordCount > 8000` AND `docHierarchy.tree` exists (Layer 2)

**Chosen**: Pure `buildInventoryChunks` groups hierarchy sections (~3 500 words target), `Promise.allSettled` per batch (max 8 parallel), single merge LLM call.

**Alternatives rejected**:
- Keep `twoPassInventory` lever — never received `docHierarchy` at call sites; branch never ran.
- Always map-reduce — unnecessary LLM overhead for short docs.

**Trade-off**: Merge pass is another full LLM call; cross-chunk `prerequisite_ids` depend on model quality at merge time. Partial chunk failures produce incomplete inventories with a user banner, not a hard stop.

### `runConceptInventoryWithFallback` with discriminated result

**Chosen**: Return `{ kind: 'inventory', ... }` or `{ kind: 'fallback_mono', blockIndex, splitRunMeta }`. All routes (generate, recommend, ingest, recall, `twoPhaseConceptSplit`) call this helper.

**Alternatives rejected**:
- Fail loud on pre-packing ON — blocks the default user path.
- Throw with attached fallback payload — harder for callers to branch cleanly.

**Trade-off**: Callers must handle two shapes; pre-packing assessment is skipped on `fallback_mono`, losing concept-level assessment for that session.

### Terse inventory skips source-fidelity anchor validation

**Chosen**: `validateBlockFidelity` accepts `inventoryMode`; terse / fallback modes short-circuit to `ok: true` with a console warning.

**Alternatives rejected**: Run anchor validation anyway — would false-fail blocks when `source_phrase` was intentionally omitted.

**Trade-off**: Strict source-fidelity guarantees are weakened for terse sessions; user is informed via banner, not silently.

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|---------|------------|-------------------|
| **Token budget / output ceiling** | LLM completions stop at `max_tokens`; truncation breaks JSON | `CONCEPT_INVENTORY_*_MAX_TOKENS` in `api.js`; passed via `callLlmSplit` |
| **Retry with degradation** | Progressively simpler prompts/schemas on failure | `callConceptInventoryLlm` attempts array (4 steps including terse) |
| **Heuristic truncation detection** | Parse fails + long prefix ⇒ likely cut-off, not malformed input | `looksLikeTruncatedModelJson` → `throwConceptInventoryParseError` |
| **Map-reduce** | Split work, process in parallel, reduce to unified output | `buildInventoryChunks` → `deepSeekConceptInventoryChunk` → `deepSeekMergeConceptInventories` in `session.js` |
| **Greedy bin-packing** | Accumulate sections until word budget, flush when over target | `buildInventoryChunks` pending/flush loop over `docHierarchy.tree` |
| **Promise.allSettled** | Parallel tasks; one failure does not reject the batch | `runConceptInventoryMapReduce` chunk batches |
| **Discriminated union** | Caller branches on `kind` field | `runConceptInventoryWithFallback` return type |
| **Fallback cascade** | Primary path fails → degraded but functional path | `deepSeekSplitIntoBlocks` with `pipeline: 'fallback_mono'` |
| **Pure function** | Deterministic chunking without side effects | `buildInventoryChunks` (unit-tested in cursor-tests) |
| **Feature flag / provenance metadata** | Downstream behavior depends on how inventory was produced | `inventoryMode`, `failedChunks` on `modes.rsvp._meta` via `persistInventoryRunMeta` |

---

## 4. Technical debt and improvements

**Done well**
- Parity with the June 11 pack fix pattern — predictable for future LLM JSON phases.
- `buildInventoryChunks` is pure and covered by T06/T07 tests.
- Fallback parity across routes fixes a real architectural gap documented since two-phase split.

**Functional shortcuts**
- `looksLikeTruncatedModelJson` is still length > 200 + parse fail — cannot distinguish a very long genuinely invalid JSON from truncation.
- Merge pass trusts the LLM to dedupe and re-id concepts; no deterministic merge fallback.
- `inventoryMode` is not yet threaded into every `validateBlockFidelity` caller in `api.js` block generation — terse skip only works when `inventoryMode` is passed.
- Hierarchy build on long docs is awaited inline; no cache warming on upload before user clicks Generate.

**Will not scale**
- 8+ parallel chunk calls per document under rate limits — batches help but total latency grows linearly with sections.
- Merge `max_tokens` (8192) may truncate again if partial inventories are huge before dedup.
- Terse inventory + pre-packing assessment still runs (only mono fallback skips it) — assessment quality without `concept_type` is unvalidated.

---

## 5. Consolidation questions

1. Why does `runConceptInventoryWithFallback` return `{ kind: 'fallback_mono' }` instead of throwing, and which caller paths skip pre-packing assessment as a result?

2. Under what exact conditions does `buildInventoryChunks` return `null`, forcing single-pass inventory even when `wordCount > 8000`?

3. How does `looksLikeTruncatedModelJson` decide truncation vs parse error, and what error code does `runConceptInventoryWithFallback` use to choose the fallback reason string?

---

## 6. Suggested `.cursorrules` additions

Already added in `.cursorrules` (LLM structured JSON section). If extending further:

1. **Map-reduce gate**: Any new LLM phase that outputs O(n) JSON items MUST document its word-count / item-count threshold for switching to chunked execution — not only `max_tokens` on the monolithic path.

2. **Provenance threading**: When a pipeline phase runs in degraded mode (`terse`, `fallback_mono`, partial map-reduce), the mode flag MUST be persisted on the session slice and passed to every downstream validator that assumes full schema fields.

3. **Fallback contract tests**: New entry points to `runConceptInventory*` require a cursor-test assertion that they import `runConceptInventoryWithFallback`, not `runConceptInventory` directly.

---

## References

| Artifact | Path |
|----------|------|
| Tests | `cursor-tests/20260616_inventory-truncation-map-reduce.mjs` |
| Contract | `specs/20260627-inventory-truncation-map-reduce/contracts/inventory-api.md` |
| ROADMAP | `ROADMAP.md` |
| Subagents | `.cursor/agents/truncation-t*.md` |

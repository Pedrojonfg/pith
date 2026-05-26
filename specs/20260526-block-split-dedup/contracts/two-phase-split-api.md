# Contract: Two-Phase Block Split API

**Module**: `src/js/api.js` (prompts + parse), orchestration in `src/js/session.js`

## Phase 1 — `buildConceptInventoryPrompt(lang)`

**System message** instructs:

- Extract ordered teachable concepts from material (one concept = one RSVP-sized idea).
- Output JSON only:

```json
{
  "concepts": [
    {
      "id": "c1",
      "order": 1,
      "title": "Gradient as direction of steepest ascent",
      "scope_one_line": "Defines gradient vector and geometric meaning",
      "module": "Partial derivatives",
      "prerequisite_ids": []
    }
  ]
}
```

- No document text in output.
- Language: `{lang}`.

## Phase 1 — `deepSeekConceptInventory({ llmModel, materialText, studyNotes?, language })`

**Returns**: `ConceptInventoryItem[]` or throws.

**Parse**: `parseConceptInventoryFromModelResponse(text)` — accept `{ concepts: [] }` or raw array; reuse `parseModelJsonValue` patterns from block split.

**Retries**: Same 3-attempt pattern as `deepSeekSplitIntoBlocks` (json_object → compact).

---

## Phase 2 — `buildConceptPackPrompt(n, lang, inventoryJson)`

**System message** instructs:

- Input: concept inventory JSON + target N.
- Output block index JSON:

```json
{
  "blocks": [
    {
      "id": 1,
      "title": "Overview: Vector calculus roadmap",
      "summary": "Modules: gradients, line integrals, …",
      "signature": ["gradient", "line integral", "circulation"],
      "concept_ids": []
    },
    {
      "id": 2,
      "title": "Key terms: Partial derivatives",
      "summary": "6-10 terms only …",
      "signature": ["partial derivative", "…"],
      "concept_ids": ["c2"]
    }
  ],
  "pack_meta": {
    "target_n": 15,
    "final_block_count": 12,
    "merges": [{ "concept_ids": ["c5", "c6"], "block_title": "…" }]
  }
}
```

**Rules encoded in prompt**:

1. Block 1 = global course overview (counts in N).
2. Each module: first block = `Key terms: [module]`.
3. Never assign same `concept_id` to two blocks.
4. If distinct concepts + overview + vocab > N: merge related/adjacent until exactly N.
5. If fewer than N: set `final_block_count` < N (no padding).
6. `chunk` always `""`.

## Phase 2 — `deepSeekPackConceptsToBlocks({ llmModel, inventory, nBlocks, studyNotes?, language })`

**Returns**: `{ blocks: BlockIndexEntry[], pack_meta: ConceptPackPlan }`.

**Parse**: extend `parseBlockIndexFromModelResponse` or sibling parser for `pack_meta`.

---

## Orchestrator — `twoPhaseConceptSplit(material, nBlocks, opts)`

**File**: `session.js`

```text
1. inventory = await deepSeekConceptInventory(...)
2. { blocks, pack_meta } = await deepSeekPackConceptsToBlocks({ inventory, nBlocks, ... })
3. normalized = normalizeBlockIndexArray(blocks, { requireChunk: false, lenient: true })
4. coerced = applyPackMetaCount(normalized, pack_meta)  // may return < nBlocks
5. chunks = splitMaterialIntoBlockChunks(material, coerced.length)
6. index = attach chunks
7. index = await applyDeterministicDedup(index, { llmModel })
8. return { blockIndex, splitRunMeta }
```

**On failure** at step 1 or 2: fallback `deepSeekSplitIntoBlocks` + `pipeline: "fallback_mono"`.

---

## Session binding

Uses `llmModel` from pending/active session (same as block split today).

## Deprecation

`twoPhaseSplitMerge` + `auditBlockIndex` MUST NOT be called from `study.js` generate handler after this feature ships.

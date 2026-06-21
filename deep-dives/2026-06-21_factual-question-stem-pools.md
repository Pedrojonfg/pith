# Deep Dive: Factual Question Stem Pools (R1 patch)

**Date:** 2026-06-21  
**Feature:** `specs/20260702-factual-pools`  
**ROADMAP:** `ROADMAP-factual-pools.md`

---

## 1. What we built

A patch to pedagogical-principles R1 that replaces single-template factual MCQs with a three-stage pipeline: rotating stem pools (dates, numbers-with-units, proper nouns), distractors sourced from sibling concepts in the same document's inventory, and one batched DeepSeek validation call per block. Definitions and enumerations stay on full LLM generation. Per-concept fallback to LLM kicks in when sourcing or validation cannot produce at least three viable wrong options.

---

## 2. Design decisions

### Only three factual subtypes get templated generation

**Chosen:** `date`, `number_with_unit`, `proper_noun` only; `defined_as` and `enumeration` signals → `null` from `resolveFactualCategory`.

**Alternatives:** Keep all five original R1 categories on templates; extend sourcing to definitions.

**Discarded because:** Wrong definitions/lists cannot be plausibly sourced from inventory siblings the way years or units can.

**Trade-off:** More LLM calls for definition-style facts, but fewer broken MCQs.

### Distractors from inventory, never invented

**Chosen:** `sourceDistractorCandidates` walks `conceptInventory`, extracts facts per category, enforces same-unit matching for numbers.

**Alternatives:** Template-generated wrong answers; LLM-generated distractors per concept.

**Discarded because:** Original R1 review found invented distractors are either trivial or accidentally correct.

**Trade-off:** Short documents often lack enough siblings → per-concept LLM fallback (by design).

### One batched validation call per block (DeepSeek)

**Chosen:** `validateDistractorBatch` sends all `{ fact, candidates }` pairs in one prompt; default model `DEFAULT_LLM_MODEL` (DeepSeek).

**Alternatives:** Gemini Flash (initial spec draft); per-concept validation; skip validation.

**Discarded:** Gemini for non-embedding LLM work violates project routing; per-concept calls erase batch savings.

**Trade-off:** Single parse failure affects whole batch; mitigated by TRUNCATED/PARSE/SCHEMA error codes and LLM fallback per concept.

### Session-scoped stem rotation

**Chosen:** `createStemRotator` + `_meta.factualStemRotation.usedByCategory`; no repeat until pool exhausted.

**Alternatives:** Reuse RSVP header pool module; random pick each time.

**Discarded:** RSVP pool has no rotation API; random repeats feel copy-pasted in one sitting.

**Trade-off:** Rotation state lives in session memory only — lost on reload (acceptable for bounded sessions).

### Snippet extraction anchored at label

**Chosen:** `extractSnippet` starts at label/definition match; `firstMatchNearLabel` only considers numeric/year matches at or after the label index.

**Alternatives:** ±100 char window around label (initial implementation).

**Discarded because:** Backward window pulled in sibling concepts' values (e.g. `500 kg` before `Town distance`).

**Trade-off:** Facts mentioned only before the label in prose may be missed — rare in well-structured inventory titles.

### Wiring in `session.js` before LLM question regen

**Chosen:** `buildFactualQuestionsForBlock` runs first; reduces `n_test` passed to `deepSeekRegenerateBlockQuestions` by count of validated templated questions.

**Alternatives:** Post-process LLM output; separate factual-only mode.

**Trade-off:** Block must have `concept_ids` on block index entries for scoped concepts; otherwise falls back to all factual inventory entries.

---

## 3. Concepts applied

| Concept | Where |
|--------|--------|
| **Strategy pattern** | Injectable `callLlm` in `validateDistractorBatch` for tests vs production DeepSeek path |
| **Session state machine (lightweight)** | `usedByCategory` tracks consumed stem indices per category |
| **Set / deduplication** | Distractor candidate dedup by lowercase value in `sourceDistractorCandidates` |
| **Greedy nearest-match** | `firstMatchNearLabel` picks closest unit/year match after label position |
| **Graceful degradation** | Two escalation points (pool < 3, approved < 3) → `llmFallbackConceptIds` |
| **Batch API design** | One LLM request amortized over N factual items per block |
| **Schema validation pipeline** | `parseValidationBatchResponse` → TRUNCATED / PARSE_ERROR / SCHEMA_ERROR |
| **Tagged provenance** | `generation_method: 'template_validated' \| 'llm'` on block questions |
| **Pure functions + side-effect boundary** | Sourcing/rotation pure; LLM + logging at orchestrator edge |

---

## 4. Technical debt and improvements

**Well done**

- Clear module split: templates → sourcing → validation → block orchestrator
- Unit tests cover rotation, unit matching, batch call count, fallback paths without live API
- Label-anchored snippet fix prevents cross-concept number bleed

**Functional duct tape**

- `extractInventoryFact` duplicates pattern logic from `extractFactualAnswer` with a fallback path for low-confidence classifier scores on siblings
- `normalizeValidationResults` approves all candidates if LLM omits an item (fail-open) — relies on downstream min-3 check
- Proper-noun distractors use unfiltered pool when no entity-kind metadata exists

**Would not scale**

- Regex-based unit/year extraction breaks on locale formats, compound units, or ranges
- Batching all block items into one JSON response will truncate on large blocks unless chunking is added
- No cache of validation results across block regenerations — repeated regen re-pays validation

---

## 5. Consolidation questions

1. When a block has five templated factual concepts but `n_test=2`, which concepts win and why does the loop order matter in `buildFactualBlockQuestions`?
2. Why does matching `500 kg` as a distractor for a `12 km` question fail at two separate layers (unit normalization and label-anchored snippet), and what would break if you removed only one?
3. If DeepSeek returns valid JSON but swaps approved/rejected lists for two facts with similar values, how does `normalizeValidationResults` map results back and what user-visible symptom would you see?

---

## 6. Suggested update for .cursorrules

1. **Non-embedding LLM calls MUST use DeepSeek** (`DEFAULT_LLM_MODEL` or session model). Gemini is for embeddings only unless a spec explicitly exceptions it.

2. **Factual templated MCQs:** distractors MUST come from same-document inventory with category-specific rules (same unit for numbers); never invent distractors in template path. Minimum 3 candidates before templated path; minimum 3 approved after validation.

3. **Batched LLM validation responses** must declare `max_tokens`, distinguish TRUNCATED/PARSE/SCHEMA failures, and document fail-open vs fail-closed behavior per contract.

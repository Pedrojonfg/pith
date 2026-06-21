# Spec: Vault Embedding Quality Layer

**Status:** Draft
**Date:** 2026-06-21
**Depends on:** `20260618-knowledge-vault-a-plus`, `20260619-knowledge-vault-post-a-plus`, `20260623-study-projects`, `20260626-cross-doc-vault`
**Supersedes:** Nothing. This is an additive enrichment layer.
**Closes gaps in:** `20260626-cross-doc-vault` (identity resolution / cross-doc Phase 2 marked 🟡), `20260624-knowledge-vault-curation` (dedup UX marked 🟡)

---

## 1. Problem statement

The vault currently resolves concept identity, deduplication, and cross-document linking using LLM judgment and partially-specified heuristics (`concept-registry/identity-resolution.js`). This is:

- **Unauditable** — no record of *why* two concepts were or weren't merged.
- **Unbounded in cost** — every comparison risks being an LLM call.
- **Blind to disagreement** — text similarity cannot distinguish "this is the same claim restated" from "this is the opposite claim." Two concepts that contradict each other often score as textually similar as two paraphrases of the same concept.
- **Missing a "is this new to me" signal** at upload time — novelty is currently only inferred indirectly, after the user has already started answering questions.

This spec introduces a deterministic, cheap, embedding-based layer (via `gemini-embedding-001`) that sits underneath the existing LLM-driven vault logic, not replacing it but gating and informing it.

## 2. Non-goals (explicitly out of scope)

- Changing the SM-2 scheduling algorithm or `sm2.js` priority logic.
- Block-packing bias toward a novelty ratio (the "70/30" idea) — this is a *consumer* of R1's novelty score and belongs in its own future spec once R1 is stable and calibrated.
- Embedding-space whitening/calibration (Soft-ZCA, ABTT, etc.) — only worth doing once there's real corpus volume to calibrate against. Tracked as a future candidate, not built here.
- Centralizing API keys / moving off BYO-key model.
- Replacing the `knowledgeVaultOverlay` debug UI with a production UI — merge proposals surface inside the existing overlay for now.
- Full reversal/undo of an applied cascade merge (R3.5).
- Cross-lingual embedding calibration beyond what `gemini-embedding-001` provides out of the box.

## 3. Architecture overview

```
DPP T1.2 (conceptInventory) ─┐
DPP T1.6 (vault linking)     ├─► R0: embed concepts ──► R1: novelty score (read-only, on shared.conceptInventory)
                              │
Vault curation / promotion ──┴─► R0: embed concepts ──► R2: candidate pairs ──► veto gates ──► R4: contradiction check
                                                                                    │
                                                                                    ▼
                                                                          merge proposal (human review)
                                                                                    │
                                                                                    ▼
                                                                          R3: cascade merge (Postgres RPC, atomic)

Document upload (projectId != 'misc') ──► R0: embed doc summary+concepts ──► R5: document_similarity table
```

All five features (R1–R5) share one foundation (R0) and degrade independently — disabling embeddings disables all of them but breaks nothing else in the app (graceful degradation, R0.5).

---

## 4. R0 — Embedding infrastructure (foundational, blocking for R1–R5)

**R0.1.** Enable the `vector` extension on the Supabase project (`mnoczpssewnymuxeniyo`, eu-central-1) via `apply_migration`.

**R0.2.** New table `concept_embeddings`:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `concept_id` | text | FK target TBD — see Open Question 17.1 |
| `scope_type` | text | `'concept' \| 'document'` |
| `project_id` | text | nullable, for scoping queries to ancestor chain |
| `source_text` | text | exact text embedded, for cache-key + audit |
| `source_text_hash` | text | sha256 of `source_text`, indexed, used for cache lookup |
| `embedding` | vector(768) | see R0.3 for dimensionality rationale |
| `model_version` | text | default `'gemini-embedding-001'` |
| `created_at` | timestamptz | default now() |

Unique constraint on `(source_text_hash, model_version)` — this is the cache key. Index: HNSW on `embedding` (cosine ops), read-heavy/write-light access pattern favors HNSW over IVFFlat at this scale.

**R0.3.** New module `src/js/vault/embeddings.js`:

- `embedText(text, { taskType = 'SEMANTIC_SIMILARITY' }) -> Promise<number[]>`
- `embedBatch(texts: string[]) -> Promise<number[][]>`
- Calls Gemini's native `embed_content` endpoint directly (this is **not** the OpenAI-compatible chat completions surface that `llm.js` wraps — it is a distinct REST endpoint and requires its own minimal client, not a `llm.js` provider entry).
- `output_dimensionality: 768` (Matryoshka truncation). Rationale: `gemini-embedding-001` supports 768/1536/3072 at identical token cost; 768 is sufficient for concept-level short-text comparison and keeps `vector` index size and pgvector query cost down. This is a config constant, not hardcoded inline (`config/flags.js` → `EMBEDDING_OUTPUT_DIMENSIONALITY`).
- **Caching is mandatory, not optional**: before calling the API, hash `source_text` and check `concept_embeddings` for an existing row at the current `model_version`. Skip the API call on hit. This mirrors the cache discipline already established for LLM calls in this codebase.

**R0.4.** Cost/blocking guardrails: embedding calls run only inside DPP background phases (Tier 1.7+/Tier 2) or explicit curation actions — never synchronously on a screen the user is staring at waiting for it.

**R0.5. Graceful degradation (hard requirement).** If `gemini_api_key` is absent from user settings, R1–R5 phases report `status: "skipped"` (a new, distinct status from `failed` — `preparation.status` enum gets one more value, see Open Question 17.2) and the rest of DPP proceeds unaffected. No screen should block on these phases.

**R0.6.** Query helper `findNearestConcepts(embedding, { matchCount, projectId, excludeConceptId })` — Postgres function using the `<=>` cosine distance operator, scoped to `project_id` ancestor chain (reuses the same ancestor-chain resolution already implemented for vault context priority in `20260623-study-projects`; do not reimplement it here — call into the existing resolver).

---

## 5. R1 — Novelty scoring at upload

**Goal:** every concept in a freshly-built `conceptInventory` gets a `noveltyScore` (0.0–1.0) before the user studies anything.

**R1.1.** New DPP phase **T1.7 "Scoring concept novelty"**, sequenced after T1.2 (conceptInventory) and T1.6 (vault linking) — vault linking must run first so we know which concepts are *already* identity-resolved to existing vault entries (those are skipped, not "novel by construction").

**R1.2.** For each unresolved concept:
1. Embed `name + short gloss` (whatever short definition field the inventory entry already carries — verify exact field name, Open Question 17.3).
2. `findNearestConcepts`, scoped to the document's project ancestor chain.
3. `noveltyScore = clamp(1 - max_cosine_similarity, 0, 1)`.

**R1.3.** No existing vault entries in scope (empty/new project) → `noveltyScore = 1.0` by definition, no API call needed.

**R1.4.** `noveltyScore` is stored on `shared.conceptInventory[i].noveltyScore`. **It is a signal only.** It must never directly set or upgrade a vault maturity state — that would violate the existing "earned through retrieval signals, not LLM-generated stubs" rule. It feeds:
   - a UI summary badge at `screenCreateSessionStart` confirmation ("~72% of this material looks new to you") — simple average across scored concepts, exclude nulls.
   - nothing else, in this spec (block-packing consumption is explicitly future work, §2).

**R1.5.** Failure handling: per-concept granularity. A failed embedding call for one concept does not block the rest — that concept's `noveltyScore` stays `null` (distinct from `0`, which means "fully known"). UI must render null as "not assessed," never as 0%.

**R1.6.** Schema note: this adds a field to `shared.conceptInventory[i]`. Confirm with the team whether this requires a `schemaVersion` bump per `session-types.js` convention, or whether additive optional fields are tolerated without a version bump (Open Question 17.4).

---

## 6. R2 — Veto-gate deduplication

**Goal:** replace ad hoc identity-resolution heuristics with an explicit, auditable, short-circuiting gate chain. Output is **proposals only** — nothing auto-merges here.

**R2.1.** New module `src/js/concept-registry/dedup-gates.js`.

**R2.2.** Candidate generation: triggered at T1.6 (vault linking) and at manual vault curation actions. `findNearestConcepts` with a **generation floor** of cosine ≥ 0.55 (placeholder — see Open Question 17.5), scoped primarily within the project ancestor chain; cross-project candidate generation is gated behind a separate config flag (`CROSS_PROJECT_DEDUP_ENABLED`, default `false`).

**R2.3.** Ordered veto-gate chain, each gate `(conceptA, conceptB, context) -> { passed: boolean, reason: string }`, short-circuit on first `false`:

| Gate | Rule | Default behavior if data absent |
|---|---|---|
| G1 `sameLanguageOrTranslatable` | reject if `docMeta.language` differs and no cross-lingual override is set | passes trivially if language data absent |
| G2 `noConflictingExternalId` | reject if both concepts carry an external/canonical ID field and they differ | passes trivially — no such field exists yet in current schema |
| G3 `cosineAboveThreshold(0.72)` | hard floor on the same similarity score from R2.2, evaluated again as a named, auditable gate | — |
| G4 `noUserRejectionHistory` | reject permanently if user previously rejected merging this exact pair (see R2.7 log) | passes if no rejection on record |

**R2.4.** Pairs passing all gates become **merge proposals**, surfaced for explicit user approval (R3). No auto-merge under any circumstance.

**R2.5.** Pairs scoring between the generation floor (0.55) and the hard gate (0.72) are surfaced as lower-confidence suggestions in the vault curation UI, sorted by score, visually distinct from full proposals.

**R2.6.** Every candidate pair evaluation — pass or fail, and which gate rejected it — is logged to `dedup_gate_log` (id, concept_id_a, concept_id_b, gate_results jsonb, outcome, evaluated_at). This is for debugging false negatives later; it is not user-facing.

**R2.7.** User rejections of a proposed merge are recorded distinctly (table or flag — Open Question 17.6) and consulted by G4 on every future candidate generation for that pair.

---

## 7. R3 — Cascade merge

**Goal:** when a merge proposal is approved, every reference to the source concept is relinked atomically. No orphaned references, ever.

**R3.1.** New module `src/js/concept-registry/cascade-merge.js`.

**R3.2.** Declarative reference graph — every place a `conceptId` appears in the schema must be relinked on merge:

- `shared.smItems[].conceptId`
- `shared.assessmentSignals[].conceptId`
- `shared.conceptGraph.edges[].source` / `.target`
- `modes.cloze.items[].conceptIds[]`
- mnemonic device `conceptIds[]` arrays
- vault entry `related` / cross-reference fields (`20260625-vault-notes-connections`)
- global registry facet schedules (`concept-registry/global-review.js`)

> **This list is a best-effort reconstruction from `application-overview.md` and project memory, not a verified exhaustive audit.** Before implementing R3.2, run `grep -rn "conceptId" src/js/` and confirm this list is complete. Treat an incomplete reference graph as a data-integrity bug, not a minor gap — a missed reference means a silently broken pointer after every merge.

**R3.3.** `mergeConceptProposal(sourceId, targetId, { approvedBy, reasoning })`:
1. Begin transaction.
2. Relink every reference per R3.2.
3. Merge metadata: union `notes`/`related`; maturity state takes the **max** of the two (gray < yellow < green) — knowledge levels only upgrade, consistent with the existing vault rule. Never downgrade on merge.
4. Soft-delete source concept: set `merged_into: targetId`, do not hard-delete (auditability, R3.5).
5. Write `vault_merge_log` entry (R3.6).
6. Commit.

**R3.4.** Idempotency: the operation must be safe to retry. Use the soft-delete `merged_into` field as the guard — if source is already merged into the target, the operation is a no-op success, not an error.

**R3.5.** **Reversal is explicitly out of scope.** Full undo of a cascade merge is non-trivial (requires reconstructing every relinked reference's prior state) and is not built here. The only reversible point in the flow is rejecting a proposal *before* R3.3 runs (R2.7).

**R3.6.** Audit table `vault_merge_log`: `id, source_concept_id, target_concept_id, gate_results (jsonb snapshot from R2.6), approved_by, reasoning, applied_at, reference_relink_count, reference_relink_detail (jsonb array of human-readable strings, e.g. "smItems.conceptId: 42 → 17 (3 rows)")`.

**R3.7.** UI: merge proposals appear in `knowledgeVaultOverlay` with a dry-run preview (run steps 1–2 of R3.3 without committing) showing exactly what will be relinked before the user confirms.

**R3.8. Hard requirement, not a nice-to-have:** this must be implemented as a single Postgres function invoked via RPC (`apply_migration` + `execute_sql`), **not** as sequential client-side `.update()` calls across tables. The Supabase JS client has no multi-table transaction primitive; sequential client writes risk a partial-merge state if any step fails mid-cascade. This is the single highest-risk part of this entire spec — treat it accordingly in review.

---

## 8. R4 — Contradiction detection via LLM

**Goal:** cosine similarity cannot tell "this is the same claim restated" from "this is the opposite claim." Route ambiguous high-similarity pairs through a cheap LLM classification before they become merge proposals.

**R4.1.** New function `classifyConceptRelation(conceptA, conceptB) -> { label: 'entailment' | 'contradiction' | 'neutral', confidence }`, in `api.js` or a new `vault/contradiction-check.js`.

**R4.2.** Trigger condition: only candidate pairs already at or above the G3 hard gate (cosine ≥ 0.72) — do not spend LLM calls on the larger pool of generation-floor candidates. Cheap signal (embeddings) filters first; expensive signal (LLM) only evaluates what survives.

**R4.3.** Model routing: Gemini Flash, not DeepSeek — this is an interactive-adjacent path (runs during background DPP but should stay low-latency for batch throughput), consistent with the project's existing convention of routing latency-sensitive work to Gemini direct rather than a `claude -p`-style subprocess pattern.

**R4.4.** Result handling:
- `contradiction` → hard veto on the merge proposal. The pair is **not discarded** — it is written as a `CONTRADICTS`-typed edge in `shared.conceptGraph` (the typed-edge enum already supports this), turning a dedup false-positive into a useful pedagogical signal.
- `entailment` → proceeds to merge proposal (R2.4) with elevated confidence shown in the UI.
- `neutral` → proceeds to merge proposal but flagged low-confidence. **Open question (17.7):** should `neutral` instead create an `ASSOCIATED`-typed edge rather than a merge proposal? The current typed-edge enum (`PREREQUISITE`, `CONTRADICTS`, `EXEMPLIFIES`, `PART_OF`, `ASSOCIATED`) has no `EXTENDS` type for "related but not identical" — needs a product decision before implementation, not an engineering one.

**R4.5.** Cost ceiling: config flag `MAX_CONTRADICTION_CHECKS_PER_DPP_RUN` (default 20). A pathological document with many borderline-similar concepts must not trigger runaway LLM spend — calls beyond the cap are skipped and those pairs default to "neutral / manual review" status rather than blocking.

---

## 9. R5 — Document-to-document similarity (Study Projects)

**Goal:** surface "related documents" within a project, and warn on likely near-duplicate uploads.

**R5.1.** Weighted multi-field embedding: `score = 0.5 * cos(summaryA, summaryB) + 0.5 * cos(conceptsA, conceptsB)`, where `summary` is `docMeta`'s inferred title/summary (**Open Question 17.8**: confirm DPP currently produces a summary-length field, not just title) and `concepts` is the joined top-N concept names from `conceptInventory`. Weighted combination is deliberate — concatenating both fields into one embedding call lets the longer text dominate and degrades accuracy.

**R5.2.** New DPP phase **T1.8 "Computing project document similarity"**, lower priority than R1/R2, runs only if `projectId !== 'misc'` — comparing against a flat unsorted library has no product value.

**R5.3.** Table `document_similarity`: `doc_id_a, doc_id_b, score, field_scores (jsonb), computed_at`. Symmetric pair stored once with `doc_id_a < doc_id_b` to avoid duplicate rows.

**R5.4.** Thresholds (placeholders — see §10 on calibration):
- ≥ 0.55 → "related document" badge in `screenDocLibrary`.
- ≥ 0.64 → non-blocking near-duplicate warning at `screenCreateSessionStart` confirmation ("this looks very similar to [doc]; did you mean to re-upload?").

**R5.5.** Non-goal: R5 does not feed concept-level matching (R1/R2). It is a separate, lighter-weight signal scoped to project/library UX only.

---

## 10. A note on every threshold in this spec

Every numeric threshold above (0.55, 0.72, 0.64, the 768-dim choice) is a **placeholder borrowed from a third-party reference (Limbic) that calibrated them on `paraphrase-multilingual-MiniLM-L12-v2`, a different embedding model with a different similarity distribution than `gemini-embedding-001`.** Do not trust these numbers as ground truth. They are reasonable starting points to ship behind feature flags and observe, not constants to hard-code confidently. Calibration against real Pith data (a small labeled set of "is this the same concept" pairs) is a prerequisite for tightening them, and is explicitly **not** part of this spec's implementation — track as a fast-follow once R1–R5 have real usage data.

---

## 11. Config flags (`config/flags.js`)

```
VAULT_EMBEDDINGS_ENABLED          // master switch, default: true if gemini_api_key present
VAULT_NOVELTY_SCORING_ENABLED     // default: true
VAULT_DEDUP_GATES_ENABLED         // default: true
VAULT_CONTRADICTION_CHECK_ENABLED // default: true
DOC_SIMILARITY_ENABLED            // default: true
CROSS_PROJECT_DEDUP_ENABLED       // default: false
EMBEDDING_OUTPUT_DIMENSIONALITY   // default: 768
MAX_CONTRADICTION_CHECKS_PER_DPP_RUN // default: 20
```

All thresholds from §10 live as named constants in a single new file `vault/embedding-thresholds.js` — no magic numbers scattered inline. This is a rule, not a suggestion: it's the only way calibration (§10) stays tractable later.

---

## 12. Risk-ordered implementation sequence

1. **R0** — embedding infra + pgvector migration. Foundational, low risk, nothing depends on it being "smart," just correct.
2. **R1** — novelty scoring. Read-only enrichment, zero mutation risk. Best first feature to validate embedding quality against real Pith data before building anything that writes.
3. **R2** — dedup gates, proposal generation only (no merge execution yet). Still read-only from the data-integrity perspective; risk is false positives surfaced to the user, not data corruption.
4. **R4** — contradiction check. Can be built in parallel with R2/R3 (it's a classifier bolted onto the candidate pipeline) but functionally needs R2's candidate pairs to have something to classify.
5. **R3** — cascade merge execution. **Highest risk in this entire spec.** Build last, after R2 has been observed in proposal-only mode and the reference graph (R3.2) has been verified exhaustively against the codebase.
6. **R5** — document similarity. Fully independent of R1–R4, can be built any time after R0.

---

## 13. Testing checklist

- [ ] `cursor-tests/20260621_embedding-cache.mjs` — same `source_text` embedded twice produces one API call, not two.
- [ ] `cursor-tests/20260621_novelty-empty-vault.mjs` — empty-project upload yields `noveltyScore: 1.0` for all concepts, zero embedding API calls (R1.3 short-circuit).
- [ ] `cursor-tests/20260621_dedup-gate-chain.mjs` — each gate (G1–G4) independently vetoes a synthetic pair when its condition is met; gate chain short-circuits (later gates not evaluated after an earlier rejection).
- [ ] `cursor-tests/20260621_cascade-merge-atomicity.mjs` — simulate a failure mid-cascade (kill the RPC call partway via a forced error in a test transaction) and confirm no partial-relink state persists.
- [ ] `cursor-tests/20260621_cascade-merge-idempotent.mjs` — calling `mergeConceptProposal` twice on an already-merged pair is a no-op, not an error.
- [ ] `cursor-tests/20260621_contradiction-veto.mjs` — a synthetic `contradiction`-classified pair never becomes a merge proposal and does produce a `CONTRADICTS` edge.
- [ ] `cursor-tests/20260621_doc-similarity-symmetry.mjs` — `document_similarity` never stores both `(A,B)` and `(B,A)`.
- [ ] `cursor-tests/20260621_graceful-degradation.mjs` — with `gemini_api_key` unset, full DPP run completes with all R1/R2/R4/R5 phases at `status: "skipped"`, no blocking, no thrown errors.
- [ ] Manual: confirm `MAX_CONTRADICTION_CHECKS_PER_DPP_RUN` cap is respected on a synthetic document with 50+ borderline-similar concepts.

---

## 14. Open questions — must be resolved against the actual codebase before Cursor implements

1. **17.1** Exact current Postgres table/column names for vault concept entities and the concept registry post-Supabase-migration. `application-overview.md` only documents the client-side `shared`/`modes` shape, not the Postgres schema. `concept_embeddings.concept_id`'s FK target depends on this.
2. **17.2** Confirm whether `preparation.status` enum (`pending/running/ready/partial/failed/legacy`) can safely accept a new `skipped`-per-phase concept, or whether phase-level skip status needs a different field than the top-level `preparation.status`.
3. **17.3** Exact field name in `conceptInventory` entries that holds a short definition/gloss, if one exists — if not, R1.2 step 1 needs to fall back to concept name alone (lower quality, flag this in implementation).
4. **17.4** Does adding an optional field to `shared.conceptInventory[i]` require a `schemaVersion` bump per `session-types.js` convention, or are additive optional fields tolerated silently?
5. **17.5** The 0.55 / 0.72 thresholds are placeholders (§10) — confirm there's no existing similarity threshold already in use in `identity-resolution.js` that should be the actual starting point instead of an imported number from Limbic.
6. **17.6** Where should user merge-rejections be recorded — a new table, or a flag on the existing `dedup_gate_log` row? Needs a decision before R2.7.
7. **17.7** Product decision (not engineering): does `neutral` classification from R4 produce a merge proposal or an `ASSOCIATED`-typed edge? Affects whether the typed-edge enum needs an `EXTENDS` addition.
8. **17.8** Confirm DPP currently produces a `docMeta` summary field (not just inferred title) — R5.1 depends on it existing; if absent, this spec would need to add a summary-generation step, which is scope creep and should be flagged back to the user rather than silently added.

---

## 15. Glossary additions

| Term | Meaning |
|---|---|
| **Novelty score** | 0.0–1.0 signal, `1 - max cosine similarity` to nearest existing vault concept in scope. Not a maturity state. |
| **Veto gate** | A pure function that can reject a candidate duplicate pair; chain short-circuits on first rejection. |
| **Merge proposal** | A dedup candidate that survived all veto gates; requires explicit human approval before R3 executes. |
| **Cascade merge** | Atomic relink of every reference to a source concept onto a target concept, on approved merge. |
| **HNSW** | The pgvector index type used for `concept_embeddings.embedding` — read-optimized for this access pattern. |

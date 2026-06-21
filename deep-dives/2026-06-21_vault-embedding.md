# Deep Dive: Vault Embedding Quality Layer

**Date**: 2026-06-21  
**Feature**: `20260629-vault-embedding`  
**Spec**: `specs/20260629-vault-embedding/spec.md`

---

## 1. What we built

A **vault embedding quality layer** runs during Document Preparation (DPP) after concept inventory: Gemini `embedContent` vectors are cached in Supabase, T1.8 scores per-concept novelty against the global registry, applies a three-gate dedup chain (language, external id, cosine floor), and optionally LLM contradiction checks before surfacing merge proposals. T1.9 compares dual document embeddings (title + top concepts) for related/duplicate hints in the library. Approved merges execute a **client-atomic cascade** that relinks `conceptId` references across sessions, vault, and registry, with Postgres RPC for embedding row relinks only. Feature flags gate every sub-capability; without a Gemini key the phases skip cleanly.

---

## 2. Design decisions

### 2.1 DPP phases T1.8 / T1.9 (not T1.7 renumber)

**Chosen**: Novelty at **T1.8**, document similarity at **T1.9**; T1.7 stays figure vision from image ingestion.

**Alternatives**: Renumber vision to T1.9 — rejected (breaks shipped image-ingestion roadmap).

**Trade-off**: Phase dependency graph is longer (`T1.9` depends on `T1.8`); skip status must be explicit when embeddings are off.

### 2.2 Supabase cache mandatory; localStorage registry unchanged

**Chosen**: `concept_embeddings`, `dedup_gate_log`, `merge_rejections`, `vault_merge_log`, `document_similarity` in Postgres with RLS; registry + vault remain `localStorage`.

**Alternatives**: Embed vectors in registry JSON; pure client dedup without pgvector RPC.

**Trade-off**: Requires auth + migration; offline users get memory cache fallback only during a session. Nearest-neighbor search uses `find_nearest_concept_embeddings` RPC — not portable offline.

### 2.3 Client-atomic cascade merge with snapshot rollback

**Chosen**: `cascade-merge.js` snapshots registry, vault, and session list; on failure restores all three including `restoreSessions()`.

**Alternatives**: Full Postgres JSONB surgery RPC; optimistic merge without rollback.

**Trade-off**: Large session lists make snapshot expensive; partial Supabase failure on `relink_embedding_concept_id` is logged but non-fatal (embeddings can drift from registry).

### 2.4 Pure modules split from I/O (`embedding-math.js`, `dedup-gate-rules.js`)

**Chosen**: Cosine, novelty formula, gate rules, and `classifyDedupOutcome` in import-safe pure files; `embeddings.js` / `embedding-persist.js` own network.

**Alternatives**: Single `embeddings.js` blob; dynamic import everywhere in tests.

**Trade-off**: More files; avoids circular imports and lets Node tests run without `https://esm.sh` if loader mocks `supabase-client.js`.

### 2.5 Thresholds as flagged placeholders

**Chosen**: `embedding-thresholds.js` constants (`DEDUP_HARD_GATE_THRESHOLD`, doc similarity bands) behind `VAULT_EMBEDDING_FLAGS`.

**Alternatives**: Calibrated per-model thresholds in spec v1.

**Trade-off**: False positives/negatives until calibration against `gemini-embedding-001`; product can tune without code changes via flags file.

### 2.6 `neutral` contradiction → low-confidence proposal (not veto)

**Chosen**: Only `contradiction` label vetoes; `entailment` boosts confidence; `neutral` keeps proposal with low confidence.

**Alternatives**: Veto all non-entailment; create `EXTENDS` edge type.

**Trade-off**: More merge noise; user must confirm in debug UI. `CONTRADICTS` edges persisted when LLM says contradiction.

### 2.7 `merged_into` soft-delete on source concept

**Chosen**: Source concept row kept with `merged_into: targetId` for audit and idempotent re-merge.

**Alternatives**: Hard delete source; tombstone table in Supabase only.

**Trade-off**: Registry grows; dedup/novelty must filter `merged_into` concepts (`novelty-scoring.js`, `dedup-gates.js`).

---

## 3. Concepts applied

| Concept | What it is | Where in our code |
|--------|------------|-------------------|
| **Vector embedding** | Dense float representation of text for semantic similarity | `embeddings.js` → Gemini REST; stored in `concept_embeddings.embedding` |
| **Cosine similarity** | Angle between vectors, ∈ [-1, 1], used as semantic distance proxy | `embedding-math.js` `cosineSimilarity`; gates use score vs thresholds |
| **Novelty scoring** | `1 - maxSim` capped to [0,1], inverted similarity as "newness" | `computeNoveltyScore` in `embedding-math.js`; `novelty-scoring.js` aggregates per doc |
| **Nearest-neighbor search** | Find top-k closest vectors in corpus | Supabase RPC `find_nearest_concept_embeddings`; client-side fallback loop in tests |
| **Feature flags** | Compile-time/runtime toggles for gradual rollout | `config/flags.js` `VAULT_EMBEDDING_FLAGS` + `isVaultEmbeddingsEnabled()` (also requires Gemini key) |
| **Snapshot rollback (compensating transaction)** | Copy state before mutation; restore on error | `cascade-merge.js` `snapshotState` / `restoreState` / `restoreSessions` |
| **Idempotent operations** | Safe retry via guard condition | `mergeConceptProposal` early return when `merged_into === targetId` |
| **Pipeline orchestration** | Ordered phases with deps, skip, and hash cache | `document-preparation.js` T1.8/T1.9 in `PHASE_DEPS`, `{ skipped: true }` results |
| **Separation of concerns** | Pure logic vs I/O boundaries | `dedup-gate-rules.js` vs `dedup-gates.js`; `embedding-math.js` vs `embeddings.js` |
| **Content-addressed cache** | SHA-256 of embed text as cache key | `hashSourceText` in `embeddings.js` → `source_text_hash` column |
| **Row Level Security (RLS)** | Postgres policies scoped to `auth.uid()` | `supabase/migrations/20260621150000_vault_embedding.sql` |

---

## 4. Technical debt and improvements

**Well done**
- Pure math/gate modules are testable in Node without browser.
- Phase skip integrates with existing DPP `markPhase` / fingerprint pattern.
- `normalizeConcept` now preserves `merged_into` (bug caught in validation).
- Loader mock for `supabase-client.js` unblocks cascade-merge tests on Windows.

**Duct tape**
- Thresholds are uncalibrated constants; expect false merge suggestions until a calibration pass.
- Contradiction check uses a small LLM call with 120 `max_tokens` — quality unverified at scale.
- `insertVaultMergeLog` failure does not roll back local merge (audit gap).
- Embedding relink RPC failure is `console.warn` only — registry and embeddings can diverge.

**Won't scale**
- Client-side cascade over all sessions is O(docs × references); fine for tens of docs, painful at hundreds without server-side relink job.
- Per-concept embed on every upload without batching API calls — rate limits and cost.
- `MAX_CONTRADICTION_CHECKS_PER_DPP_RUN` caps LLM but linear scan of proposal pairs still grows with inventory size.
- Dual localStorage + Supabase truth for concepts — migration to unified Postgres registry is the real fix (noted in research R4).

---

## 5. Consolidation questions

1. **Why is cascade merge client-atomic but embedding relink best-effort?** What user-visible inconsistency appears if `relink_embedding_concept_id` fails after a successful local merge?

2. **How does `isVaultEmbeddingsEnabled()` interact with DPP skip semantics?** Trace the path from "no Gemini key" through T1.8/T1.9 to `phaseResults` and the create-screen insight badge.

3. **What invariant does `merged_into` guard, and what breaks if `normalizeConcept` drops optional registry fields again?** Which downstream modules assume that field exists?

---

## 6. Suggested update for .cursorrules

1. **Registry normalize parity**: Any new optional field on `Concept` (e.g. `merged_into`, `externalId`) MUST be explicitly preserved in `normalizeConcept` in `registry-store.js` — silent stripping is a data-loss bug.

2. **Embedding module import boundary**: Do not import `embeddings.js` or `embedding-persist.js` from pure test targets or gate logic; use `embedding-math.js` / `dedup-gate-rules.js`. Node tests MUST use `cursor-tests/register.mjs` when the import graph touches `supabase-client.js`.

3. **Vault embedding LLM calls**: Contradiction classification is the only LLM on the dedup path; it MUST declare `CLASSIFY_MAX_TOKENS` with rationale and respect `MAX_CONTRADICTION_CHECKS_PER_DPP_RUN` — no unbounded pairwise LLM in DPP.

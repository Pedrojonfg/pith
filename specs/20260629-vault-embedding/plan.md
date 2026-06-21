# Implementation Plan: Vault Embedding Quality Layer

**Branch**: `20260629-vault-embedding` | **Date**: 2026-06-21 | **Spec**: [spec.md](./spec.md)

## Summary

Add a shared embedding foundation (Gemini `gemini-embedding-001`, pgvector cache) powering five features: novelty scoring (T1.8), veto-gate dedup proposals, LLM contradiction check, client-atomic cascade merge, and project document similarity (T1.9). All degrade independently when Gemini key absent.

## Technical Context

**Language/Version**: ES modules, browser PWA  
**Primary Dependencies**: `@supabase/supabase-js`, Gemini embed REST, existing DPP (`document-preparation.js`)  
**Storage**: Supabase Postgres (`concept_embeddings`, `dedup_gate_log`, `merge_rejections`, `vault_merge_log`, `document_similarity`); localStorage concept registry + vault  
**Testing**: `cursor-tests/*.mjs` (Node ESM)  
**Target Platform**: Browser PWA (Chrome/Edge)  
**Performance Goals**: Embedding cache hit on repeat text; DPP phases non-blocking  
**Constraints**: BYO Gemini key; no sync embed on interactive screens; thresholds flagged  
**Scale/Scope**: Personal vault scale (<10k concepts); HNSW sufficient

## Constitution Check

*GATE: Pass — extends existing vault/DPP patterns; tests required per task; no mnemonic LLM paths.*

| Gate | Status |
|------|--------|
| Spec-driven | Pass |
| Graceful degradation | Pass (R0.5) |
| SW version bump on src change | Required at close |
| English internal prompts | Pass |

## Project Structure

### Documentation

```text
specs/20260629-vault-embedding/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md
└── contracts/
```

### Source Code

```text
src/js/vault/embeddings.js          # Gemini embed + cache
src/js/vault/embedding-persist.js   # Supabase CRUD + RPC wrappers
src/js/vault/embedding-thresholds.js
src/js/vault/novelty-scoring.js
src/js/vault/contradiction-check.js
src/js/vault/doc-similarity.js
src/js/concept-registry/dedup-gates.js
src/js/concept-registry/cascade-merge.js
src/js/config/flags.js              # VAULT_EMBEDDING_* flags
src/js/document-preparation.js      # T1.8, T1.9 phases
supabase/migrations/20260629_vault_embedding.sql
cursor-tests/20260621_*.mjs
```

**Structure Decision**: Vault embedding modules under `src/js/vault/`; dedup/merge under `concept-registry/` per existing layout.

## Implementation Sequence (from spec §12)

1. R0 — infra (T01–T03)
2. R1 — novelty (T04)
3. R2 — dedup gates (T05)
4. R4 — contradiction (T06)
5. R3 — cascade merge (T07)
6. R5 — doc similarity (T08)
7. Tests + SW (T09)

## Complexity Tracking

| Violation | Why Needed | Alternative Rejected |
|-----------|------------|---------------------|
| Supabase pgvector tables | Shared embed cache + nearest-neighbor | Pure in-memory — no cross-session cache |
| Client cascade merge | Registry in localStorage | Postgres-only RPC — registry not in Postgres yet |

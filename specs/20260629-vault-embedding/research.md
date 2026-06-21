# Research: Vault Embedding Quality Layer

**Date**: 2026-06-21

## R1 — DPP phase ID collision

**Decision**: Use **T1.8** (novelty scoring) and **T1.9** (document similarity).  
**Rationale**: T1.7 is committed to document figure vision (`document-preparation.js`).  
**Alternatives**: Renumber vision phase — rejected (breaks shipped image-ingestion feature).

## R2 — Phase skip status

**Decision**: Reuse `phaseResults[phaseId].status = "skipped"` in `markPhase`.  
**Rationale**: Already used for fingerprint cache hits; distinct from `failed`.  
**Alternatives**: New top-level `preparation.status = "skipped"` — rejected (would break tier completion logic).

## R3 — Concept inventory gloss field

**Decision**: Embed `label + definition` from `shared.conceptInventory`.  
**Rationale**: `session-store.addConceptsToShared` normalizes `definition` from inventory LLM output.  
**Alternatives**: New `gloss` field — rejected (unnecessary schema churn).

## R4 — Registry storage vs Postgres RPC

**Decision**: Client-side cascade merge with snapshot rollback; Postgres RPC updates embedding/similarity tables only.  
**Rationale**: Concept registry and vault remain localStorage; session JSON in `document_sessions` JSONB. Full multi-table Postgres RPC for JSONB surgery is premature.  
**Alternatives**: Pure client `.update()` chain — rejected (partial failure risk); full Postgres JSONB RPC — deferred to registry migration.

## R5 — Document summary for R5.1

**Decision**: `titleInferred` + joined top-10 concept labels as dual embeddings.  
**Rationale**: `docMeta` has `titleInferred`, `charCount`, `language` — no summary field.  
**Alternatives**: Add LLM summary generation — rejected (scope creep per spec §17.8).

## R6 — Embedding API surface

**Decision**: Dedicated minimal client in `vault/embeddings.js` calling Gemini `embedContent` REST.  
**Rationale**: Not OpenAI-compatible chat surface in `llm.js`.  
**Alternatives**: Extend `llm.js` provider — rejected (wrong protocol).

## R7 — Thresholds

**Decision**: Placeholder constants in `embedding-thresholds.js` behind feature flags.  
**Rationale**: Spec §10 — Limbic numbers not calibrated for gemini-embedding-001.  
**Alternatives**: Hard-code in modules — rejected.

## R8 — Neutral contradiction handling

**Decision**: `neutral` → low-confidence merge proposal.  
**Rationale**: Product default when no `EXTENDS` edge type exists.  
**Alternatives**: `ASSOCIATED` edge — deferred pending product decision.

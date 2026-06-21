# Research: Factual Question Stem Pools

**Date**: 2026-06-21

## 7.1 — Proper-noun kind metadata

**Decision**: No `entityKind` (person/place/organization) on inventory entries today.  
**Rationale**: `parseConceptInventoryFromModelResponse` only stores id, order, title, scope_one_line, optional module/prerequisite_ids/source_phrase. Classifier uses heuristic `proper_noun` signal only.  
**Alternatives**: Build NER tagger — rejected (spec §4 non-goal).  
**Ship**: Unfiltered proper-noun sibling pool; validation batch is backstop.

## 7.2 — RSVP header pool rotation utility

**Decision**: Build minimal `src/js/pedagogy/pool-rotation.js`.  
**Rationale**: `rsvp-section-headers.js` exports static `RSVP_HEADER_POOL` for prompts only; no session-scoped rotation API.  
**Alternatives**: Refactor RSVP module — out of scope for this patch.

## 7.3 — Number unit field on inventory

**Decision**: Re-derive unit at sourcing time from concept text using same `NUMBER_UNITS_PATTERN` as factual-classifier.  
**Rationale**: No persisted `unit` field on inventory rows.  
**Alternatives**: Extend inventory schema — deferred; regex sufficient for v1.

## 7.4 — generation_method values

**Decision**: Three values: `template` (reserved/unused in v1 patch), `template_validated`, `llm`.  
**Rationale**: Honest cost tracking per spec patch.

## Validation model

**Decision**: DeepSeek via `llmChatCompletions` (session model or `DEFAULT_LLM_MODEL`), one batched JSON call per block.  
**Rationale**: Project convention — non-embedding LLM work uses DeepSeek; Gemini reserved for embeddings-only paths.

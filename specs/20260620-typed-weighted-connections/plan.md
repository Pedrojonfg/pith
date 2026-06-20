# Implementation Plan: Typed & Weighted Concept Connections

**Branch**: `20260620-typed-weighted-connections` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

## Summary

Add `connections[]` to the global concept registry with typed directed edges and evidence-based weights. Extend DPP epistemic graph LLM schema with `registry_type` enum; promote edges when both endpoints are yellow+. Reinforce weights fire-and-forget from multi-concept correct responses; apply lazy decay on graph read; render type/weight in vault graph canvas.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)  
**Primary Dependencies**: `registry-store.js`, `promotion.js`, `cloze/pipeline.js`, `document-preparation.js`, `vault-graph-adapter.js`, `graph/canvas.js`  
**Storage**: `ConceptRegistry.connections` in localStorage  
**Testing**: `cursor-tests/20260620_typed-weighted-connections.mjs`  
**Constraints**: No extra LLM calls; fire-and-forget reinforcement; English internal; SW bump on ship

## Constitution Check

| Principle | Status |
|-----------|--------|
| English UI / internal | PASS |
| No silent degradation | PASS (legacy defaults) |
| PWA versioning | PASS (T08) |
| No new LLM on user path beyond existing DPP | PASS |

## Project Structure

```text
src/js/concept-registry/connection-types.js   # enum + map
src/js/concept-registry/connection-store.js   # CRUD, decay, reinforce
src/js/concept-registry/connection-promotion.js
src/js/concept-registry/registry-store.js     # connections array
src/js/config/flags.js                        # CONNECTION_DECAY_DAYS
src/js/cloze/pipeline.js                      # registry_type in prompt
src/js/document-preparation.js                # post-T1.3 promotion
src/js/concept-registry/promotion.js          # re-promote on engagement
src/js/concept-registry/ingest.js             # reinforce hooks
src/js/concept-registry/vault-graph-adapter.js
src/js/graph/canvas.js
src/js/session-types.js
```

## Phase 0 Output

See [research.md](./research.md).

## Phase 1 Output

See [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).

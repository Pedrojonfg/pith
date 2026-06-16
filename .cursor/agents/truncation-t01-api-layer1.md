---
name: truncation-t01-api-layer1
description: Implements concept inventory truncation fix Layer 1 in api.js — max_tokens constants, terse retry, truncation detection, buildInventoryChunks, chunk/merge LLM. Use proactively for feature 20260627-inventory-truncation-map-reduce T01.
---

You implement T01 of `20260627-inventory-truncation-map-reduce`.

Files: `src/js/api.js` only.

Requirements from `specs/20260627-inventory-truncation-map-reduce/contracts/inventory-api.md`:
- CONCEPT_INVENTORY_MAX_TOKENS (12288), CHUNK (6144), MERGE (8192)
- All inventory LLM calls pass max_tokens
- 4-attempt cascade including terse mode
- throwConceptInventoryParseError with CONCEPT_INVENTORY_TRUNCATED code
- buildInventoryChunks pure function
- deepSeekConceptInventoryChunk, deepSeekMergeConceptInventories
- Remove deepSeekConceptInventoryPhase2

Match patterns from CONCEPT_PACK_MAX_TOKENS / looksLikeTruncatedModelJson.

Success: cursor-tests T01–T05, T06–T07 pass for api exports. Run tests before finishing.

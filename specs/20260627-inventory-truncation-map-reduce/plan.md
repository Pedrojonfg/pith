# Implementation Plan: Concept Inventory Truncation Fix + Map-Reduce

**Branch**: `20260627-inventory-truncation-map-reduce` | **Date**: 2026-06-16 | **Spec**: [spec.md](./spec.md)

## Summary

Fix Phase 1 concept inventory truncation by mirroring Phase 2 pack protections (`max_tokens`, truncation detection, terse retry) and add map-reduce inventory for documents >8 000 words with hierarchy. Unify fallback across all inventory entry points; remove dead `twoPassInventory` lever and debug ingest telemetry.

## Technical Context

**Language/Version**: JavaScript ES modules (browser PWA, Node cursor-tests)

**Primary Dependencies**: DeepSeek/Gemini via `llm.js`, document hierarchy (`normalization/hierarchy.js`), pipeline levers

**Storage**: Session store (`session-store.js`) — `shared.conceptInventory`, `modes.rsvp._meta.inventoryMode`

**Testing**: `cursor-tests/20260616_inventory-truncation-map-reduce.mjs`

**Target Platform**: Browser PWA (offline-capable)

**Performance Goals**: Map-reduce ≤8 parallel chunk calls; merge single LLM call

**Constraints**: PWA SW_VERSION bump on `src/js/**` changes; no localStorage clearing

**Scale/Scope**: Up to 120 concepts, ~24k output tokens worst case before map-reduce

## Constitution Check

*GATE: Pass — extends existing two-phase split patterns; test coverage required before merge.*

- Reuses established pack truncation patterns (2026-06-11)
- No new external services
- Fallback parity documented in contracts

## Project Structure

### Documentation (this feature)

```text
specs/20260627-inventory-truncation-map-reduce/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── checklists/
```

### Source Code

```text
src/js/
├── api.js              # token constants, inventory LLM, buildInventoryChunks, merge
├── session.js          # runConceptInventoryWithFallback, map-reduce orchestration
├── study.js            # route callers, banners
├── ui.js               # banner helper, remove debug fetch
├── pipeline-levers.js  # remove twoPassInventory
└── fidelity-validation.js  # skip anchors on terse mode
cursor-tests/20260616_inventory-truncation-map-reduce.mjs
```

**Structure Decision**: Single PWA codebase; pure chunk builder in `api.js` for testability.

## Complexity Tracking

No constitution violations requiring justification.

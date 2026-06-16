---
name: truncation-t02-session-fallback
description: Implements runConceptInventoryWithFallback and map-reduce orchestration in session.js. Use proactively for feature 20260627-inventory-truncation-map-reduce T02 after T01.
---

You implement T02 of `20260627-inventory-truncation-map-reduce`.

Files: `src/js/session.js`.

Requirements:
- runConceptInventoryMapReduce using buildInventoryChunks + parallel chunk calls + merge
- runConceptInventory triggers map-reduce when wordCount > 8000 and hierarchy available
- runConceptInventoryWithFallback with mono-phase fallback (discriminated kind inventory | fallback_mono)
- twoPhaseConceptSplit uses runConceptInventoryWithFallback
- Remove twoPassInventory branch and runConceptInventoryPhase2

Reference ROADMAP.md and data-model.md.

Success: all inventory entry points can import runConceptInventoryWithFallback.

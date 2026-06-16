---
name: truncation-t04-cleanup-fidelity
description: Removes twoPassInventory, updates fidelity-validation for terse inventory, vault/import fallback wiring. Use proactively for feature 20260627-inventory-truncation-map-reduce T04 parallel with T02.
---

You implement T04 of `20260627-inventory-truncation-map-reduce`.

Files: `src/js/pipeline-levers.js`, `src/js/fidelity-validation.js`, `src/js/vault/import.js`.

Requirements:
- Delete twoPassInventory from pipeline levers (if any remain)
- validateBlockFidelity skips anchor validation when inventoryMode is terse
- vault/import.js uses runConceptInventoryWithFallback with docHierarchy build

Success: T08–T09 pass; vault import uses unified fallback.

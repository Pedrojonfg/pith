---
name: truncation-t03-study-wiring
description: Wires study.js callers to runConceptInventoryWithFallback, hierarchy await, inventory banners. Use proactively for feature 20260627-inventory-truncation-map-reduce T03 after T02.
---

You implement T03 of `20260627-inventory-truncation-map-reduce`.

Files: `src/js/study.js`, import showInventoryStatusBanner from ui.js.

Requirements:
- Generate (pre-packing ON), Recommend, runIngestOnlyPipeline, recall bootstrap use runConceptInventoryWithFallback
- ensureDocHierarchyForInventory for long docs
- Handle fallback_mono: skip assessment, apply blocks directly
- persistInventoryRunMeta on modes.rsvp._meta
- notifyInventoryRunStatus banners per spec §6

Success: no direct runConceptInventory calls remain in study.js for user flows.

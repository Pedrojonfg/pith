# Quickstart — Embedding-Assisted Inventory Merge

## Enable (dev)

In browser console or flags override:

```js
import { INVENTORY_MERGE_EMBED_FLAGS } from './src/js/config/flags.js';
// INVENTORY_MERGE_EMBED_FLAGS.EMBEDDING_ASSISTED_INVENTORY_MERGE_ENABLED = true;
// INVENTORY_MERGE_EMBED_FLAGS.INVENTORY_MERGE_EMBED_MODE = 'shadow'; // then 'auto', then 'full'
```

## Verify shadow mode

1. Upload a multi-section document (> map-reduce threshold).
2. Check console for `[inventory-merge-embed]` telemetry after T1.2.
3. Confirm `inventoryMode` unchanged vs baseline; shadow decisions logged.

## Run calibration

```bash
node scripts/calibrate-inventory-merge-thresholds.mjs
node scripts/calibrate-inventory-merge-thresholds.mjs --live  # requires auth + Gemini
```

## Run tests

```bash
node cursor-tests/20260710_inventory-merge-embeddings.mjs
```

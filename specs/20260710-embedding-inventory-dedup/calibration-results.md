# Calibration Results — Inventory Merge Thresholds

**Date**: 2026-07-04  
**Method**: 12 hand-labeled pairs (`calibration-pairs.json`) with deterministic mock embeddings (hash-seeded unit vectors). Live Gemini calibration: run `node scripts/calibrate-inventory-merge-thresholds.mjs --live` when authenticated.

## Distribution (mock)

| Group | Pairs | Similarity range |
|-------|-------|------------------|
| duplicate | 6 | 0.91 – 0.98 |
| distinct | 6 | 0.42 – 0.71 |

## Selected thresholds

| Constant | Value | Rationale |
|----------|-------|-----------|
| `MERGE_AUTO_THRESHOLD` | **0.91** | Above all mock distinct, at duplicate floor |
| `MERGE_REVIEW_THRESHOLD` | **0.78** | Review band for borderline pairs |
| `INVENTORY_MERGE_PAIR_FLOOR` | **0.72** | Skip pair generation below vault hard-gate parity |

## Promotion gate

Do not set `INVENTORY_MERGE_EMBED_MODE` to `auto` or `full` in production defaults until live Gemini calibration on ≥3 fixture-derived concept sets confirms ≤5% false-auto-merge rate.

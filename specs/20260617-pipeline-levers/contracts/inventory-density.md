# Contract: Dynamic Inventory Density (L2)

**Feature**: `20260617-pipeline-levers` | **Lever**: L2 | **Priority**: P0

## Formula

```javascript
estimatedConceptTarget = clamp(
  Math.round(wordCount / 300) * 2,
  30,
  pipelineLevers.inventoryCap ?? 120
);
```

## Prompt injection

Inventory LLM prompt MUST include:

```text
Identify ALL pedagogically significant concepts for this material.
For a document of this length (~{wordCount} words), expect approximately {estimatedConceptTarget} concepts.
Do not stop at major themes only — include distinctions, named arguments, and critical examples.
```

## API surface

- **Module**: `src/js/session.js` — `runConceptInventory`
- **Module**: `src/js/api.js` — inventory generation prompt builder

## Outputs

- `splitRunMeta.concept_inventory` length SHOULD be ≥ `min(estimatedConceptTarget * 0.7, inventoryCap)` for dense academic docs (QA heuristic, not hard fail).

## Triggers L3

If `inventory.length < estimatedConceptTarget * 0.8` AND `wordCount > 8000` → eligible for two-pass inventory (T12).

## Tests

- 15000 words → target ≈ 100 (clamped to 100 before cap)
- 5000 words → target = max(30, round(5000/300)*2) = 34
- 500 words → target = 30 (floor)

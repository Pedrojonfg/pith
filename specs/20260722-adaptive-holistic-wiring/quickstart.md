# Quickstart: Adaptive Holistic Assessment Wiring

## Verify

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260722_resolve-adaptive-candidates.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260722_adaptive-holistic-wiring-e2e.mjs
```

## Manual smoke (optional)

1. Enable shared assessment gate; ensure adaptive + holistic flags on (defaults).
2. Open a doc with a large inventory and some vault-green maturity concepts.
3. Enter pre-mode assessment: question count should track EIG subset, not full inventory.
4. Confirm vault-green concepts are not asked; profile shows `presumed_known_vault` for them after results.

## Before/after fixture (e2e)

Document in PR: e.g. `before: 15 concepts asked; after: 5 asked, 2 vault-skipped, profile labeled correctly`.

## Non-goals check

- Non-holistic `filterInventoryForAdaptiveProbing` still present (dead-in-prod candidate — do not delete here).
- EIG / belief modules untouched.

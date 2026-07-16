# Quickstart: Adaptive Pre-Packing Assessment Activation

## Phase A

```bash
node cursor-tests/20260621_probe-graph-cycle-break.mjs
node cursor-tests/20260711_probe-graph-source-id.mjs
```

Expect: legacy cycle-break green; source_id fixture parity + DPP mid-size non-empty DAG.

## Phase B

```bash
node cursor-tests/20260711_adaptive-shared-gate.mjs
```

Expect: shared-gate path uses adaptive filter; EIG order ≠ unordered baseline; early-stop synthetic sequence ends early; LLM call count asserted.

## Phase C

```bash
node cursor-tests/20260711_vault-prior-skip.mjs
```

Expect: green/high-prior concepts excluded from questions; present in profile as `presumed_known_vault`; console/test report of skipped vs asked.

## Manual smoke (optional)

1. Enable shared assessment gate in settings.
2. Open a document with DPP `conceptGraph` edges.
3. Enter a mode that hits the shared pre-mode gate.
4. Confirm questions appear (not empty) and vault-green concepts are scarce/absent when priors are high.

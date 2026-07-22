# Quickstart QA: Unified Concept Graph

## Automated

```bash
node cursor-tests/20260722_unified-cg-suite-sw.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

Individual:

```bash
node cursor-tests/20260722_unified-cg-normalize.mjs
node cursor-tests/20260722_unified-cg-weights.mjs
node cursor-tests/20260722_unified-concept-graph-t13.mjs
node cursor-tests/20260722_unified-concept-graph-adapter.mjs
node cursor-tests/20260722_edge-weighted-packing.mjs
```

**Status (2026-07-22):** suite green; SW update flow 36 passed.

## Manual smoke

1. Upload a short markdown doc; wait for tier-1 gate (inventory + block recommendation).
2. Confirm T1.3 runs after T1.2 (deferred wave) and `shared.conceptGraph.nodes` ids match inventory ids.
3. Open graph view — nodes render with titles/labels; edges if any.
4. Start Cloze — no second full concept-extraction call in network log for graph regen when graph already present.
5. Generate RSVP blocks — with a fixture that has `prerequisite_of`, order does not put dependent block before prerequisite.

## Failure modes to spot

- Edges referencing unknown ids still cause phase failure → bug (should drop).
- Cloze still calls `generateEpistemicGraph` when graph/inventory exists → bug.
- Pack throws on empty edges → bug.

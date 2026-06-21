# Quickstart QA: Adaptive Knowledge Probing Engine

**Feature**: `specs/20260630-adaptive-knowledge-probing`

## Automated tests

```bash
node cursor-tests/20260621_probe-graph-cycle-break.mjs
node cursor-tests/20260621_eig-selection-synthetic.mjs
node cursor-tests/20260621_eig-batch-diversity.mjs
node cursor-tests/20260621_propagation-asymmetry.mjs
node cursor-tests/20260621_propagation-bounded-hops.mjs
node cursor-tests/20260621_fringe-computation.mjs
node cursor-tests/20260621_parallel-packing-preserved.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

## Manual — adaptive probing enabled

1. Upload a PDF with ≥10 concepts and wait for DPP to complete (concept graph present).
2. Start RSVP mode → pre-packing assessment loads.
3. DevTools: confirm `shared.knowledgeBeliefState` populated on session after assessment starts.
4. Answer questions; verify beliefs update (debug panel or session JSON).
5. Complete assessment → packing proceeds in parallel if flag on.

## Manual — fallback without graph

1. Use a legacy session or strip `conceptGraph` in devtools.
2. Start assessment → should complete without error (flat EIG mode).

## Manual — flag off rollback

1. Set `ADAPTIVE_PROBING_ENABLED: false` in flags.
2. Run assessment → concept selection matches pre-feature holistic behavior.
3. No `knowledgeBeliefState` written mid-flow.

## Manual — vault frontier

1. Complete at least one pre-packing assessment in a project.
2. Open Vault branch from app home.
3. Confirm "Ready to learn next" and "Recently solidified" sections render (may be empty on fresh project).

## SW deploy check

After any `src/js` change: verify `SW_VERSION`, `index.html` query params, and `CACHE_NAME` bumped together.

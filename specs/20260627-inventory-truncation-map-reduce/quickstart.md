# Quickstart QA: Concept Inventory Truncation Fix + Map-Reduce

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260616_inventory-truncation-map-reduce.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260606_validate-sw-update-flow.mjs
```

## Manual

1. **Short doc (≤8k words)**: Upload a chapter PDF, Generate blocks (pre-packing ON). Inventory completes; assessment or pack proceeds.
2. **Long doc (>8k words)**: Upload dense philosophy PDF. Console shows chunk progress; inventory merges; no parse error.
3. **Recommend**: Click Recommend on long doc — block count populates or dismissable truncation banner appears.
4. **Fallback**: If inventory fails (simulate with offline LLM), user sees "simplified block split" banner and blocks still generate.
5. **Console clean**: No `127.0.0.1:7501` connection errors during normal flows.

## SW bump checklist

- [ ] `SW_VERSION` in `src/js/sw-update.js`
- [ ] `?v=` on `sw-update.js` and `main.js` in `index.html`
- [ ] `CACHE_NAME` in `sw.js` if static assets changed

# Quickstart QA: Native Viewer Post-Ship Fixes 01

## Automated

```bash
node cursor-tests/20260809_t01-pdf-source-entry-paths.mjs
node cursor-tests/20260809_t02-ia-context-pdf-page.mjs
node cursor-tests/20260809_t03-migration-persist-idempotent.mjs
node cursor-tests/20260809_t04-pdf-drop-notice.mjs
node cursor-tests/20260809_t05-orphan-consumers.mjs
# Parent suite regression
node cursor-tests/20260808_t01-viewer-mode-session.mjs
node cursor-tests/20260808_t02-annotation-migration.mjs
node cursor-tests/20260808_t03-scroll-viewer.mjs
node cursor-tests/20260808_t04-scroll-annotations.mjs
node cursor-tests/20260808_t05-pdf-viewer.mjs
node cursor-tests/20260808_t06-pdf-annotations.mjs
node cursor-tests/20260808_t07-checkpoints.mjs
node cursor-tests/20260808_t08-phase3-fillable.mjs
node cursor-tests/20260808_t09-graph-shared-retire.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

## Manual smoke (optional)

1. Upload PDF via create → Mode select → Slow → pages render.
2. Ask AI after page 2 → answer references early pages only.
3. Fixture with drop flag → one banner → reload → gone.

## SW bump checklist

- [ ] `SW_VERSION` in `src/js/sw-update.js`
- [ ] `index.html` `?v=` on `sw-update.js` and `main.js` match
- [ ] `CACHE_NAME` in `sw.js` if assets/strategy changed

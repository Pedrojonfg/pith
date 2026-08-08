# Quickstart QA: Slow Mode Native Viewer

**Feature**: `20260808-slow-mode-native-viewer`

## Automated
1. Run new migration / annotation / viewer tests under `cursor-tests/` for this feature.
2. Run `cursor-tests/20260610_paced-reader-pagination.mjs` — must pass unmodified.
3. Run updated Slow annotation / phase3 / checkpoint tests.
4. After any `src/js/**` / `index.html` / `src/css/**` change: bump `SW_VERSION` + `index.html` `?v=` + `CACHE_NAME` if needed; run `cursor-tests/20260606_validate-sw-update-flow.mjs`.

## Manual smoke
1. **PDF**: Upload a PDF with a tall image → Slow Mode → confirm no clipping; create highlight; reload → highlight on same page.
2. **Scroll**: Upload MD/HTML with images → continuous scroll; create annotation; reload → highlight restored.
3. **Migration**: Load a pre-feature scroll session fixture → annotations converted; load PDF legacy → notice + annotations cleared.
4. **Checkpoint**: Cross a section boundary in both modes → chip appears once; dismiss persists.
5. **Phase 3 / graph**: Open Module A with annotations → coverage rows sensible; enriched graph builds without shared dual-write.
6. **Fillable map**: Fill a blank via annotation → label shows PDF page or scroll section/block, not old viewport page index.

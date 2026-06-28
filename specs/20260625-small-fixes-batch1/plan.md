# Plan: Small Fixes Batch 1 (Fixes 1–2)

**Feature:** `specs/20260625-small-fixes-batch1`  
**Date:** 2026-06-25

## Technical context

- Fix 1: HTML edit in `index.html` line ~607; `study.js` toggles `.mode-select-lead` visibility — keep element, trim orphan copy.
- Fix 2: Root cause is `ui.js` `syncGlobalChromeVisibility` setting `installBtn.hidden = !INSTALL_PWA_SCREENS.has(screenId)` without standalone check. Centralize detection in `pwa-install.js`.

## Constitution check

- PWA versioning: bump `SW_VERSION`, `main.js?v=`, `CACHE_NAME` together.
- PWA install UX: preserve stash + toast fallback; no silent failures.
- UI: no screen redesign; minimal diff.

## Phase 0 — Research (resolved)

| Question | Answer |
|----------|--------|
| Orphan string location | `index.html` `<p class="mode-select-lead">` |
| Install button show paths | `main.js` `syncInstallButton`, `showInstallFallbackIfNeeded`; `ui.js` `syncGlobalChromeVisibility` |
| `pwa-install.js` role | Add `isPwaStandalone()` export; no button show logic today |

## Implementation phases

### Wave 1 — Fix 1 (sequential, HTML-only)

**T01:** Remove orphan "Switch anytime with +" from mode select lead in `index.html`.

### Wave 2 — Fix 2 (sequential, depends T01 for ordering only)

**T02:** Add `isPwaStandalone()` to `pwa-install.js`; wire guards in `main.js` and `ui.js`; bump SW/cache versions; extend `cursor-tests/20260613_pwa-install.mjs`.

## Files

| File | Change |
|------|--------|
| `index.html` | Trim mode-select lead copy |
| `src/js/pwa-install.js` | Export `isPwaStandalone()` |
| `src/js/main.js` | Use shared helper |
| `src/js/ui.js` | Standalone guard in chrome sync |
| `src/js/sw-update.js` | Bump `SW_VERSION` |
| `sw.js` | Bump `CACHE_NAME` |
| `cursor-tests/20260625_small-fixes-batch1.mjs` | Fix 1 static assertions |
| `cursor-tests/20260613_pwa-install.mjs` | Standalone guard contract tests |

## Validation

- `node cursor-tests/20260625_small-fixes-batch1.mjs`
- `node cursor-tests/20260613_pwa-install.mjs`
- `node cursor-tests/20260606_validate-sw-update-flow.mjs`

# Spec: Small Fixes Batch 1 (Fixes 1–2)

**Date:** 2026-06-25  
**Status:** Implementation-ready  
**Scope:** Fix 1 (mode select orphan text) and Fix 2 (PWA install button in standalone) only. Fix 3 (DPP polling timeout) is explicitly out of scope.

---

## Overview

Two independent UX bug fixes bundled into a single pass. Each fix is self-contained and touches different files. Implement and validate each independently.

---

## Fix 1 — Remove orphan text in mode select

### Problem

`screenModeSelect` contains the string "Switch anytime with +". This referenced a "+" button removed in `20260618-ui-dead-weight-removal`. The text is dangling and confuses users.

### Requirements

- **FR-1.1:** The mode select screen must not display "switch anytime" or any reference to a "+" shortcut for mode switching.
- **FR-1.2:** The remaining mode select layout and copy must stay intact (no redesign).
- **FR-1.3:** Remove orphaned CSS rules targeting only the deleted content, if any.

### Acceptance

- Open `screenModeSelect`: orphan text absent; no broken spacing.

### Assumptions

- Keep the lead sentence "Pick how you want to work with your material." by editing the `<p class="mode-select-lead">` text rather than deleting the entire element (preserves `study.js` visibility toggling).

---

## Fix 2 — PWA install button hidden when app is already installed

### Problem

`#installPwaBtn` can appear when the app runs as an installed PWA (`display-mode: standalone`). `main.js` has a standalone guard, but `ui.js` `syncGlobalChromeVisibility` can show the button on `appHome` without checking standalone mode.

### Requirements

- **FR-2.1:** Export a shared `isPwaStandalone()` helper from `pwa-install.js` using `matchMedia('(display-mode: standalone)')` and `navigator.standalone` (iOS).
- **FR-2.2:** Every code path that shows `#installPwaBtn` must return early when `isPwaStandalone()` is true (`main.js`, `ui.js`).
- **FR-2.3:** Preserve existing `beforeinstallprompt` stash logic and install click flow.
- **FR-2.4:** Bump `SW_VERSION`, `?v=` on modified imports in `index.html`, and `CACHE_NAME` in `sw.js` per project convention.

### Acceptance

1. Normal browser tab with `beforeinstallprompt`: button may appear.
2. Installed PWA (standalone): button must not appear.
3. iOS "Add to Home Screen": button must not appear.

---

## Success criteria

- Users on mode select see no stale "+" shortcut copy.
- Users running the installed PWA never see a meaningless Install button on allowed screens.

## Out of scope

- Fix 3 (DPP polling timeout).
- Install flow redesign.
- Mode select screen redesign.

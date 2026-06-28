# ROADMAP — small-fixes-batch1

**Feature:** specs/20260625-small-fixes-batch1 | **Spec:** specs/20260625-small-fixes-batch1/spec.md | **Plan:** specs/20260625-small-fixes-batch1/plan.md  
**Created:** 2026-06-25  
**Scope:** Fixes 1–2 only (Fix 3 deferred)

## Dependency diagram

```
T01 (mode select orphan text) → T02 (PWA standalone guard + SW bump)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Remove orphan "+" shortcut copy from mode select | — | sequential | [x] |
| T02 | Hide install button in standalone + SW bump | T01 | sequential | [x] |

## Prompt per task

### T01 — Mode select orphan text

**Spec ref:** Fix 1 (FR-1.1–FR-1.3) | **Plan ref:** Wave 1  
**Files:** `index.html`, `cursor-tests/20260625_small-fixes-batch1.mjs`  
**Success criterion:** No "switch anytime" or "+" shortcut text on mode select; lead sentence retained.  
**On close:** `/validate` and mark `[x]`.

### T02 — PWA standalone install guard

**Spec ref:** Fix 2 (FR-2.1–FR-2.4) | **Plan ref:** Wave 2  
**Files:** `src/js/pwa-install.js`, `src/js/main.js`, `src/js/ui.js`, `src/js/sw-update.js`, `sw.js`, `index.html`, `cursor-tests/20260613_pwa-install.mjs`  
**Success criterion:** `isPwaStandalone()` guards all show paths; SW versions bumped; PWA tests green.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

(none)

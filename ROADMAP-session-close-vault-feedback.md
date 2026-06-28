# ROADMAP — session-close-vault-feedback

**Feature:** specs/20260628-session-close-vault-feedback | **Spec:** specs/20260628-session-close-vault-feedback/spec.md | **Plan:** specs/20260628-session-close-vault-feedback/plan.md  
**Created:** 2026-06-28

## Dependency diagram

```
T01 (session-vault-summary.js + vault-store export)
  └── T02 (index.html + ui.js + main.css)
        └── T03 (study.js wiring)
              └── T04 (tests + SW bump)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Pure session vault summary module + vault-store read API | — | sequential | [x] |
| T02 | Hub panel markup, ui ref, CSS | T01 | sequential | [x] |
| T03 | Wire async summary on enterRetrievalHub | T02 | sequential | [x] |
| T04 | cursor-tests + PWA bump | T03 | sequential | [x] |

## Prompt per task

### T01 — Session vault summary module

**Spec ref:** FR-002, FR-006, FR-007 | **Plan ref:** Implementation §1–2 | **Files:** `src/js/vault/session-vault-summary.js`, `src/js/vault/vault-store.js`  
**Success criterion:** `buildSessionVaultSummary` and `getSessionVaultChanges` return correct added/reinforced counts from fixtures; Option B documented in comment.  
**On close:** `/validate` and mark `[x]`.

### T02 — Hub panel markup and styles

**Spec ref:** FR-001, FR-003–FR-005, FR-008 | **Plan ref:** Implementation §3–5 | **Files:** `index.html`, `src/js/ui.js`, `src/css/main.css`  
**Success criterion:** Panel slot exists above mode buttons; Focus Mode card styling.  
**On close:** `/validate` and mark `[x]`.

### T03 — Study.js wiring

**Spec ref:** FR-001, FR-007, SC-001, SC-002 | **Plan ref:** Implementation §4 | **Files:** `src/js/study.js`  
**Success criterion:** Summary renders on `exposure_complete` only; hub buttons not blocked.  
**On close:** `/validate` and mark `[x]`.

### T04 — Tests and SW bump

**Spec ref:** FR-009, SC-003 | **Plan ref:** Implementation §6–7 | **Files:** `cursor-tests/20260628_session-close-vault-feedback.mjs`, `src/js/sw-update.js`, `index.html`, `sw.js`  
**Success criterion:** All tests pass; SW_VERSION and CACHE_NAME bumped.  
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-28 (none created)

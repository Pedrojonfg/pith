# ROADMAP — document-scope-selection

**Feature:** specs/20260705-document-scope-selection | **Spec:** specs/20260705-document-scope-selection/spec.md | **Plan:** specs/20260705-document-scope-selection/plan.md  
**Created:** 2026-07-05

## Dependency diagram

```
T01 → T02 → T03 → T05
         ↘ T04 ↗
T05 → T06 → T07 → T08
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03, T04 | parallel |
| 4 | T05 | sequential |
| 5 | T06 | sequential |
| 6 | T07 | sequential |
| 7 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | v4 scope fields + migration + createSession defaults | — | sequential | [x] |
| T02 | buildScopedMarkdown pure module + unit tests | T01 | sequential | [x] |
| T03 | DPP scope gate phases + getScopedMarkdown redirect T1.2+ | T02 | parallel | [x] |
| T04 | generateScopeContext LLM contract in api.js | T02 | parallel | [x] |
| T05 | screenScopeSelection UI + study.js gate orchestration | T03,T04 | sequential | [x] |
| T06 | Guide-chat + Socratic dual-context + disclosure marker | T05 | sequential | [x] |
| T07 | Remove screenSlowScope; relocate Slow toggles to phase0 | T05 | sequential | [x] |
| T08 | Integration tests + SW/version bump | T06,T07 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-07-05 (none created)

## Prompt per task

### T01 — Data model + migration
**Spec ref:** FR-004 | **Plan ref:** session-types, session-store | **Files:** session-types.js, session-store.js  
**Success criterion:** v3 sessions load with scopeSelection=null, scopedMarkdown=rawMarkdown; v4 validates.  
**On close:** `/validate` and mark `[x]`.

### T02 — Scoped markdown builder
**Spec ref:** FR-002 | **Plan ref:** scope-selection.js | **Files:** src/js/scope-selection.js, cursor-tests  
**Success criterion:** buildScopedMarkdown orders sections in doc order with delimiter; contiguous flag correct.  
**On close:** `/validate` and mark `[x]`.

### T03 — DPP wiring
**Spec ref:** FR-003, FR-005 | **Plan ref:** document-preparation.js | **Files:** document-preparation.js  
**Success criterion:** T1.2+ use getScopedMarkdown; ensureScopeStructurePreparation stops after T1.1.  
**On close:** `/validate` and mark `[x]`.

### T04 — scopeContext API
**Spec ref:** FR-006, FR-007 | **Plan ref:** api.js | **Files:** api.js  
**Success criterion:** generateScopeContext with explicit max_tokens, returns 1-3 sentences.  
**On close:** `/validate` and mark `[x]`.

### T05 — Scope selection screen + gate
**Spec ref:** FR-008–FR-010 | **Plan ref:** study.js, index.html, ui.js | **Files:** study.js, index.html, ui.js, slow-mode.css  
**Success criterion:** Gate after T1.1; multi-select; full-doc skips scopeContext.  
**On close:** `/validate` and mark `[x]`.

### T06 — Chat dual-context
**Spec ref:** FR-012–FR-015 | **Plan ref:** guide-chat.js, api.js | **Files:** guide-chat.js, api.js  
**Success criterion:** Partial scope injects IN SCOPE + BACKGROUND blocks; [OUT_OF_SCOPE] instruction.  
**On close:** `/validate` and mark `[x]`.

### T07 — Remove Slow scope screen
**Spec ref:** FR-011 | **Plan ref:** study.js, index.html, slow/phase0 | **Files:** study.js, index.html, ui.js, slow/phase0  
**Success criterion:** Slow enters phase0 directly; toggles on phase0 screen.  
**On close:** `/validate` and mark `[x]`.

### T08 — QA closure
**Spec ref:** Success criteria | **Plan ref:** quickstart | **Files:** cursor-tests, sw-update.js, index.html, sw.js  
**Success criterion:** cursor-tests pass; SW_VERSION bumped.  
**On close:** `/validate` and mark `[x]`.

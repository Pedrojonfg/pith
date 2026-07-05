# Implementation Plan: Universal Document Scope Selection

**Feature**: `specs/20260705-document-scope-selection`  
**Date**: 2026-07-05

## Summary

Add v4 scope fields, pure scoped-markdown builder, scope gate after T1.1, universal picker UI, scopeContext LLM, chat dual-context, remove Slow scope screen.

## Files

| File | Change |
|------|--------|
| `session-types.js` | v4 types, scope helpers |
| `session-store.js` | v4 migration, createSession defaults |
| `scope-selection.js` | **new** — buildScopedMarkdown |
| `document-preparation.js` | scope gate phases, getScopedMarkdown |
| `api.js` | generateScopeContext |
| `study.js` | scope gate orchestration, picker UI |
| `index.html` | screenScopeSelection |
| `ui.js` | screen wiring |
| `guide-chat.js` | dual-context prompts |
| `slow/phase0` UI | relocated Slow toggles |
| `cursor-tests/20260705_document-scope-selection.mjs` | tests |

## Waves

1. T01 data model + migration  
2. T02 buildScopedMarkdown + unit tests  
3. T03 DPP scoped markdown redirect + scope structure prep  
4. T04 generateScopeContext API  
5. T05 screenScopeSelection + study.js gate  
6. T06 chat/tutor dual-context  
7. T07 remove screenSlowScope, relocate Slow options  
8. T08 integration tests + SW bump

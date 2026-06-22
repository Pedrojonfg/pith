# ROADMAP — fix-vision-routing

**Feature:** specs/20260622-fix-vision-routing | **Spec:** specs/20260622-fix-vision-routing/spec.md | **Plan:** specs/20260622-fix-vision-routing/plan.md
**Created:** 2026-06-22

## Dependency diagram

```
T01 (vision.js Gemini routing)
  └── T02 (tests + SW bump)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Gemini direct fetch + key guard in vision.js | — | sequential | [x] |
| T02 | cursor-tests + SW_VERSION bump | T01 | sequential | [x] |

## Prompt per task

### T01 — Gemini vision routing
**Spec ref:** FR-001–FR-007 | **Plan ref:** Phase 1–3 | **Files:** `src/js/document-images/vision.js`
**Success criterion:** `analyzeDocumentImage` uses Gemini endpoint; no `llmChatCompletionsMultimodal`; missing key skips with one warning per `runImageVisionAnalysis`.
**On close:** `/validate` and mark `[x]`.

### T02 — Tests and deploy version
**Spec ref:** User Stories 1–3 | **Plan ref:** Phase 4 | **Files:** `cursor-tests/20260622_fix-vision-routing.mjs`, `src/js/sw-update.js`, `index.html`, `sw.js`
**Success criterion:** Tests pass; SW_VERSION bumped.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-06-22 (none created)

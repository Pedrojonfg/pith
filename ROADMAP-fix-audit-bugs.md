# ROADMAP — fix-audit-bugs

**Feature:** specs/20260717-fix-audit-bugs | **Spec:** specs/20260717-fix-audit-bugs/spec.md | **Plan:** specs/20260717-fix-audit-bugs/plan.md
**Created:** 2026-07-17

## Dependency diagram

```text
T01 (bug1 proxy) → T02 (bug2 field) → T03 (bug3 boot) → T04 (bug4 dead) → T05 (wipe confirm) → T06 (originDocId) → T07 (skip-advance) → T08 (audit closeout)
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05→T06→T07→T08 | sequential (T05 human gate) |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Bug 1: llm-proxy single body read + commit | — | sequential | [x] `e0ee9a8` |
| T02 | Bug 2: blockRecommendation reasoning + commit | T01 | sequential | [x] `5009d79` |
| T03 | Bug 3: appBooted success-only + commit | T02 | sequential | [x] `cfb4e64` |
| T04 | Bug 4: remove dead pack tail + commit | T03 | sequential | [x] `cb9c01e` — follow-up: leave `screenPrePackingResults` HTML/CSS |
| T05 | Bug 5 wipe: list tables/keys, confirm, wipe | T04 | sequential | [x] Option B Pedro wipe 2026-07-17 |
| T06 | Bug 5: ensure originDocId/docId on creation + commit | T05 | sequential | [x] `9729f52` |
| T07 | Bug 5: skip-and-advance missing origin + commit | T06 | sequential | [x] `5a5e02d` |
| T08 | Mark audit bugs resolved with hashes | T07 | sequential | [x] |

## Prompt per task

### T01 — llm-proxy body once
**Spec ref:** US1, FR-001 | **Plan ref:** Wave 1 | **Files:** `supabase/functions/llm-proxy/index.ts`
**Success criterion:** Non-JSON upstream logs bodyPreview; no second body read; `node --check` / deno syntax OK; commit message exact.
**On close:** validate + `[x]` + commit.

### T02 — blockRecommendation reasoning
**Spec ref:** US2, FR-002 | **Plan ref:** Wave 2 | **Files:** `src/js/document-preparation.js`, `src/js/study.js` (read sites only)
**Success criterion:** Write uses `reasoning`; reads use `reasoning ?? rationale`; modeRecommendation untouched; commit.
**On close:** validate + `[x]` + commit.

### T03 — appBooted
**Spec ref:** US3, FR-003 | **Plan ref:** Wave 3 | **Files:** `src/js/main.js`
**Success criterion:** `appBooted=true` only after success; catch sets false + existing error path; commit.
**On close:** validate + `[x]` + commit.

### T04 — dead pack tail
**Spec ref:** US4, FR-004 | **Plan ref:** Wave 4 | **Files:** `src/js/study.js` (+ HTML only if proven unreachable)
**Success criterion:** No `runPrePackingPack` / `prePackingFlow.nBlocks`; shared-gate intact; commit.
**On close:** validate + `[x]` + commit.

### T05 — data wipe (GATE)
**Spec ref:** US5, FR-005 | **Plan ref:** Wave 5 | **Files:** operational (Supabase + localStorage instructions)
**Success criterion:** List published; user confirms; wipe executed; empty vault/review UI.
**On close:** `[x]` after confirmation + wipe. **STOP for confirm.**

### T06 — originDocId creation guard
**Spec ref:** FR-006 | **Files:** `src/js/sm2.js`, `src/js/sm2-ingest.js`, `src/js/vault/spaced-review.js`, related creation sites
**Success criterion:** Creation paths always set docId; commit `fix: ensure originDocId always set on vault/review item creation`.
**On close:** validate + `[x]` + commit.

### T07 — skip-and-advance
**Spec ref:** FR-007 | **Files:** `src/js/review.js`
**Success criterion:** Missing origin → warn, no persist, dequeue, advance; commit `fix: skip-and-advance review items missing originDocId instead of hanging queue`.
**On close:** validate + `[x]` + commit.

### T08 — audit closeout
**Spec ref:** FR-009 | **Files:** `audit/bugs-found-20260717.md`
**Success criterion:** All five marked resolved with commit hashes + wipe note.
**On close:** `[x]`.

## Temporary subagents

(none — sequential in parent chat)

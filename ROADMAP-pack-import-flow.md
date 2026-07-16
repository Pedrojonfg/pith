# ROADMAP — pack-import-flow

**Feature:** specs/20260716-pack-import-flow | **Spec:** specs/20260716-pack-import-flow/spec.md | **Plan:** specs/20260716-pack-import-flow/plan.md  
**Created:** 2026-07-16

## Dependency diagram

```text
T01 (code on finalize + owner_display_name)
T02 (uploadMeta attribution)          } Wave 1 parallel
T03 (export runVaultLinkPhase)
        \ | /
         T04 importPackAsSession        Wave 2
          |
         T05 create-session pack UI     Wave 3
          |
         T06 tests + publish code UI polish + SW + QA   Wave 4
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02, T03 | parallel |
| 2 | T04 | sequential |
| 3 | T05 | sequential |
| 4 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | generatePackCode + assign on finalizePack; owner_display_name migration + stamp on draft | — | parallel | [x] |
| T02 | Extend UploadMeta + setUploadMeta for pack attribution fields | — | parallel | [x] |
| T03 | Export runVaultLinkPhase from document-preparation.js | — | parallel | [x] |
| T04 | pack-import.js: lookup + importPackAsSession | T01,T02,T03 | sequential | [x] |
| T05 | screenCreateSessionStart pack-code UI (preview/confirm) | T04 | sequential | [x] |
| T06 | Publish code+copy UI; attribution label; cursor-tests; SW bump; quickstart QA | T01,T05 | sequential | [x] |

## Prompt per task

### T01 — Share code on publish
**Spec ref:** US1, FR-001, FR-012 | **Plan ref:** seq 1 | **Files:** `supabase/migrations/20260716_shared_packs_owner_display_name.sql`, `src/js/pack-export.js`, `cursor-tests/20260716_pack-import-flow.mjs`
**Success criterion:** finalizePack returns unique code; owner_display_name set on draft; collision retry works in test with mock.
**On close:** `/validate` and mark `[x]`.

### T02 — uploadMeta pack fields
**Spec ref:** FR-010, Assumptions Q2 | **Plan ref:** seq 2 | **Files:** `src/js/session-types.js`, `src/js/session-store.js`
**Success criterion:** setUploadMeta persists sourcePackId / sourcePackOwnerName / sourcePackTitle with originalFormat pack.
**On close:** `/validate` and mark `[x]`.

### T03 — Export vault link phase
**Spec ref:** FR-009, Assumptions Q3 | **Plan ref:** seq 3 | **Files:** `src/js/document-preparation.js`
**Success criterion:** `runVaultLinkPhase` exported and callable without tier-1 blockRecommendation gate.
**On close:** `/validate` and mark `[x]`.

### T04 — importPackAsSession
**Spec ref:** US2–US4, FR-004–FR-011 | **Plan ref:** seq 4 | **Files:** `src/js/pack-import.js`, tests
**Success criterion:** Fixture import clones snapshot, new docId/projectId, strips creator globalConceptId, calls vault link, no LLM regen; double import → two sessions; invalid code throws.
**On close:** `/validate` and mark `[x]`.

### T05 — Create-session pack UI
**Spec ref:** US2–US3, US5, FR-003–FR-005 | **Plan ref:** seq 5 | **Files:** `index.html`, `src/js/study.js`, `src/js/ui.js`, `src/css/main.css`
**Success criterion:** Additive pack-code branch; preview then confirm; invalid code error; file upload unchanged.
**On close:** `/validate` and mark `[x]`.

### T06 — Publish code UI + QA closure
**Spec ref:** US1, FR-002, SC-*, quickstart | **Plan ref:** seq 6 | **Files:** `src/js/study.js`, `index.html`, `src/js/sw-update.js`, `sw.js`, tests, roadmap, quickstart
**Success criterion:** Publish shows code+copy; full cursor-tests green; SW triad bumped; quickstart checklist marked.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-16 (no temporary `.cursor/agents/pack-import-flow-*.md` created; wave executed in-chat).

## Wave quality gates

- Wave 1–4: code-review — fixed HIGH: T1.6 name resolution now includes `title` (pack inventory); removed redundant setUploadMeta round-trip.
- Wave 1–4: ponytail-review — removed redundant setUploadMeta from import path (net −lines).

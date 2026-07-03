# ROADMAP — normalization-quality-fixes

**Feature:** `specs/20260703-normalization-quality-fixes` | **Spec:** `specs/20260703-normalization-quality-fixes/spec.md` | **Plan:** `specs/20260703-normalization-quality-fixes/plan.md`  
**Created:** 2026-07-03

## Dependency diagram

T01 (HTML headings) → T02 (tables) → T03 (vision fallback) → T04 (quality tier + warning) → T05 (log cleanup)

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | HTML heading tags → Markdown headings | — | sequential | [x] |
| T02 | Diagnose + fix table detection/emission | T01 | sequential | [x] |
| T03 | Per-page vision fallback for low-extraction PDF pages | T02 | sequential | [x] |
| T04 | Compute/persist quality tier + surface `poor` warning | T03 | sequential | [x] |
| T05 | Log cleanup (remove per-page noise, keep summaries) | T04 | sequential | [x] |

## Prompt per task

### T01 — HTML heading tags → Markdown headings
**Spec ref:** R2 | **Plan ref:** Heading preservation (R2)  
**Files:** `src/js/normalization/**`, `cursor-tests/**`  
**Success criterion:** HTML inputs with `<h1>`–`<h6>` yield markdown `#` headings before `infer-headings.js`; no regression to PDF path.  
**On close:** run `/validate` and mark `[x]`.

### T02 — Diagnose + fix table detection/emission
**Spec ref:** R1 | **Plan ref:** Table detection & emission (R1)  
**Files:** `src/js/normalization/**`, `cursor-tests/**`  
**Success criterion:** HTML table detection anchored to real `<table>`; `tablesEmittedOk > 0` when tables exist; false-positive storms warn; `tablesDetected>0 && tablesEmittedOk===0` cannot yield `confidence: 'high'`.  
**On close:** run `/validate` and mark `[x]`.

### T03 — Per-page vision fallback for low-extraction PDF pages
**Spec ref:** R3 | **Plan ref:** Vision fallback (R3)  
**Files:** PDF extraction module(s), existing vision pipeline module(s), `cursor-tests/**`  
**Success criterion:** pages under threshold route to vision, merge in order, metadata marks `extractionPath: 'vision-fallback'`.  
**On close:** run `/validate` and mark `[x]`.

### T04 — Compute/persist quality tier + surface `poor` warning
**Spec ref:** R4 | **Plan ref:** Quality signal tiers & warning (R4)  
**Files:** session store/types, UI transition code, `cursor-tests/**`  
**Success criterion:** tier `good|degraded|poor` persisted; `poor` shows non-blocking warning at create→study; `degraded` logs/persists only.  
**On close:** run `/validate` and mark `[x]`.

### T05 — Log cleanup
**Spec ref:** R6 | **Plan ref:** Log cleanup (R6)  
**Files:** files touched by T01–T04 where noisy per-page logs exist  
**Success criterion:** per-page noise removed/downgraded; consolidated summary logs remain and are structured.  
**On close:** run `/validate` and mark `[x]`.

## Temporary subagents

(none)


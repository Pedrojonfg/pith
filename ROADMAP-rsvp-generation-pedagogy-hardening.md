# ROADMAP — rsvp-generation-pedagogy-hardening

**Feature:** specs/20260620-rsvp-generation-pedagogy-hardening | **Spec:** specs/20260620-rsvp-generation-pedagogy-hardening/spec.md | **Plan:** specs/20260620-rsvp-generation-pedagogy-hardening/plan.md
**Created:** 2026-06-20

## Dependency diagram

```text
T01 ─┐
T02 ─┼→ T03 → T04 → T05 → T06
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01, T02 | parallel |
| 2 | T03 | sequential |
| 3 | T04 | sequential |
| 4 | T05 | sequential |
| 5 | T06 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | R3 question-count retry + diagnostics | — | parallel | [x] |
| T02 | R4 Rule D in SOURCE_FIDELITY_RULES | — | parallel | [x] |
| T03 | R2 Settings Standard/Strict control | T01,T02 | sequential | [x] |
| T04 | R1 knowledge profile → block _config | T03 | sequential | [x] |
| T05 | R5 structured headers + validation/hook fixes | T04 | sequential | [x] |
| T06 | Integration tests + SW bump | T05 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-20 (none created)

## Prompt per task

### T01 — Question-count retry
**Spec ref:** FR-001, FR-002, R3 | **Plan ref:** research R3 | **Files:** study.js, api.js
**Success criterion:** One retry on short counts/gap coverage; `question_count_status` when still short; study never blocked
**On close:** `/validate` and mark `[x]`.

### T02 — Rule D
**Spec ref:** FR-007, R4 | **Files:** source-fidelity.js
**Success criterion:** Rule D text after omit-if-no-example bullet; present in mergeFidelityIntoSystemPrompt output
**On close:** `/validate` and mark `[x]`.

### T03 — Fidelity Settings
**Spec ref:** FR-006, R2 | **Files:** index.html, ui.js, study.js
**Success criterion:** Standard/Strict radios with plain labels; persists via localStorage
**On close:** `/validate` and mark `[x]`.

### T04 — Profile wiring
**Spec ref:** FR-003–FR-005, R1 | **Files:** session.js, study.js, api.js
**Success criterion:** mapKnowledgeProfileToBlockConfig; relational_compressed profile; applied at pack + session confirm
**On close:** `/validate` and mark `[x]`.

### T05 — Structured headers
**Spec ref:** FR-008–FR-009, R5 | **Files:** rsvp-section-headers.js, api.js, explanationParagraphs.js, study.js
**Success criterion:** Development blocks only; pool headers; tiered budgets; hook skips headers
**On close:** `/validate` and mark `[x]`.

### T06 — QA closure
**Spec ref:** quickstart | **Files:** cursor-tests/, sw-update.js, sw.js, index.html
**On close:** `/validate` and mark `[x]`.

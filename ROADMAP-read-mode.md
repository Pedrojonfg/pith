# ROADMAP — read-mode

**Feature:** specs/20260705-read-mode/ | **Spec:** specs/20260705-read-mode/spec.md | **Plan:** specs/20260705-read-mode/plan.md
**Created:** 2026-07-05

## Dependency diagram

```
T01 → T02 → T03 → T04 → T05 → T06 → T07
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02 | sequential |
| 3 | T03 | sequential |
| 4 | T04 | sequential |
| 5 | T05 | sequential |
| 6 | T06 | sequential |
| 7 | T07 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Mode plumbing (`read` key, slice, taxonomy, bootstrap, entry) | — | sequential | [x] |
| T02 | Textbook renderer on `screenTest` | T01 | sequential | [x] |
| T03 | `visualNeed` on block generation JSON | T02 | sequential | [x] |
| T04 | Image resolution from chunk / pith-image tokens | T03 | sequential | [x] |
| T05 | `generateBlockDiagram` + prefetch visual hook | T04 | sequential | [x] |
| T06 | Mermaid CDN, anchor insertion, dark theme | T05 | sequential | [x] |
| T07 | Integration tests + SW version bump | T06 | sequential | [x] |

## Prompt per task

### T01 — Mode plumbing
**Spec ref:** §3.1, §7, §8 R1 | **Plan ref:** Phase 1 | **Files:** session-types.js, session.js, mode-taxonomy.js, mode-bootstrap.js, session-store.js, study.js, index.html, recommender.js
**Success criterion:** Read mode selectable; bootstrap/resume uses `modes.read`; block→question loop works with plain text (no visuals).
**On close:** `/validate` and mark `[x]`.

### T02 — Textbook renderer
**Spec ref:** §6.1 | **Plan ref:** Phase 2 | **Files:** read-mode.js, study.js, ui.js, index.html, main.css
**Success criterion:** `screenTest` shows static full block text then MCQ flow.
**On close:** `/validate` and mark `[x]`.

### T03 — visualNeed flag
**Spec ref:** §4 | **Plan ref:** Phase 3 | **Files:** api.js, session.js
**Success criterion:** Block JSON includes normalized `visualNeed` when LLM returns it.
**On close:** `/validate` and mark `[x]`.

### T04 — Image resolution
**Spec ref:** §5.1 | **Plan ref:** Phase 4 | **Files:** read-visuals.js, study.js
**Success criterion:** `resolvedVisual` image attaches from chunk token overlap; diagram fallback on zero candidates.
**On close:** `/validate` and mark `[x]`.

### T05 — Diagram generation + prefetch
**Spec ref:** §5.2, §5 | **Plan ref:** Phase 5 | **Files:** api.js, read-visuals.js, session.js, study.js
**Success criterion:** Prefetch triggers diagram LLM; malformed output → `failed` without blocking questions.
**On close:** `/validate` and mark `[x]`.

### T06 — Mermaid render + anchor insertion
**Spec ref:** §6.2, §6.3 | **Plan ref:** Phase 6 | **Files:** read-mode.js, index.html, sw.js, sw-update.js, main.css
**Success criterion:** Visual inserts at anchor or end fallback; dark Mermaid theme.
**On close:** `/validate` and mark `[x]`.

### T07 — Tests + QA closure
**Spec ref:** §10 | **Plan ref:** quickstart | **Files:** cursor-tests/20260705_read-mode.mjs
**Success criterion:** All checklist tests green; SW_VERSION/`CACHE_NAME`/`?v=` aligned.
**On close:** `/validate` and mark `[x]`.

## Temporary subagents

Cleanup: 2026-07-05 (none — sequential implementation)

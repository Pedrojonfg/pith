# ROADMAP — typed-weighted-connections

**Feature:** specs/20260620-typed-weighted-connections | **Spec:** specs/20260620-typed-weighted-connections/spec.md | **Plan:** specs/20260620-typed-weighted-connections/plan.md
**Created:** 2026-06-20

## Dependency diagram

```text
T01 → T02 ─┐
T01 → T03 ─┼→ T04
T01 → T05 ─┼→ T06 → T07 → T08
```

## Waves

| Wave | Tasks | Mode |
|------|-------|------|
| 1 | T01 | sequential |
| 2 | T02, T03, T05 | parallel |
| 3 | T04, T06 | parallel |
| 4 | T07 | sequential |
| 5 | T08 | sequential |

## Tasks

| ID | Description | Dep | Mode | Status |
|----|-------------|-----|------|--------|
| T01 | Registry connection schema + connection-store core | — | sequential | [x] |
| T02 | Reinforcement from multi-concept responses | T01 | parallel | [x] |
| T03 | LLM registry_type + connection promotion | T01 | parallel | [x] |
| T04 | Wire fire-and-forget reinforce hooks | T01,T02 | parallel | [x] |
| T05 | Lazy decay on registry read | T01 | parallel | [x] |
| T06 | Yellow+ promotion gate wiring | T01,T03 | parallel | [x] |
| T07 | Vault graph + canvas type/weight visuals | T01,T05 | sequential | [x] |
| T08 | Integration tests + SW bump | T07 | sequential | [x] |

## Temporary subagents

Cleanup: 2026-06-20 (none created)

## Prompt per task

### T01 — Registry connection schema
**Spec ref:** FR-001–003, FR-009 | **Plan ref:** data-model | **Files:** connection-types.js, connection-store.js, registry-store.js, session-types.js, config/flags.js
**Success criterion:** load/save connections with normalize defaults; constants exported
**On close:** `/validate` and mark `[x]`.

### T02 — Reinforcement logic
**Spec ref:** FR-005 | **Plan ref:** contracts/registry-connection-store | **Files:** connection-store.js
**Success criterion:** reinforceConnectionsForConcepts updates weight +0.15 capped, increments count
**On close:** `/validate` and mark `[x]`.

### T03 — Generation typing + promotion module
**Spec ref:** FR-004, FR-007 | **Plan ref:** research Q2 | **Files:** cloze/pipeline.js, connection-promotion.js, connection-types.js
**Success criterion:** epistemic prompt includes registry_type; mapEpistemicTypeToRegistry; promoteGraphConnectionsToRegistry
**On close:** `/validate` and mark `[x]`.

### T04 — Fire-and-forget hooks
**Spec ref:** FR-005 | **Files:** ingest.js, recall-study.js, promotion.js
**Success criterion:** correct multi-concept paths call reinforce without blocking
**On close:** `/validate` and mark `[x]`.

### T05 — Lazy decay
**Spec ref:** FR-006 | **Files:** connection-store.js, config/flags.js
**Success criterion:** read path decays stale edges once, floored at 0.05
**On close:** `/validate` and mark `[x]`.

### T06 — Promotion gate wiring
**Spec ref:** FR-008 | **Files:** document-preparation.js, promotion.js, connection-promotion.js
**Success criterion:** promotion only when both endpoints yellow+
**On close:** `/validate` and mark `[x]`.

### T07 — Visualization
**Spec ref:** FR-010 | **Files:** vault-graph-adapter.js, graph/canvas.js
**Success criterion:** five types distinct; weight affects stroke width/opacity
**On close:** `/validate` and mark `[x]`.

### T08 — QA closure
**Spec ref:** §7 testing checklist | **Files:** cursor-tests/, sw-update.js, index.html, sw.js
**On close:** `/validate` and mark `[x]`.

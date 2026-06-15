# ROADMAP — Cross-Document Concept Vault & Global Concept Registry

**Feature**: `20260626-cross-doc-vault` | **Spec**: `specs/20260626-cross-doc-vault/spec.md` | **Plan**: `specs/20260626-cross-doc-vault/plan.md`

**Objective**: Global concept registry with gray/yellow/green maturity, automatic promotion from study modes, global SM-2 per facet, vault graph, ingest-only path, supersede curation gate.

**Prerequisites**: unified-session, sm2-priority-queue, recall-mode, study-projects.

**Source draft**: `spec-crossdoc.md`

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | concept-registry-store + session-types extensions | — | M | [x] |
| T02 | Session migration globalConceptId + smItems flag | T01 | S | [x] |
| T03 | identity-resolution.js (slug/alias, split bias) | T01 | M | [x] |
| T04 | promotion.js + mastery.js | T01, T03 | M | [x] |
| T05 | Mode wiring RSVP/Questions/Cloze/sm2-ingest | T04 | L | [x] |
| T06 | Global review queue in review.js | T01, T04 | M | [x] |
| T07 | Recall + Slow Phase 3 green promotion | T04 | M | [x] |
| T08 | vault-graph-adapter + canvas maturity styles | T01 | M | [x] |
| T09 | Vault UI graph + concept pages in study.js | T08, T06 | L | [x] |
| T10 | Recall focusConceptId entry | T04, T07 | S | [x] |
| T11 | Ingest-only upload path | T02 | M | [x] |
| T12 | Deprecate curation commit gate | T04 | S | [x] |
| T13 | Integration tests + SW bump + quickstart QA | T01–T12 | M | [x] |

## Dependency graph

```text
T01 ──→ T02 ──→ T11
T01 ──→ T03 ──→ T04 ──→ T05
                  T04 ──→ T06 ──→ T09
                  T04 ──→ T07 ──→ T10
                  T04 ──→ T12
T01 ───→ T08 ──→ T09
T05,T06,T07,T08,T09,T10,T11,T12 ──→ T13
```

**Parallel Wave 1**: T01

**Parallel Wave 2**: T02 + T03 + T08 (after T01)

**Parallel Wave 3**: T04 (after T03)

**Parallel Wave 4**: T05 + T06 + T07 + T11 + T12 (after T04)

**Parallel Wave 5**: T09 + T10 (after T06, T07, T08)

**Parallel Wave 6**: T13

## Recommended execution order

### Wave 1 — Registry foundation (1 agent)

- **T01** subagent `crossdoc-t01-registry-store`

### Wave 2 — Migration + resolution + graph adapter (3 parallel agents)

- **T02** subagent `crossdoc-t02-session-migration`
- **T03** subagent `crossdoc-t03-identity-resolution`
- **T08** subagent `crossdoc-t08-vault-graph`

### Wave 3 — Promotion engine (1 agent)

- **T04** subagent `crossdoc-t04-promotion`

### Wave 4 — Mode + review + ingest (5 parallel agents)

- **T05** subagent `crossdoc-t05-mode-wiring`
- **T06** subagent `crossdoc-t06-global-review`
- **T07** subagent `crossdoc-t07-green-promotion`
- **T11** subagent `crossdoc-t11-ingest-only`
- **T12** subagent `crossdoc-t12-deprecate-curation`

### Wave 5 — UI + Recall scope (2 parallel agents)

- **T09** subagent `crossdoc-t09-vault-ui`
- **T10** subagent `crossdoc-t10-focus-concept`

### Wave 6 — QA (1 agent)

- **T13** subagent `crossdoc-t13-qa-closure`

---

**PROMPT T01 — Registry store + types**

Implement T01 for `20260626-cross-doc-vault`.

Create `src/js/concept-registry/registry-store.js` per `contracts/concept-registry-store.md`. Extend `session-types.js` with Concept, ConceptFacetSchedule, ConceptContent, ConceptContentBlock, REGISTRY_CONCEPT_FACETS (includes recognition).

Reference: `specs/20260626-cross-doc-vault/data-model.md`, ROADMAP.md.

criterio de éxito: loadRegistry/saveRegistry round-trip unit tests pass. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T13 — QA closure**

Implement T13 using subagent `.cursor/agents/crossdoc-t13-qa-closure.md`.

Add `cursor-tests/20260626_cross-doc-vault.mjs`, bump SW_VERSION, mark ROADMAP [x].

criterio de éxito: full test file green + SW validate. Ejecuta /validate antes de cerrar este mensaje.

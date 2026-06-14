# ROADMAP — Vault Personal Notes, Connections & Resumable Upload

**Feature**: `20260625-vault-notes-connections` | **Spec**: `specs/20260625-vault-notes-connections/spec.md` | **Plan**: `specs/20260625-vault-notes-connections/plan.md`

**Objective**: Extend vault entries with notes/area/tags/related/status; enrich Upload to Vault curation; resumable processing queue with boot resume banner.

**Prerequisites**: `20260624-knowledge-vault-curation`, `20260618-knowledge-vault-a-plus`.

**Source draft**: `spec-notes.md`

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | Entry v2 schema + lazy migration (schemaVersion 3) | — | M | [x] |
| T02 | Extended dedup + extractVaultCandidates LLM | T01 | M | [x] |
| T03 | Commit, notes append, bidirectional related | T01 | M | [x] |
| T04 | vault-upload-queue.js + persistence | T01, T03 | M | [x] |
| T05 | Curation UI (notes/area/tags/related) + enqueue | T02, T04 | L | [x] |
| T06 | Settings toggle + resume banner | T04, T05 | S | [x] |
| T07 | Integration tests + SW bump + quickstart QA | T01–T06 | M | [x] |

## Dependency graph

```text
T01 ──→ T02
T01 ──→ T03 ──→ T04 ──→ T05 ──→ T06 ──→ T07
T02 ──→ T05
```

**Parallel Wave 1**: T01

**Parallel Wave 2**: T02 + T03 (after T01)

**Sequential**: T04 → T05 → T06 → T07

## Recommended execution order

### Wave 1 — Schema (1 agent)

- **T01** subagent `vnc-t01-vault-schema`

### Wave 2 — API + commit (2 parallel agents)

- **T02** subagent `vnc-t02-dedup-extract`
- **T03** subagent `vnc-t03-commit-backlinks`

### Wave 3 — Queue (1 agent)

- **T04** subagent `vnc-t04-upload-queue`

### Wave 4 — UI + settings (2 parallel agents)

- **T05** subagent `vnc-t05-curation-ui`
- **T06** subagent `vnc-t06-settings-banner`

### Wave 5 — QA (1 agent)

- **T07** subagent `vnc-t07-qa-closure`

---

**PROMPT T01 — Vault entry v2 schema**

Implement T01 for `20260625-vault-notes-connections`.

Files: `vault-store.js`, `session-types.js`, `normalization.js`.

Add migrateEntryNotesConnections, schemaVersion 3, getDistinctAreas, applyRelatedBacklinks.

Reference: `specs/20260625-vault-notes-connections/data-model.md`, ROADMAP.md.

criterio de éxito: migration defaults pass in cursor-tests. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T02 — Extended LLM APIs**

Implement T02 using subagent `.cursor/agents/vnc-t02-dedup-extract.md`.

Extend `normalizeConceptsToVault` and `extractVaultCandidates` in `api.js`.

criterio de éxito: mocked JSON shapes match contracts/dedup-related-api.md. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T03 — Commit + backlinks**

Implement T03 using subagent `.cursor/agents/vnc-t03-commit-backlinks.md`.

Extend `vault-curation.js`: buildBatchContext, commitVaultCurationItem, mergeNotesForEntry, resolveRelatedAcceptedIds.

criterio de éxito: backlink symmetry unit checks pass. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T04 — Upload queue**

Implement T04 using subagent `.cursor/agents/vnc-t04-upload-queue.md`.

New `vault-upload-queue.js`; sequential processor with persistence.

criterio de éxito: stale processing reset + pending count tests pass. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T05 — Curation UI**

Implement T05 using subagent `.cursor/agents/vnc-t05-curation-ui.md`.

Update `study.js`, `index.html`, `main.css` for notes/area/tags/related fields and queue enqueue.

criterio de éxito: quickstart Scenario 1 manual path. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T06 — Settings + resume banner**

Implement T06 using subagent `.cursor/agents/vnc-t06-settings-banner.md`.

`vault-settings.js`, resume banner in `index.html`, `main.js` boot sync.

criterio de éxito: quickstart Scenarios 2 and 4. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T07 — QA closure**

Implement T07 using subagent `.cursor/agents/vnc-t07-qa-closure.md`.

Add `cursor-tests/20260625_vault-notes-connections.mjs`, bump SW_VERSION, mark ROADMAP [x].

criterio de éxito: full test file green + SW validate. Ejecuta /validate antes de cerrar este mensaje.

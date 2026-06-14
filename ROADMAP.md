# ROADMAP — Knowledge Vault Curation

**Feature**: `20260624-knowledge-vault-curation` | **Spec**: `specs/20260624-knowledge-vault-curation/spec.md` | **Plan**: `specs/20260624-knowledge-vault-curation/plan.md`

**Objective**: Close session↔vault loop — App Home (Vault/Sessions), Upload to vault with facet-tagged review items, dual-pool Review with mastery decay feedback.

**Prerequisites**: `20260618-knowledge-vault-a-plus`, `20260623-study-projects`, `20260621-recall-mode`, `20260620-sm2-priority-queue`.

**Source draft**: `spec-knlvaultcur.md`

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | Vault schema — types, migration, mastery weights, decay log, sm2 source | — | M | [x] |
| T02 | App Home + Vault branch navigation; hide modeSelect hub | T01 | M | [x] |
| T03 | Upload flow — vault-curation.js, extractVaultCandidates, candidate UI | T01 | L | [x] |
| T04 | Review dual pool + vault item SM-2 / observation routing | T01 | M | [x] |
| T05 | Integration tests + SW bump + quickstart QA | T01–T04 | M | [x] |

## Dependency graph

```text
T01 ──→ T02
T01 ──→ T03
T01 ──→ T04
T02,T03,T04 ──→ T05
```

**Parallel Wave 1**: T01 (1 agent)

**Parallel Wave 2**: T02 + T03 + T04 (3 agents; all wait for T01)

**Sequential**: T05 after all

## Recommended execution order

### Wave 1 — Schema foundation (1 agent)

- **T01** subagent `kvc-t01-vault-schema`

**Checkpoint**: `loadVault()` returns `reviewItems`; `OBSERVATION_WEIGHTS.review_correct` defined; `normalizeVaultReviewItemForQueue` maps facet.

### Wave 2 — Navigation + upload + review (3 parallel agents)

- **T02** subagent `kvc-t02-app-home`
- **T03** subagent `kvc-t03-upload-flow`
- **T04** subagent `kvc-t04-review-dual-pool`

**Checkpoint**: App Home loads; upload commits definition; scoped review includes vault items.

### Wave 3 — QA closure (1 agent)

- **T05** subagent `kvc-t05-qa-closure`

---

**PROMPT T01 — Vault schema foundation**

Implement T01 for `20260624-knowledge-vault-curation` on branch `20260624-knowledge-vault-curation`.

Files: `session-types.js`, `vault/decay-calibration.js`, `vault/vault-store.js`, `vault/mastery-model.js`, `sm2.js`.

Add ConceptFacet types, reviewItems persistence, review_* observation weights, facetCoverage updates, vault_review_item SM-2 source.

Reference: `specs/20260624-knowledge-vault-curation/data-model.md`, ROADMAP.md.

criterio de éxito: migration smoke + unit weights pass. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T02 — App Home navigation**

Implement T02 using subagent spec `.cursor/agents/kvc-t02-app-home.md`.

Add `screenAppHome`, `screenVaultBranch`, Session Hub actions, route bootstrap to App Home.

criterio de éxito: manual Scenario 1 in quickstart.md. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T03 — Upload to vault flow**

Implement T03 using `.cursor/agents/kvc-t03-upload-flow.md`.

Wire LLM `extractVaultCandidates`, candidate screen, `commitVaultCuration`.

criterio de éxito: Scenario 3 in quickstart.md (with API key). Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T04 — Review dual pool**

Implement T04 using `.cursor/agents/kvc-t04-review-dual-pool.md`.

Merge vault.reviewItems into `getReviewableItemsForProject`; vault branch in `handleSm2QualityClick`.

criterio de éxito: Scenario 4 in quickstart.md. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T05 — QA closure**

Implement T05 using `.cursor/agents/kvc-t05-qa-closure.md`.

Run `node --import ./cursor-tests/register.mjs cursor-tests/20260624_knowledge-vault-curation.mjs` and SW validate test.

criterio de éxito: all tests green, ROADMAP [x]. Ejecuta /validate antes de cerrar este mensaje.

## Execution instruction

All waves implemented in this session. Subagents created at `.cursor/agents/kvc-t*.md` for future parallel reruns.

Verify manually: `specs/20260624-knowledge-vault-curation/quickstart.md` Scenarios 1–5.

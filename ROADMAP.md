# ROADMAP — Global Knowledge Vault (Post A+)

**Feature**: `20260619-knowledge-vault-post-a-plus` | **Spec**: `specs/20260619-knowledge-vault-post-a-plus/spec.md` | **Plan**: `specs/20260619-knowledge-vault-post-a-plus/plan.md`

**Objective**: Extend A+ GKV with manual curation, external import, misconception detection, finer mastery, prerequisite graph improvements, vault graph UI, and vault-driven spaced review. **Do not start until A+ readiness gate (FR-000) is green.**

**A+ status**: `20260618-knowledge-vault-a-plus` tasks T01–T09 complete.

**Post A+ status**: `20260619-knowledge-vault-post-a-plus` tasks T01–T14 complete (integration test `cursor-tests/20260619_knowledge-vault-post-a-plus.mjs` green).

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | Manual vault UI + store APIs (edit, merge, delete, add, prereqs) | — | M | [x] |
| T02 | External import — free text (LLM extract) | T01 | M | [x] |
| T03 | External import — document without session | T01 | M | [x] |
| T04 | External import — CSV/JSON | T02 | S | [x] |
| T05 | Misconception model + session-close detection | T01 | M | [x] |
| T06 | Misconception prompt injection | T05 | S | [x] |
| T07 | Declarative/procedural mastery dimensions | T01 | M | [x] |
| T08 | Optional BKT path (≥15 obs/concept) | T07 | M | [x] |
| T09 | Prerequisite cycle detection + co-prerequisites | T01 | S | [x] |
| T10 | LLM cross-document prerequisite inference | T09 | M | [x] |
| T11 | Topological importance scoring | T09 | S | [x] |
| T12 | Vault graph UI (adapter + view) | T09, T11 | M | [x] |
| T13 | Vault-driven spaced review → smItems | T07, T11 | M | [x] |
| T14 | cursor-tests + quickstart QA closure | T01–T13 | M | [x] |
| T15 | Multi-device sync (deferred — backend) | backend | L | [ ] |
| T16 | Collaborative filtering (deferred — backend) | T15 | L | [ ] |

## Dependency graph

```text
T01 ──┬──→ T02 ──→ T04
      ├──→ T03
      ├──→ T05 ──→ T06
      ├──→ T07 ──┬──→ T08
      │          └──→ T13
      └──→ T09 ──┬──→ T10
                 ├──→ T11 ──┬──→ T12
                 │          └──→ T13

T01–T13 ──→ T14

T15 ──→ T16  (deferred)
```

**Parallel from T01**: up to 3 agents — T02+T03+T09, or T05+T07+T09

**Parallel after T09**: T10 + T11 (2 agents)

**Parallel after T11**: T12 + T13 (2 agents; T13 also needs T07)

## Recommended execution order

### Gate 0 — Validate A+ (manual, no agent)

Confirm FR-000: >30 concepts, no obvious dupes, shorter repeat packing, decay works, subjective "app knows what I know".

### Wave 1 — Curation (1 agent)

- **T01** Manual vault management

**Checkpoint**: User can fix titles, merge dupes, add manual concepts.

### Wave 2 — Import (2 parallel agents)

- **T02** Text import
- **T03** Document import

Then **T04** CSV/JSON (1 agent).

**Checkpoint**: Import Python knowledge → next doc has shorter assessment.

### Wave 3 — Pedagogy core (3 parallel agents)

- **T05** Misconceptions
- **T07** Declarative/procedural mastery
- **T09** Co-prerequisites

Then: **T06** (after T05), **T10+T11** parallel (after T09).

### Wave 4 — Visualization + retention (2 parallel agents)

- **T12** Graph UI (needs T11)
- **T13** Spaced review (needs T07+T11)

### Wave 5 — Precision (optional, when data rich)

- **T08** BKT when ≥15 obs/concept average

### Wave 6 — QA

- **T14** Tests + quickstart closure

### Deferred

- **T15–T16** When backend ships

---

## PROMPT T01 — Manual vault UI + store APIs

Implement Post A+ Block 1 — manual vault management.

**Context**: Read `specs/20260619-knowledge-vault-post-a-plus/spec.md` (User Story 1, FR-101–105), `contracts/manual-vault-ui.md`, `data-model.md`. A+ vault lives in `src/js/vault/vault-store.js` and `debug-ui.js`.

**Files to touch**:
- `src/js/vault/vault-store.js` — add `updateEntryTitle`, `mergeEntries`, `deleteEntry`, `addManualEntry`, `setPrerequisites`; schema v2 migration stub if needed
- `src/js/vault/debug-ui.js` — edit/merge/delete/add UI, prerequisite multi-select
- `index.html` — modals/buttons in Knowledge Vault section
- `src/css/main.css` — minimal form/modal styles
- `sw.js` — bump SW_VERSION if required by project rules

**Success criteria**:
- All five FR-101–105 flows work and persist across reload
- Merge reassigns observations, sources, prerequisites, dependents without orphans
- Delete cleans inverse links

**Reference**: `ROADMAP.md` wave 1.

criterio de éxito: manual edit/merge/delete/add/prereq flows pass quickstart Wave 1. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T02 — External import (free text)

Implement Post A+ Block 2a — import knowledge by pasting text.

**Context**: `contracts/external-import.md`, `research.md` R2. Depends on T01 store APIs.

**Files to touch**:
- `src/js/vault/import.js` (NEW) — `importFromText`
- `src/js/api.js` — `extractConceptsFromImportText` LLM call; reuse `normalizeConceptsToVault`
- `src/js/vault/debug-ui.js` or `study.js` — Import UI entry
- `index.html`, `src/css/main.css`

**Success criteria**:
- Paste text → concepts in vault with default mastery 0.7
- Overlaps merge via existing normalization
- `ImportRecord` appended

criterio de éxito: quickstart Wave 2 step 1 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T03 — External import (document without session)

Implement Post A+ Block 2b — upload document marked "already know".

**Context**: `contracts/external-import.md`. Reuse normalization pipeline without creating study session.

**Files to touch**:
- `src/js/vault/import.js` — `importFromDocument`
- `src/js/study.js` — upload handler branch for import-only
- `index.html` — checkbox "Already know this material"

**Success criteria**:
- Document upload + flag → concepts in vault, mastery ~0.8, no new session in session list

criterio de éxito: quickstart Wave 2 step 2 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T04 — External import (CSV/JSON)

Implement Post A+ Block 2c — structured file import.

**Context**: `contracts/external-import.md` CSV/JSON schemas.

**Files to touch**:
- `src/js/vault/import.js` — `importFromCsv`, `importFromJson`
- Import UI — file picker + result summary

**Success criteria**:
- Valid rows import; invalid rows reported; partial success works

criterio de éxito: quickstart Wave 2 step 3 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T05 — Misconception detection

Implement Post A+ Block 3 — misconception model and detection.

**Context**: `contracts/misconception-detection.md`, `data-model.md` Misconception entity.

**Files to touch**:
- `src/js/vault/misconceptions.js` (NEW)
- `src/js/vault/session-close.js` — extend observation capture (`wrongAnswer`, `taskKind`); call detection after applyObservations
- `src/js/api.js` — optional `detectMisconceptionPattern`
- `src/js/vault/debug-ui.js` — show misconceptions in detail view

**Success criteria**:
- ≥3 related negative obs → misconception created
- <3 → no misconception
- FR-301–304 satisfied

criterio de éxito: quickstart Wave 3 steps 1–3 pass. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T06 — Misconception prompt injection

Wire misconceptions into generation scaffolding.

**Context**: `contracts/misconception-detection.md` prompt block section.

**Files to touch**:
- `src/js/vault/prompt-injection.js` — append misconception contrast instructions
- Verify `api.js` pack/block paths include updated context

**Success criteria**:
- Active misconception → generation context includes description (test via debug log or exported prompt)

criterio de éxito: quickstart Wave 3 step 4 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T07 — Declarative/procedural mastery

Implement Post A+ Block 4a — dual mastery dimensions.

**Context**: `contracts/mastery-refinement.md`, `research.md` R4.

**Files to touch**:
- `src/js/vault/mastery-model.js` — dimension updates, weighted `getCurrentMastery`
- `src/js/vault/session-close.js` — route observations by taskKind
- Tag task kind at observation creation in study flows where possible

**Success criteria**:
- Definition vs application signals update separate dimensions
- Overall mastery = 0.4 declarative + 0.6 procedural when both exist

criterio de éxito: quickstart Wave 4 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T08 — Optional BKT path

Implement Post A+ Block 4b — BKT when data sufficient.

**Context**: `contracts/mastery-refinement.md`, `research.md` R5. Only enable at ≥15 obs/entry.

**Files to touch**:
- `src/js/vault/mastery-model.js` — `bktMastery`, `maybeEnableBkt`

**Success criteria**:
- Entry with 14 obs uses weighted average; 15th obs enables BKT
- No regression for sparse entries

criterio de éxito: unit tests for BKT gate in cursor-tests. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T09 — Prerequisite cycles + co-prerequisites

Implement Post A+ Block 5a.

**Context**: `contracts/prerequisite-graph.md`, `research.md` R6.

**Files to touch**:
- `src/js/vault/prerequisite-graph.js` (NEW) — `addPrerequisiteSafe`
- `src/js/vault/vault-store.js` — use safe add in setPrerequisites
- `debug-ui.js` — co-prerequisite badge

**Success criteria**:
- A→B + B→A becomes co-prerequisite pair, no crash, valid graph

criterio de éxito: quickstart Wave 5 step 1 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T10 — LLM cross-document prerequisite inference

Implement Post A+ Block 5b.

**Context**: `contracts/prerequisite-graph.md`, `research.md` R7.

**Files to touch**:
- `src/js/vault/prerequisite-graph.js` — `maybeInferPrerequisites`
- `src/js/api.js` — LLM batch inference prompt
- Trigger after 5 docs per topic (use `docTopics` from A+)

**Success criteria**:
- High-confidence edges auto-applied; medium queue for review in debug UI

criterio de éxito: quickstart Wave 5 step 2 passes (or mocked trigger). Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T11 — Topological importance

Implement Post A+ Block 5c.

**Context**: `contracts/prerequisite-graph.md`, `research.md` R8.

**Files to touch**:
- `src/js/vault/prerequisite-graph.js` — `computeImportanceScore`
- Recompute on prereq/co-prereq changes

**Success criteria**:
- Central concepts score higher than leaves with same mastery

criterio de éxito: importance ordering test in cursor-tests. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T12 — Vault graph UI

Implement Post A+ Block 6 — interactive vault graph.

**Context**: `contracts/vault-graph-ui.md`, reuse `src/js/graph/view.js`.

**Files to touch**:
- `src/js/vault/vault-graph.js` (NEW) — `buildVaultGraph`
- `src/js/study.js` — navigation to graph screen
- `index.html` — graph container + "View graph" button
- `src/css/main.css` — graph screen styles if needed

**Success criteria**:
- 100 nodes navigable; mastery color; click → detail panel (SC-006)

criterio de éxito: quickstart Wave 6 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T13 — Vault-driven spaced review

Implement Post A+ Block 7 — connect vault decay to `shared.smItems`.

**Context**: `contracts/spaced-review-vault.md`, `research.md` R10.

**Files to touch**:
- `src/js/vault/spaced-review.js` (NEW) — `syncVaultToReviewPool`
- `src/js/study.js` — hook on mode-select and session-close
- `src/js/session-store.js` — extend smItems if shape needs `vaultEntryId`

**Success criteria**:
- Decaying concepts enter review pool; centrality boosts priority; review updates vault

criterio de éxito: quickstart Wave 7 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T14 — Integration tests + QA closure

Close Post A+ feature with automated and manual QA.

**Context**: `quickstart.md`, all contracts, A+ regression.

**Files to touch**:
- `cursor-tests/20260619_knowledge-vault-post-a-plus.mjs` (NEW)
- `ROADMAP.md` — mark T01–T14 [x]
- `ROADMAP.md` (root) — add Post A+ completion note if applicable

**Tests must cover**:
- merge/delete/prereq invariants
- import partial success
- misconception threshold
- co-prerequisite cycle
- importance ordering
- BKT gate (if T08 done)
- A+ session-close regression

criterio de éxito: `node cursor-tests/20260619_knowledge-vault-post-a-plus.mjs` passes; quickstart scenarios documented as checked. Ejecuta /validate antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Primero (manual)**: Valida gate A+ (FR-000). No lances agentes si falla.
2. **Wave 1**: Lanza **PROMPT T01** (1 agente).
3. **Wave 2**: En paralelo **T02 + T03**; luego **T04**.
4. **Wave 3**: En paralelo **T05 + T07 + T09**; luego **T06**; en paralelo **T10 + T11**.
5. **Wave 4**: En paralelo **T12 + T13** (cuando T11 y T07 listos).
6. **Wave 5 (opcional)**: **T08** cuando haya ≥15 obs/concepto de media.
7. **Cierre**: **T14**.

**Tiempo mínimo**: Waves 2–3 paralelizan hasta 3 agentes → ahorro ~40% vs secuencial total.

**Antes de Wave 4**: Confirma que SM v1 (`shared.smItems`) no pierde ítems al cambiar de modo — requisito para T13.

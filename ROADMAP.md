# ROADMAP — Study Projects

**Feature**: `20260623-study-projects` | **Spec**: `specs/20260623-study-projects/spec.md` | **Plan**: `specs/20260623-study-projects/plan.md`

**Objective**: User-defined hierarchical **Project** entity grouping documents (1:1, default `misc`); project browser in Library; scoped Review; GKV vault context prioritized by project ancestry; breadcrumbs and mode-select hub entry points.

**Prerequisites**: `20260609-unified-session`, `20260618-knowledge-vault-a-plus`, `20260612-mode-continuity`, `20260620-sm2-priority-queue`.

**Source draft**: `spec-archlevels.md`

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | `session-types.js` — Project, ProjectStore, `projectId`, `MISC_PROJECT_ID` | — | S | [x] |
| T02 | `project-store.js` — CRUD + tree helpers (pure) | T01 | M | [x] |
| T03 | Migration + `session-store.js` ProjectStore persistence | T01 | M | [x] |
| T04 | GKV `getVaultContextForDoc(session)` + scope bands in `buildVaultContextBlock` | T02, T03 | M | [x] |
| T05 | `review.js` — `getReviewableItemsForProject` + review scope picker UI | T02, T03 | M | [x] |
| T06 | `ui.js` — `renderBreadcrumb`, flat project tree selector | T01 | M | [x] |
| T07 | `index.html` + CSS — project library browser shell | T02, T03, T06 | M | [x] |
| T08 | `study.js` — library navigation, project CRUD, move document | T06, T07 | M | [x] |
| T09 | `study.js` — upload assign, mode hub, breadcrumbs on modes | T08 | M | [x] |
| T10 | Integration tests + quickstart QA closure | T01–T09 | M | [x] |

## Dependency graph

```text
T01 ──→ T02 ──→ T04
  │       │
  └──→ T03 ──→ T05
  │
T06 ──→ T07 ──→ T08 ──→ T09
T02,T03,T04,T05,T08,T09 ──→ T10
```

**Parallel Wave 1**: T01 + T06 (2 agents)

**Parallel Wave 2**: T02 + T03 (2 agents; both wait for T01)

**Parallel Wave 3**: T04 + T05 + T07 (3 agents; T07 waits for T02+T03+T06)

**Parallel Wave 4**: T08 + T09 (2 agents; T09 waits for T08)

**Sequential**: T10 after all

## Recommended execution order

### Wave 1 — Types + UI primitives (2 parallel agents)

- **T01** session types and constants
- **T06** breadcrumb + project selector components

**Checkpoint**: Types export `MISC_PROJECT_ID`; `renderBreadcrumb([{label:'Library'}])` returns DOM node.

### Wave 2 — Store + migration (2 parallel agents)

- **T02** pure project-store module
- **T03** migrateProjects boot + localStorage persistence

**Checkpoint**: Boot creates misc; legacy sessions backfilled; tree helpers pass unit smoke in DevTools.

### Wave 3 — Vault + review + library shell (3 parallel agents)

- **T04** vault context project priority
- **T05** scoped review filtering + config UI
- **T07** library browser markup/CSS

**Checkpoint**: Scoped review returns subset; vault block has three bands; library screen shows project list.

### Wave 4 — Orchestration (2 sequential agents)

- **T08** library CRUD wiring, move document
- **T09** upload default project, mode hub, breadcrumbs on study screens

**Checkpoint**: End-to-end: create project → assign doc → review scoped → RSVP pack uses session context.

### Wave 5 — QA closure (1 agent)

- **T10** cursor-tests + ROADMAP `[x]` + quickstart sign-off

---

## PROMPT T01 — Session types & projectId

Implement Study Projects T01 — types and constants on DocumentSession.

**Context**: Read `specs/20260623-study-projects/spec.md` (FR-003, Key Entities), `data-model.md`, `contracts/project-store-api.md`. Branch `20260623-study-projects`. Source draft `spec-archlevels.md` §2.1–2.3.

**Files to touch**:
- `src/js/session-types.js` — add JSDoc typedefs `Project`, `ProjectStore`; export `MISC_PROJECT_ID = 'misc'`; document `projectId` on DocumentSession root; extend `validateDocumentSession` to accept optional `projectId` string (warn if missing pre-migration only — do not break legacy reads)

**Do NOT touch**: project-store.js, study.js, migration yet.

**Success criteria**:
- `MISC_PROJECT_ID` exported and used consistently
- Validation allows sessions without projectId (migration handles backfill)
- No schemaVersion bump

**Reference**: `ROADMAP.md` Wave 1.

criterio de éxito: import `{ MISC_PROJECT_ID }` from session-types in DevTools. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T02 — Project store pure module

Implement Study Projects T02 — `project-store.js` CRUD and tree helpers.

**Context**: Read `contracts/project-store-api.md`, `data-model.md`, `research.md` R1–R6. Depends on T01 (`MISC_PROJECT_ID`).

**Files to touch**:
- `src/js/project-store.js` (NEW) — `getProject`, `getAncestorChain`, `getDescendantIds`, `getChildren`, `getProjectTree`, `getSessionsByProject`, `createProject`, `renameProject`, `moveProject`, `deleteProject`, `assignSessionToProject`, cycle check, delete guards for misc

**Do NOT touch**: session-store persistence, UI, migration.

**Success criteria**:
- Pure functions — no localStorage/DOM
- `moveProject` rejects cycles and misc reparent
- `deleteProject` rejects misc, non-empty children, assigned sessions
- Export error message constants matching contract

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: unit smoke in Node import — create tree, reject cycle delete. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T03 — Migration & ProjectStore persistence

Implement Study Projects T03 — boot migration and session-store integration.

**Context**: Read `contracts/project-migration.md`, `data-model.md`. Depends on T01.

**Files to touch**:
- `src/js/session-migration.js` — add `migrateProjects()` idempotent step per contract
- `src/js/session-store.js` — `loadProjectStore`, `saveProjectStore`, `ensureMiscProject`; wire migration call at boot alongside existing migration
- Hook migration from app entry (`main.js` or existing boot path)

**Do NOT touch**: UI, vault, review.

**Success criteria**:
- First boot creates `mylearning_projects` with misc
- All sessions without projectId → `misc`
- Second boot is no-op (idempotent)
- Existing sessions otherwise unchanged

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: legacy localStorage sessions gain projectId after refresh. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T04 — Vault context project priority

Implement Study Projects T04 — session-aware vault prompt injection.

**Context**: Read `contracts/vault-context-priority.md`, `spec.md` US-3, `research.md` R3. Depends on T02+T03 (need session.projectId resolution).

**Files to touch**:
- `src/js/vault/prompt-injection.js` — change `getVaultContextForDoc(session)` to return scored entries; add `getProjectScopeDepth`; update `buildVaultContextBlock` three-band format; preserve A+ mastered/partial/unstable within bands
- `src/js/api.js` — update call sites (`deepSeekPackConceptsToBlocks`, block generation paths) to pass session or `{ projectId, shared: { docTopics } }`

**Do NOT touch**: vault-store schema, UI.

**Success criteria**:
- Same-project entries sort before unrelated
- Nothing excluded by project mismatch
- Truncation drops general → related → never same-subject
- docTopics matching logic unchanged

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: mock session in test — scopeDepth ordering verified. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T05 — Scoped review

Implement Study Projects T05 — review filtering by project scope.

**Context**: Read `contracts/review-project-scope.md`, `spec.md` US-2. Depends on T02+T03.

**Files to touch**:
- `src/js/review.js` — `getReviewableItemsForProject(projectId, opts)`; integrate with existing vault/cross-doc review entry
- `index.html` — scope controls on `screenReviewConfig` (`All subjects`, project picker, `Include subprojects`)
- `src/css/main.css` — minimal scope picker styles
- `src/js/ui.js` — element refs if needed

**Do NOT touch**: smItems schema, project-store internals.

**Success criteria**:
- `projectId === 'all'` matches current global behavior
- Scoped filter uses session.projectId join via docId
- UI strings per contract (English)

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: two projects with due items — scoped review shows correct subset. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T06 — Breadcrumb & project selector UI

Implement Study Projects T06 — reusable breadcrumb and flat tree selector.

**Context**: Read `contracts/project-library-ui.md`. Depends on T01 (types only).

**Files to touch**:
- `src/js/ui.js` — `renderBreadcrumb(segments)`, `renderProjectPicker(store, { selectedId, onSelect })` with indentation
- `src/css/main.css` — breadcrumb + picker styles

**Do NOT touch**: study.js navigation, session-store.

**Success criteria**:
- Breadcrumb renders arbitrary depth; clickable segments call onClick
- Project picker shows tree flat-indented
- English labels only

**Reference**: `ROADMAP.md` Wave 1.

criterio de éxito: renderBreadcrumb 4 segments in DevTools returns clickable nav. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T07 — Library browser shell

Implement Study Projects T07 — project browser markup and layout.

**Context**: Read `contracts/project-library-ui.md` §Library browser. Depends on T02, T03, T06.

**Files to touch**:
- `index.html` — extend `screenDocLibrary` with subproject list, document list, action buttons (`New Project`, `New Subproject`, `Move to project…` placeholders)
- `src/js/ui.js` — refs for new elements
- `src/css/main.css` — project browser layout, optional color swatch

**Do NOT touch**: study.js handlers (T08), full CRUD logic.

**Success criteria**:
- DOM structure supports root vs drill-down views
- Breadcrumb mount point present
- Matches English strings table

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: showScreen library displays project list container. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T08 — Library navigation & project CRUD wiring

Implement Study Projects T08 — study.js library orchestration.

**Context**: Read `contracts/project-library-ui.md`, `project-store-api.md`. Depends on T06, T07.

**Files to touch**:
- `src/js/study.js` — `enterProjectLibrary`, drill-down/back, create/rename/move/delete project handlers, `Move to project…` → `assignSessionToProject`, error toasts for cycle/delete block
- Wire library document tap → mode select with breadcrumb context

**Do NOT touch**: upload flow (T09), vault (T04).

**Success criteria**:
- Full CRUD except misc delete/move blocked
- Document reassignment persists and reflects in library
- Breadcrumb updates on navigation

**Reference**: `ROADMAP.md` Wave 4.

criterio de éxito: create Algebra → Unit 3 → move doc → visible in library. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T09 — Upload, mode hub & study breadcrumbs

Implement Study Projects T09 — upload assignment and hub entry points.

**Context**: Read `spec.md` US-1, US-5, `contracts/project-library-ui.md`. Depends on T08.

**Files to touch**:
- `src/js/study.js` — upload screen project selector prefill rules; mode select Continue/Library/Review hub when general entry; breadcrumb on mode select and active modes via `enterModeWithContinuity`
- `index.html` — upload project selector on `screenPlaceholder`; mode hub buttons if missing

**PWA**: Bump `SW_VERSION` in `src/js/sw-update.js`, matching `?v=` in `index.html`, `CACHE_NAME` in `sw.js`.

**Success criteria**:
- Upload from root defaults misc; from project defaults that project
- General mode select shows three hub actions
- Breadcrumb on study screens shows project path

**Reference**: `ROADMAP.md` Wave 4.

criterio de éxito: upload + hub + breadcrumb manual quickstart §3–5 pass. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T10 — Integration tests & QA closure

Implement Study Projects T10 — tests and roadmap closure.

**Context**: Read `quickstart.md`, all contracts. Depends on T01–T09.

**Files to touch**:
- `cursor-tests/20260623_study-projects.mjs` (NEW) — migration idempotency, tree helpers, scopeDepth sort, review scope filter, misc guards
- `ROADMAP.md` — mark T01–T10 `[x]`
- Run `cursor-tests/20260606_validate-sw-update-flow.mjs` if SW changed

**Success criteria**:
- All new tests pass via `node cursor-tests/20260623_study-projects.mjs`
- Quickstart checklist items verifiable
- ROADMAP tasks marked complete

**Reference**: `specs/20260623-study-projects/quickstart.md`.

criterio de éxito: full test file green + ROADMAP [x]. Ejecuta /validate antes de cerrar este mensaje.

---

## Execution instruction

**Start now (parallel)**:
1. **T01** — types/constants
2. **T06** — breadcrumb + picker UI

**After T01 completes (parallel)**:
3. **T02** — project-store.js
4. **T03** — migration + persistence

**After T02+T03+T06 (parallel)**:
5. **T04** — vault priority
6. **T05** — scoped review
7. **T07** — library shell

**Then sequential**:
8. **T08** — library wiring (needs T07)
9. **T09** — upload/hub/breadcrumbs (needs T08)
10. **T10** — QA closure

**Minimum viable slice**: T01→T02→T03→T07→T08 delivers organizational hierarchy without GKV/review enhancements.

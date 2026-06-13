# ROADMAP — SM-2 Priority Queue

**Feature**: `20260620-sm2-priority-queue` | **Spec**: `specs/20260620-sm2-priority-queue/spec.md` | **Plan**: `specs/20260620-sm2-priority-queue/plan.md`

**Objective**: SM-2 spaced repetition with non-blocking priority queue — pure algorithm module, canonical `smItems` schema, ingestion from RSVP/Questions/Cloze/Slow, vault shape alignment, minimal Review UI (badge + study flow).

**Prerequisites**: `20260609-unified-session`, Post A+ T13 vault → smItems bridge.

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | `sm2.js` pure module + `cursor-tests/sm2.test.mjs` | — | M | [x] |
| T02 | `normalizeSmItem` + `upsertSmItem` / `getSmItemsDueToday` alignment | T01 | S | [x] |
| T03 | RSVP / Questions ingestion (`sm2-ingest.js` + `study.js` hooks) | T02 | M | [x] |
| T04 | Review button + due-now badge on `screenModeSelect` | T01 | S | [x] |
| T05 | `screenReview` priority-queue study flow | T02 | M | [x] |
| T06 | Cloze + Slow flashcard ingestion hooks | T02, T03 | S | [x] |
| T07 | Vault `spaced-review.js` canonical shape + review callback | T02 | S | [x] |
| T08 | Integration tests + quickstart QA closure | T01–T07 | M | [x] |

## Dependency graph

```text
T01 ──┬──→ T02 ──┬──→ T03 ──→ T06
      │          ├──→ T05
      │          └──→ T07
      └──→ T04

T01–T07 ──→ T08
```

**Parallel after T01**: T02 + T04 (2 agents)

**Parallel after T02**: T03 + T05 + T07 (3 agents)

**Sequential**: T06 after T03 validated; T08 after all

## Recommended execution order

### Wave 1 — Algorithm core (1 agent)

- **T01** `src/js/sm2.js` + unit tests

**Checkpoint**: `node cursor-tests/sm2.test.mjs` green before any wiring.

### Wave 2 — Storage + badge (2 parallel agents)

- **T02** session-store normalization
- **T04** mode-select Review badge (can mock items for badge test)

**Checkpoint**: legacy cloze-shaped item normalizes on read.

### Wave 3 — Ingestion + UI (3 parallel agents)

- **T03** RSVP/Questions hooks
- **T05** Review study flow
- **T07** vault canonical shape

**Checkpoint**: RSVP block creates smItem; Review screen works with seeded items.

### Wave 4 — Remaining sources (1 agent)

- **T06** Cloze + Slow hooks (after T03 RSVP path validated)

### Wave 5 — QA (1 agent)

- **T08** integration tests + ROADMAP closure

---

## PROMPT T01 — sm2.js pure module

Implement SM-2 Priority Queue T01 — core algorithm module.

**Context**: Read `specs/20260620-sm2-priority-queue/spec.md` (FR-001–007, FR-013), `contracts/sm2-core.md`, `research.md` R1–R2. Branch `20260620-sm2-priority-queue`.

**Files to touch**:
- `src/js/sm2.js` (NEW) — `SM2_DEFAULTS`, `THRESHOLD_RATIO`, `createSmItem`, `normalizeSmItem`, `isOnTime`, `updateSmItem`, `buildReviewQueue`, `getQueueStats`
- `cursor-tests/sm2.test.mjs` (NEW) — 8 tests per contract

**Do NOT touch**: `study.js`, `session-store.js`, HTML yet.

**Success criteria**:
- All pure functions, zero side effects
- Early review preserves interval; on-time q≥3 grows interval; q&lt;3 resets
- `normalizeSmItem` maps `nextReview` → `scheduledDue`, legacy `sourceMode` → `sourceType`

**Reference**: `ROADMAP.md` Wave 1.

criterio de éxito: `node cursor-tests/sm2.test.mjs` passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T02 — Session store normalization

Implement SM-2 T02 — canonical smItems in session-store.

**Context**: `contracts/mode-ingestion.md`, `data-model.md`, `research.md` R3. Depends on T01 `normalizeSmItem`.

**Files to touch**:
- `src/js/session-store.js` — call `normalizeSmItem` on read paths; `upsertSmItem` merges canonical; update `getSmItemsDueToday` to use `scheduledDue`
- `src/js/session-types.js` — validate canonical fields if needed

**Success criteria**:
- Legacy cloze items (`nextReview`, `sourceMode: 'cloze'`) round-trip as canonical
- `getSmItemsDueToday` unchanged call sites, correct semantics

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: manual DevTools upsert/read legacy shape works. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T03 — RSVP / Questions ingestion

Implement SM-2 T03 — block answers feed smItems.

**Context**: `contracts/mode-ingestion.md` RSVP section, `research.md` R6. Depends on T02.

**Files to touch**:
- `src/js/sm2-ingest.js` (NEW) — `registerOrUpdateSmItem`, `mapMcqOutcomeToQuality`
- `src/js/study.js` — hook after block answer / assessment signal path

**Success criteria**:
- Completing RSVP block creates/updates `rsvp_block` smItem with mapped quality
- No duplicate for same `blockId`
- Hook failures log warn, do not break study

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: quickstart Wave 3 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T04 — Review badge on mode select

Implement SM-2 T04 — mode select Review entry + badge.

**Context**: `contracts/review-ui.md`. Depends on T01 `getQueueStats` (T02 optional for real data).

**Files to touch**:
- `index.html` — `btnReview`, `reviewBadge` on `screenModeSelect`
- `src/js/study.js` — badge refresh on mode select show; wire click → `runSm2ReviewSession` stub or T05
- `src/css/main.css` — `.review-badge`
- `sw.js` / `sw-update.js` / `index.html` `?v=` if required by project rules

**Success criteria**:
- Badge shows `dueNow` count when &gt; 0, hidden otherwise
- Review button visible on mode select

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: quickstart Wave 4 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T05 — Review screen priority queue

Implement SM-2 T05 — functional Review study session.

**Context**: `contracts/review-ui.md`, `spec.md` User Stories 1 & 4. Depends on T02.

**Files to touch**:
- `src/js/review.js` — `runSm2ReviewSession`, quality buttons, early chip, empty state
- `src/js/study.js` — wire `btnReview` to `runSm2ReviewSession`
- `src/css/main.css` — `.review-early-chip`

**Success criteria**:
- Queue ordered by `scheduledDue`
- Four quality buttons map to 5/4/3/1
- Early chip when `!isOnTime`; early submit does not grow interval
- LLM `reviewSessionBtn` flow unchanged

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: quickstart Wave 5 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T06 — Cloze + Slow ingestion

Implement SM-2 T06 — Cloze and Slow flashcard hooks.

**Context**: `contracts/mode-ingestion.md` Cloze/Slow sections. Depends on T02, T03 validated.

**Files to touch**:
- `src/js/cloze/study.js` — answer → `registerOrUpdateSmItem`
- `src/js/cloze/pipeline.js` — `persistClozeItemsToShared` canonical shape
- `src/js/slow/phase3.js` — flashcard create → smItem

**Success criteria**:
- Cloze answer updates `cloze_item` smItem
- Slow flashcard creates `slow_flashcard` smItem
- Cloze pipeline generate still works

**Reference**: `ROADMAP.md` Wave 4.

criterio de éxito: quickstart Wave 6 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T07 — Vault canonical shape

Implement SM-2 T07 — align vault decay bridge to canonical SmItem.

**Context**: `contracts/mode-ingestion.md` vault section, `research.md` R4. Depends on T02.

**Files to touch**:
- `src/js/vault/spaced-review.js` — `buildVaultSmItem` canonical fields
- `src/js/review.js` — on vault item review, call `applyVaultReviewObservation`

**Success criteria**:
- `syncVaultToReviewPool` emits `sourceType: 'vault_concept'`, `scheduledDue`
- Non-vault smItems preserved (regression from Post A+ T13)
- Vault review updates mastery

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: quickstart Wave 7 passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T08 — Integration tests + QA closure

Close SM-2 feature with tests and ROADMAP update.

**Context**: `quickstart.md`, all contracts.

**Files to touch**:
- `cursor-tests/20260620_sm2-priority-queue.mjs` (NEW)
- `ROADMAP.md` — mark T01–T08 `[x]`

**Tests must cover**:
- normalize legacy shapes
- early vs on-time update
- queue ordering
- RSVP ingest creates item
- vault + cloze coexistence
- `getSmItemsDueToday` regression

criterio de éxito: both cursor-tests green; quickstart scenarios checked. Ejecuta /validate antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Wave 1**: Lanza **PROMPT T01** (1 agente). Espera tests green.
2. **Wave 2 (paralelo)**: **T02 + T04** (2 agentes).
3. **Wave 3 (paralelo)**: **T03 + T05 + T07** (3 agentes).
4. **Wave 4**: **T06** tras validar T03 en browser.
5. **Wave 5**: **T08** cierre.

**Tiempo mínimo**: Waves 2–3 paralelizan hasta 3 agentes (~35% ahorro vs secuencial).

**Antes de Wave 3**: Confirma `node cursor-tests/sm2.test.mjs` sigue green.

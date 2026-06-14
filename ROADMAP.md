# ROADMAP — Exposure / Retrieval Hub

**Feature**: `20260622-exposure-retrieval-hub` | **Spec**: `specs/20260622-exposure-retrieval-hub/spec.md` | **Plan**: `specs/20260622-exposure-retrieval-hub/plan.md`

**Objective**: Formalize exposure vs retrieval taxonomy; add neutral per-document Retrieval Hub (Questions, Cloze, Recall); route post-exposure completions to hub; move Review to vault-level cross-document SM-2 queue. RSVP embedded block test/socratic unchanged.

**Prerequisites**: `20260612-mode-continuity`, `20260620-sm2-priority-queue`, `20260621-recall-mode`.

**Source draft**: `spec-cambioarch.md`

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | `mode-taxonomy.js` — MODE_TAXONOMY + `getDocumentRetrievalModes()` | — | S | [x] |
| T02 | `screenRetrievalHub` markup + CSS + ui.js refs | — | M | [x] |
| T03 | Hub navigation — `enterRetrievalHub`, library/mode-select entry, back | T01, T02 | M | [x] |
| T04 | Hub option handlers → `enterModeWithContinuity` (Q/C/R) | T03 | S | [x] |
| T05 | Questions block order via `prioritizeByAssessmentSignals` | T01 | M | [x] |
| T06 | Vault Review — `runVaultSm2ReviewSession`, cross-doc write path | T01 | L | [x] |
| T07 | Exposure end redirects — Slow phase 3 + RSVP complete → hub | T03 | M | [x] |
| T08 | Remove per-doc Review from mode select; vault Review on doc library + badge | T06 | M | [x] |
| T09 | Legacy `modes.review` migration noop / strip | T08 | S | [x] |
| T10 | Integration tests + quickstart QA closure | T01–T09 | M | [x] |

## Dependency graph

```text
T01 ──→ T03 ──→ T04 ──→ T07
  │       ↑
T02 ──────┘
T01 ──→ T05
T01 ──→ T06 ──→ T08 ──→ T09
T01–T09 ──→ T10
```

**Parallel Wave 1**: T01 + T02 (2 agents)

**Parallel Wave 2**: T03 + T05 + T06 (3 agents; T03 waits for T01+T02)

**Parallel Wave 3**: T04 + T07 + T08 (3 agents after T03/T06)

**Sequential**: T09 after T08; T10 after all

## Recommended execution order

### Wave 1 — Taxonomy + hub shell (2 parallel agents)

- **T01** pure mode taxonomy module
- **T02** HTML/CSS/ui refs for hub screen

**Checkpoint**: `getDocumentRetrievalModes()` returns 3 modes; hub screen visible in DOM.

### Wave 2 — Navigation + signals + vault (3 parallel agents)

- **T03** `enterRetrievalHub` orchestration + practice entry buttons
- **T05** Questions assessmentSignals block ordering
- **T06** vault Review session + cross-doc upsert

**Checkpoint**: Can open hub from mode select; vault Review loads aggregated queue in DevTools.

### Wave 3 — Wiring + exposure redirects + UI cleanup (3 parallel agents)

- **T04** hub picks delegate to existing mode entry
- **T07** Slow finish + RSVP complete → hub
- **T08** move Review button to doc library; remove from mode select

**Checkpoint**: Slow phase 3 → hub; doc library Review works cross-session.

### Wave 4 — Migration (1 agent)

- **T09** legacy review slot cleanup in session migration

### Wave 5 — QA closure (1 agent)

- **T10** cursor-tests + ROADMAP `[x]` + quickstart sign-off

---

## PROMPT T01 — Mode taxonomy module

Implement Exposure/Retrieval Hub T01 — static mode taxonomy.

**Context**: Read `specs/20260622-exposure-retrieval-hub/spec.md` (FR-001), `data-model.md`, `contracts/mode-taxonomy.md`. Branch `20260622-exposure-retrieval-hub`. Reference draft `spec-cambioarch.md` §2, §5.2.

**Files to touch**:
- `src/js/mode-taxonomy.js` (NEW) — `MODE_TAXONOMY`, `getDocumentRetrievalModes()`, `getModesByRole`, `isExposureMode`, `isVaultMode`
- Optional: re-export from `session-types.js` if project pattern prefers single import site

**Do NOT touch**: study.js, index.html, review.js yet.

**Success criteria**:
- Hub filter returns exactly `questions`, `cloze`, `recall` in stable order
- `review` has `scope: 'vault'` and is excluded from document retrieval list
- Pure module — no DOM/session I/O

**Reference**: `ROADMAP.md` Wave 1.

criterio de éxito: import in DevTools returns 3 hub modes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T02 — Retrieval Hub UI shell

Implement Exposure/Retrieval Hub T02 — hub screen markup and styles.

**Context**: `contracts/retrieval-hub-ui.md`, `spec.md` User Stories 1–2 and 5. Parallel with T01.

**Files to touch**:
- `index.html` — `#screenRetrievalHub`, option cards with `data-retrieval-mode`, `#retrievalHubBackBtn`, `#btnPracticeDocument` on mode select
- `src/js/ui.js` — element refs; extend `showScreen` for `retrievalHub`
- `src/css/main.css` — `.retrieval-hub-screen`, equal-weight option cards
- Bump `SW_VERSION` in `src/js/sw-update.js`, matching `?v=` on `sw-update.js` and `main.js` in `index.html`, and `CACHE_NAME` in `sw.js`

**Success criteria**:
- Three neutral cards (no recommended badge); Cloze never disabled
- Hub hidden by default (`aria-hidden="true"`)
- Visual parity with mode-select card layout

**Reference**: `ROADMAP.md` Wave 1.

criterio de éxito: hub renders with stub data; SW validate test passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T03 — Hub navigation orchestration

Implement Exposure/Retrieval Hub T03 — enter/exit hub wiring.

**Context**: `contracts/hub-navigation.md`, `research.md` R4/R8. Depends on T01, T02.

**Files to touch**:
- `src/js/study.js` — `enterRetrievalHub({ docId, entrySource })`, render options from taxonomy, wire `#btnPracticeDocument`, hub back button
- `src/js/ui.js` — if needed for dynamic option rendering helper

**Do NOT touch**: exposure end redirects (T07) or vault Review (T06) yet.

**Success criteria**:
- Active doc → Practice → hub with 3 options
- No material → upload guidance (reuse upload_required pattern)
- Back returns to mode select or library

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: manual navigation to hub from mode select works. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T04 — Hub mode delegation

Implement Exposure/Retrieval Hub T04 — hub picks call existing mode entry.

**Context**: `contracts/hub-navigation.md`, `mode-bootstrap.js` existing paths. Depends on T03.

**Files to touch**:
- `src/js/study.js` — click handlers on `[data-retrieval-mode]` → `enterModeWithContinuity(mode)`
- Verify Cloze path triggers pipeline without hub generate UI

**Success criteria**:
- Each hub option enters correct mode (bootstrap/resume/generate per existing rules)
- No duplicated mode-entry logic in hub module
- Cloze cold start works from hub without intermediate screen

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: hub → Recall/Questions/Cloze each reach study screen on test doc. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T05 — Questions assessmentSignals prioritization

Implement Exposure/Retrieval Hub T05 — generalize weak-concept targeting to Questions.

**Context**: `contracts/assessment-signals-consumers.md`, `assessment-signals.js`, `spec.md` FR-007. Depends on T01. Can parallel T03.

**Files to touch**:
- `src/js/study.js` (Questions study path) — build block proxies, call `prioritizeByAssessmentSignals`, study in returned order
- `cursor-tests/20260622_exposure-retrieval-hub.mjs` — start with signal ordering test

**Success criteria**:
- Blocks with weak signal concepts appear earlier in Questions session
- Empty signals → default order unchanged
- Hub and direct mode-select entry both use same ordering

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: seeded signals test puts weak-concept block in first half. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T06 — Vault-level Review session

Implement Exposure/Retrieval Hub T06 — cross-document SM-2 review.

**Context**: `contracts/vault-review.md`, `research.md` R3, `session-store.js` `getSmItemsDueToday()`. Depends on T01. Parallel with T03/T05.

**Files to touch**:
- `src/js/review.js` — `runVaultSm2ReviewSession()`; per-item write via `upsertSmItem(item.docId, ...)`
- `src/js/session-store.js` — `getVaultReviewDueCount()` helper if needed
- `src/js/study.js` — redirect `enterModeWithContinuity('review')` to vault path

**Success criteria**:
- Queue built from all sessions' due items
- Rating updates origin document without switching active doc
- Empty queue shows existing empty state

**Reference**: `ROADMAP.md` Wave 2.

criterio de éxito: two docs with due items both appear in vault queue. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T07 — Exposure completion → hub

Implement Exposure/Retrieval Hub T07 — post-exposure redirects.

**Context**: `contracts/hub-navigation.md`, `research.md` R4, `spec.md` FR-003. Depends on T03.

**Files to touch**:
- `src/js/study.js` — Slow `slowPhase3FinishBtn`: `enterRetrievalHub` instead of `enterModeSelectScreen`
- RSVP complete screen CTA → `enterRetrievalHub({ entrySource: 'exposure_complete' })`
- **Do NOT** change embedded block test/socratic handlers

**Success criteria**:
- Slow phase 3 finish lands on hub
- RSVP all-blocks-complete primary path lands on hub
- Mid-block RSVP flow unchanged (regression)

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: quickstart Wave 3 manual pass. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T08 — Review UI relocation

Implement Exposure/Retrieval Hub T08 — vault Review entry on doc library.

**Context**: `contracts/vault-review.md`, `contracts/retrieval-hub-ui.md`, `spec.md` FR-008, FR-011. Depends on T06.

**Files to touch**:
- `index.html` — `#btnVaultReview` + badge on `screenDocLibrary`; remove `#btnReview` from mode select
- `src/js/study.js` — wire vault Review button; `refreshVaultReviewBadge()` on library enter
- Update `startReviewFromRecommendation()` to use vault Review or hub as appropriate

**Success criteria**:
- Mode select has no Review button
- Doc library Review shows aggregate due badge
- Vault Review opens from library without selecting a document

**Reference**: `ROADMAP.md` Wave 3.

criterio de éxito: quickstart Wave 5 steps 1–2 pass. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T09 — Legacy review migration

Implement Exposure/Retrieval Hub T09 — session migration for old review slots.

**Context**: `research.md` R2, `data-model.md` legacy section. Depends on T08.

**Files to touch**:
- `src/js/session-migration.js` (or equivalent normalizer) — strip/noop `modes.review` on load; preserve `shared.smItems`

**Success criteria**:
- Legacy session JSON with `modes.review` loads without error
- smItems untouched
- No schemaVersion bump required

**Reference**: `ROADMAP.md` Wave 4.

criterio de éxito: migration fixture test passes. Ejecuta /validate antes de cerrar este mensaje.

---

## PROMPT T10 — Integration tests + QA closure

Close Exposure/Retrieval Hub with tests and ROADMAP update.

**Context**: `quickstart.md`, all contracts, `spec.md` success criteria.

**Files to touch**:
- `cursor-tests/20260622_exposure-retrieval-hub.mjs` — taxonomy, hub navigation, signals ordering, vault queue aggregation, migration fixture
- `ROADMAP.md` — mark T01–T10 `[x]`
- `specs/20260622-exposure-retrieval-hub/quickstart.md` — note any manual QA gaps

**Tests must cover**:
- `getDocumentRetrievalModes()` shape
- `getSmItemsDueToday()` used for vault queue
- Questions block prioritization with seeded signals
- `review` not in MODE_KEYS / hub list
- Regression: RSVP mid-block path not redirected to hub

**Reference**: `ROADMAP.md` Wave 5.

criterio de éxito: `node cursor-tests/20260622_exposure-retrieval-hub.mjs` green; ROADMAP all [x]. Ejecuta /validate antes de cerrar este mensaje.

---

## Execution instruction

**Launch first (parallel)**:
- PROMPT T01 + PROMPT T02 in two separate agent chats

**Wait for**: both complete; hub shell + taxonomy importable

**Launch second (parallel)**:
- PROMPT T03 + PROMPT T05 + PROMPT T06

**Wait for**: hub navigation works; vault Review callable from console

**Launch third (parallel)**:
- PROMPT T04 + PROMPT T07 + PROMPT T08

**Then sequential**:
- PROMPT T09 → PROMPT T10

**Optimal total**: 3 parallel waves + 2 sequential = minimum calendar time with 3 agents in waves 2–3.

**Follow-up spec (not this ROADMAP)**: `exposure-signals-capture` — guide-chat / Slow sidebar → `shared.exposureSignals`.

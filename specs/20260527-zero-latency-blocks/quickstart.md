# Quickstart: Zero-Latency Block Transitions

**Feature**: `20260527-zero-latency-blocks`  
**Prereqs**: API key; sesión ≥3 bloques confirmados; red estable.

## 1. Prefetch durante estudio (SC-001)

1. Confirm blocks → start block 1.
2. Observe prefetch dot pulsing (generating) while reading block 1 RSVP.
3. Complete questions block 1.
4. **Expect**: Transition overlay opens; status bar shows preparing or ready; dot matches.

## 2. Camino rápido — Siguiente bloque (SC-001, SC-003)

1. Wait until status **Listo ✓** (or finish block slowly so prefetch completes during study).
2. **Expect**: **Siguiente bloque** enabled; no textarea for comments.
3. Click **Siguiente bloque**.
4. **Expect**: RSVP block 2 starts in &lt;1s; no "Finishing up…" long wait; no second full API call (network tab).

## 3. Prefetch not ready (fast reader)

1. Speed through RSVP (skip to questions) on a long block immediately after previous transition.
2. **Expect**: **Siguiente bloque** disabled until ready; indicator shows generating.

## 4. Ajustar siguiente bloque — regen parcial (FR-007)

1. On transition, click **Ajustar siguiente bloque**.
2. Increase test questions +1; confirm.
3. **Expect**: Network shows questions-only call (smaller/faster than full block) OR single regen; RSVP explanation text unchanged from prefetch.
4. Enter block 2 — same explanation as before adjust, new question count.

## 5. Sidebar-only doubts (FR-005)

1. During block 2 RSVP, ask guide in sidebar.
2. Finish RSVP.
3. **Expect**: No inline guide card above questions; answer visible in sidebar history only.

## 6. Regresión (SC-004)

1. Export session .md on tab close.
2. Assessment-informed profiles still change `configKey` (invalidate stale prefetch).
3. Offline pack path unchanged.

## 7. Diccionario en paralelo al prefetch (SC-005)

1. Start block 1; wait for prefetch dot **ready** (block 2 generating finished).
2. **Before** clicking **Siguiente bloque**, open dictionary button or expand dictionary on transition (after finishing block 1 questions).
3. **Expect**: New terms from block 2 appear in dictionary (≥1 term if model returned concepts).

## 8. Export mid-session (SC-006)

1. During block 1 study, wait until block 2 prefetch is `ready`.
2. Click **Save session** (or trigger export) **without** entering block 2.
3. Open downloaded `.md`.
4. **Expect**: Section `## Block 2:` with non-empty explanation; **Concept Dictionary** table includes block-2 terms.

## Pass criteria

| ID | Check | Manual (2026-05-26) |
|----|-------|---------------------|
| SC-001 | Prefetch ready before transition in normal pacing; &lt;1s to RSVP after click | ✓ logic (`triggerPrefetch`, `Listo ✓`, `isPrefetchReadyForKey`); timing/&lt;1s needs live API session |
| SC-002 | No comment textarea on default transition view | ✓ static (`getOrCreateTransitionOverlay` has no textarea) |
| SC-003 | No duplicate full `generateBlock` when fast path + ready | ✓ static + unit (`consume_prefetch` → `getPrefetchedBlock`; continue handler skips `generateBlockDirect`) |
| SC-004 | Export + sidebar + block study E2E | — not re-run this pass |
| FR-007 | Adjust counts only → explanation preserved | ✓ unit (`questions_only` + merge keeps `explanation`) |
| SC-005 | Dictionary shows prefetch concepts before next block | ✓ automated (`20260527_t03-prefetch-write-through.mjs`, `20260527_t11-ui-refresh-prefetch-ready.mjs`); manual §7 optional for live API |
| SC-006 | Mid-session export includes block 2 + dictionary | ✓ automated (`20260527_t04-export-concepts-union.mjs`, `20260527_t10-export-concept-union.mjs`); manual §8 optional for live API |

**Automated**: `node --import ./cursor-tests/register.mjs cursor-tests/20260527_t*.mjs` (T01–T04, T09–T11, validate-t12).

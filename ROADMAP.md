# ROADMAP — RSVP Block Count Recommendation

**Feature**: `20260611-rsvp-block-recommend` | **Spec**: `specs/20260611-rsvp-block-recommend/spec.md` | **Plan**: `specs/20260611-rsvp-block-recommend/plan.md`

**Prerrequisitos externos**: `20260609-flow-recommendation` (analyzer + pedagogical meta); pipeline RSVP `twoPhaseConceptSplit`

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `computeBlockCountRecommendation` — fórmula pura + tests | — | S | [x] |
| T02 | Refactor `session.js` — `runConceptInventory` + `packInventoryToBlocks` | — | M | [x] |
| T03 | `blockSplitCache` — fingerprint, validación, invalidación | — | S | [x] |
| T04 | Markup + CSS — botón Recommend, status, why | — | S | [x] |
| T05 | Wiring `study.js` — handlers recommend/generate + invalidación | T01–T04 | M | [x] |
| T06 | Tests integración + quickstart QA closure | T05 | M | [x] |

## Diagrama de dependencias

```text
T01 ──────────────┐
T02 ──────────────┼──→ T05 ──→ T06
T03 ──────────────┤
T04 ──────────────┘
```

**Paralelizables desde inicio**: T01 + T02 + T03 + T04 (hasta 4 agentes)

**Secuenciales críticos**: T05 → T06

## Orden de ejecución recomendado

### Ola 1 — Fundamentos (paralelo, 4 agentes)
- **T01** recommender puro (`block-count-recommender.js`)
- **T02** split refactor (`session.js`)
- **T03** cache fingerprint (`study.js` o módulo dedicado)
- **T04** HTML + CSS (`index.html`, `main.css`, `ui.js` refs)

### Ola 2 — Integración (1 agente, tras T01–T04)
- **T05** handlers + branch generate con cache

### Ola 3 — Cierre (1 agente)
- **T06** cursor-tests + quickstart QA

**MVP mínimo útil**: T01 + T02 + T05 — recommend + generate reuse sin UI pulida.

---

## PROMPT T01 — Block count recommender

Implementa **T01** del ROADMAP RSVP Block Count Recommendation.

**Contexto**: Feature `20260611-rsvp-block-recommend`. Fórmula determinística en `specs/20260611-rsvp-block-recommend/contracts/block-count-recommender-api.md` y `research.md` R3.

**Archivos**:
- `src/js/recommendation/block-count-recommender.js` (NUEVO) — `computeBlockCountRecommendation(signals)`, `formatBlockCountReasoning(rec)`
- `cursor-tests/20260611_rsvp-block-recommend.mjs` (NUEVO) — sección unit recommender (≥12 casos)

**Reglas clave**:
- Clamp 5–60; sin LLM; exportar `MIN_BLOCKS`, `MAX_BLOCKS`
- `signalsUsed` y `factors` en output para tests
- Reasoning EN 1–2 frases

**Criterio de éxito**: suite recommender pasa con `node --import ./cursor-tests/register.mjs`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Split phase refactor

Implementa **T02** del ROADMAP RSVP Block Count Recommendation.

**Contexto**: Separar inventario de pack en `session.js`. Ver `contracts/block-split-cache.md`.

**Archivos**:
- `src/js/session.js` — exportar `runConceptInventory`, `packInventoryToBlocks`; `twoPhaseConceptSplit` delega en ambas sin cambiar comportamiento externo actual

**Reglas clave**:
- `runConceptInventory` = solo `deepSeekConceptInventory` + progress "Indexing concepts…"
- `packInventoryToBlocks` = pack + chunks + dedup (sin re-indexar)
- Fallback mono split solo en wrapper cuando falle two-phase

**Criterio de éxito**: generate manual RSVP sigue funcionando; exports disponibles para T05. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Block split cache

Implementa **T03** del ROADMAP RSVP Block Count Recommendation.

**Contexto**: Cache efímero con fingerprint. Ver `data-model.md` BlockSplitCache.

**Archivos**:
- `src/js/study.js` (o `src/js/block-split-cache.js` si prefieres módulo) — `buildBlockSplitFingerprint`, `isBlockSplitCacheValid`, `invalidateBlockSplitCache`, `get/setBlockSplitCache`
- Estado en `state.blockSplitCache`

**Reglas clave**:
- Fingerprint: file name+size+lastModified + studyNotes + wordCount
- Invalidar NO al cambiar solo blocksInput
- Tests fingerprint en `cursor-tests/20260611_rsvp-block-recommend.mjs` (ampliar si T01 ya creó archivo)

**Criterio de éxito**: funciones puras testeadas; invalidación documentada. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Recommend UI markup

Implementa **T04** del ROADMAP RSVP Block Count Recommendation.

**Contexto**: DOM IDs en `contracts/recommend-blocks-ui.md`.

**Archivos**:
- `index.html` — `#recommendBlocksBtn`, `#recommendBlocksStatus`, `#recommendBlocksWhy` dentro `#rsvpBlocksSection`
- `src/css/main.css` — estilos mínimos coherentes con create screen
- `src/js/ui.js` — refs en `els`

**Reglas clave**:
- Copy EN según contrato
- `hidden` por defecto en why; botón visible solo RSVP (puede ocultarse vía JS en T05)
- Sin lógica de recommend en T04 — solo markup + CSS + refs

**Criterio de éxito**: IDs presentes en index.html; refs en ui.js. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Study.js wiring

Implementa **T05** del ROADMAP RSVP Block Count Recommendation.

**Contexto**: Tras T01–T04. Ver `contracts/consumer-integration.md`.

**Archivos**:
- `src/js/study.js` — `handleRecommendBlockCount`, modificar generate handler, invalidación file/notes/mode, visibility recommend btn

**Flujos**:
- Recommend: cache hit → skip inventory; miss → `runConceptInventory` → `computeBlockCountRecommendation` → pre-fill blocks
- Generate: cache valid → `packInventoryToBlocks`; else → `twoPhaseConceptSplit`
- Invalidate on file/notes change

**Criterio de éxito**: QA-REC-1 y QA-REC-2 manuales verificables; manual path sin regresión. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Tests + QA closure

Implementa **T06** del ROADMAP RSVP Block Count Recommendation.

**Contexto**: Cerrar feature. Ver `quickstart.md`.

**Archivos**:
- `cursor-tests/20260611_rsvp-block-recommend.mjs` — ampliar: cache invalidation, formula boundaries, exports session
- `cursor-tests/loader.mjs` — registrar suite si aplica
- `specs/20260611-rsvp-block-recommend/quickstart.md` — marcar QA checklist

**Casos mínimos**:
- 12+ recommender unit
- 4+ fingerprint/cache
- Smoke: `runConceptInventory` / `packInventoryToBlocks` exported

**Criterio de éxito**: suite pasa; quickstart QA-REC-1..7 documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (4 chats): PROMPT T01, T02, T03, T04
2. **Esperar** a que los cuatro terminen
3. **Lanzar** PROMPT T05
4. **Lanzar** PROMPT T06 cuando T05 esté listo

**Tiempo total estimado**: 1 ola paralela (4) + 2 secuenciales.

# ROADMAP — Flow Recommendation

**Feature**: `20260609-flow-recommendation` | **Spec**: `specs/20260609-flow-recommendation/spec.md` | **Plan**: `specs/20260609-flow-recommendation/plan.md`

**Prerrequisitos externos**: `20260609-unified-session` T01+T04 · `20260609-doc-hierarchy-index`

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `analyzer.js` — `analyzeText` → TextMetrics | — | M | [x] |
| T02 | Extensión `hierarchy.js` — `pedagogical_meta` + fallback | — | M | [x] |
| T03 | `recommender.js` — tabla de decisión + tiempos | T01, T02 | M | [x] |
| T04 | `tracker.js` — progreso y override | T03 | M | [x] |
| T05 | `session-store` — `modeRecommendation` + `updateRecommendation` | unified T01 | S | [x] |
| T06 | Integración `study.js` — cálculo y lifecycle | T04, T05, unified T04 | M | [x] |
| T07 | Panel de recomendación UI | T06 | M | [x] |
| T08 | Tests integración + quickstart closure | T07 | M | [x] |

## Diagrama de dependencias

```text
T01 ──┐
      ├──→ T03 → T04 ──┐
T02 ──┘                ├──→ T06 → T07 → T08
T05 (unified T01) ─────┘
```

**Paralelizables desde inicio**: T01 + T02 + T05 (si unified-session T01 listo)

**Secuenciales críticos**: T03 → T04 → T06 → T07 → T08

## Orden de ejecución recomendado

### Ola 1 — Núcleo puro (paralelo hasta 3 agentes)
- **T01** analyzer
- **T02** hierarchy pedagogical meta
- **T05** session-store field (si no existe aún)

### Ola 2 — Recomendación (1 agente, tras T01+T02)
- **T03** recommender

### Ola 3 — Tracking (1 agente, tras T03)
- **T04** tracker

### Ola 4 — Orquestación (1 agente, tras T04+T05+unified T04)
- **T06** study.js

### Ola 5 — UI (1 agente, tras T06)
- **T07** panel

### Ola 6 — Cierre
- **T08** tests integración + quickstart

**MVP mínimo útil**: T01–T06 — recomendación calculada y persistida (sin panel visual).

---

## PROMPT T01 — analyzer.js

Implementa **T01** del ROADMAP Flow Recommendation.

**Contexto**: Feature `20260609-flow-recommendation`. Función pura que extrae métricas del markdown sin LLM. Ver `specs/20260609-flow-recommendation/contracts/analyzer-api.md` y `data-model.md` (TextMetrics).

**Archivos**:
- `src/js/recommendation/analyzer.js` (NUEVO) — `analyzeText(markdownText)`
- `cursor-tests/20260609_flow-recommendation-analyzer.mjs` (NUEVO)

**Casos de test mínimos**:
- Paper filosófico sin headings → señales de densidad/estructura
- Apuntes primera persona → `firstPersonRatio` detectado
- Paper con citas `[1]` → `hasBibliography: true`
- Texto < 2k chars → `sizeCategory: 'tiny'`
- 4+ casos adicionales (math, definitions, headings, vocab académico ES/EN)

**Sin cambios en study.js ni hierarchy en esta tarea.**

**Criterio de éxito**: 8+ tests pasan; `analyzeText` es pura y determinística. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — hierarchy pedagogical meta

Implementa **T02** del ROADMAP Flow Recommendation.

**Contexto**: Extender `buildDocumentHierarchy` para devolver `pedagogicalMeta` sin llamada LLM adicional. Ver `specs/20260609-flow-recommendation/contracts/hierarchy-pedagogical-meta.md`.

**Archivos**:
- `src/js/normalization/hierarchy.js` — prompt JSON `{ tree, pedagogical_meta }`, parse, `buildDeterministicPedagogicalMeta`, retorno con `pedagogicalMeta`
- `src/js/normalization/hierarchy-cache.js` — cachear `pedagogicalMeta` en hits LLM
- Tests en `cursor-tests/` o extender tests hierarchy existentes

**Depende de T01** solo para `buildDeterministicPedagogicalMeta` (import `analyzeText`).

**Criterio de éxito**: paper filosófico vía LLM (o mock) → `pedagogicalMeta.genre === 'philosophical'` y `argumentativeDensity >= 4`; modo determinístico devuelve meta sin LLM. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — recommender.js

Implementa **T03** del ROADMAP Flow Recommendation.

**Contexto**: Tabla de decisión determinística. Ver `specs/20260609-flow-recommendation/contracts/recommender-api.md` y `data-model.md`.

**Archivos**:
- `src/js/recommendation/recommender.js` (NUEVO) — `computeModeRecommendation`, `computeStepTimes`, `TIME_FACTORS`, mapa `genreLabel` ES
- `cursor-tests/20260609_flow-recommendation-recommender.mjs` (NUEVO)

**Depende de T01, T02** (tipos/shapes; puede importar fixtures de test).

**Criterio de éxito**: paper filosófico → `primaryFlow[0].mode === 'slow'`; apuntes → `questions` o `rsvp`; tiny → un paso; schema completo sin nulls. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — tracker.js

Implementa **T04** del ROADMAP Flow Recommendation.

**Contexto**: Tracking de progreso sin castigar desviaciones. Ver `specs/20260609-flow-recommendation/contracts/tracker-api.md`.

**Archivos**:
- `src/js/recommendation/tracker.js` (NUEVO) — `updateFlowProgress`, `markStepCompleted`, `recordUserOverride`
- `cursor-tests/20260609_flow-recommendation-tracker.mjs` (NUEVO)

**Depende de T03.**

**Criterio de éxito**: sesión mock con `modes.slow.phase === 3` completada → `completedSteps: ['step_slow_1']`, `currentStepIndex: 1`; override setea `userOverride: true`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — session-store modeRecommendation

Implementa **T05** del ROADMAP Flow Recommendation.

**Contexto**: Persistir recomendación en capa shared. Ver `specs/20260609-flow-recommendation/contracts/consumer-integration.md` §session-store.

**Archivos**:
- `src/js/session-types.js` — `modeRecommendation` en SharedLayer + validación laxa
- `src/js/session-store.js` — default `null`, `updateRecommendation(docId, rec)`
- Test en `cursor-tests/20260609_flow-recommendation-tracker.mjs` o CRUD extendido

**Depende de unified-session T01.** Paralelizable con T01–T04.

**Criterio de éxito**: `createSession` incluye `modeRecommendation: null`; `updateRecommendation` persiste y rehidrata. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — study.js integración

Implementa **T06** del ROADMAP Flow Recommendation.

**Contexto**: Orquestar cálculo post-normalización y lifecycle de modos. Ver `specs/20260609-flow-recommendation/contracts/consumer-integration.md`.

**Archivos**:
- `src/js/study.js` — tras upload: `analyzeText` + `computeModeRecommendation`; en load: `updateFlowProgress`; on enter/exit mode: override + progress

**Depende de T04, T05, unified-session T04.**

**Criterio de éxito**: subir documento nuevo → `session.shared.modeRecommendation` poblado antes de elegir modo; sesión existente no recalcula flujo. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Panel UI

Implementa **T07** del ROADMAP Flow Recommendation.

**Contexto**: Panel no bloqueante en pantalla de selección de modo. Ver `specs/20260609-flow-recommendation/contracts/recommendation-ui.md`.

**Archivos**:
- `index.html` — markup `#recommendationPanel` y hijos
- `src/js/study.js` — `renderRecommendationPanel`, wire CTAs
- `src/css/main.css` — estilos mínimos steps lineales

**Depende de T06.**

**Criterio de éxito**: paper filosófico → panel "Slow → Cloze → Revisión" con tiempo y razón; click override RSVP → abre RSVP y `userOverride: true`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Tests integración y QA

Implementa **T08** del ROADMAP Flow Recommendation.

**Contexto**: Cierre feature. Ver `specs/20260609-flow-recommendation/quickstart.md`.

**Archivos**:
- `cursor-tests/20260609_flow-recommendation-integration.mjs` (NUEVO)
- Casos: upload → recomendación; override; sesión existente; tiempo ~83 min para 10k palabras slow; fallback sin LLM

**Depende de T07.**

**Criterio de éxito**: todos los cursor-tests pasan; checklist quickstart QA-1–QA-7; marcar T01–T08 [x] en este ROADMAP. Ejecuta `/validate` antes de cerrar este mensaje.

---

# ROADMAP — Unified Cross-Mode Session (referencia)

**Feature**: `20260609-unified-session` | **Spec**: `specs/20260609-unified-session/spec.md`

> Feature prerequisito. Ver spec/plan en `specs/20260609-unified-session/`. T01–T04 bloqueantes para flow-recommendation T06.

| ID | Descripción | Estado |
|----|-------------|--------|
| T01 | session-store CRUD | [x] |
| T02 | Migración V1→V2 | [x] |
| T03 | session.js wrapper | [x] |
| T04 | study.js DocumentSession | [x] |
| T05 | Slow escribe shared | [x] |
| T06 | Cloze lee shared | [x] |
| T07 | adapters.js shared | [x] |
| T08 | Pantalla documentos | [x] |
| T09 | Tests integración + QA | [x] |

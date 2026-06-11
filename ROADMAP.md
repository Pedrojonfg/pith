# ROADMAP — Mode Continuity

**Feature**: `20260612-mode-continuity` | **Spec**: `specs/20260612-mode-continuity/spec.md` | **Plan**: `specs/20260612-mode-continuity/plan.md`

**Prerrequisitos externos**: `20260609-unified-session`, `20260609-flow-recommendation`, `20260611-rsvp-block-recommend` (cache RSVP opcional)

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `assessment-signals.js` — extract, merge, prioritize (puro) + tests | — | M | [x] |
| T02 | `session-store` + `session-types` — `uploadMeta`, `assessmentSignals` CRUD | — | S | [x] |
| T03 | `mode-bootstrap.js` — `resolveModeEntryState`, `buildModeSliceFromShared` + tests | — | M | [x] |
| T04 | `study.js` — `enterModeWithContinuity`, recommend upload meta, wire mode entry | T02, T03 | L | [x] |
| T05 | RSVP/Questions → `addConceptsToShared` + `syncAssessmentSignals` en respuestas | T02 | M | [x] |
| T06 | Cloze — `prioritizeByAssessmentSignals` en study order / pipeline | T01, T02 | M | [x] |
| T07 | Flow panel + exit hooks — `updateFlowProgress`, bootstrap en Continue | T04 | M | [x] |
| T08 | Tests integración + quickstart QA closure | T04–T07 | M | [x] |

## Diagrama de dependencias

```text
T01 ──────────────┐
T02 ──────────────┼──→ T04 ──→ T07 ──→ T08
T03 ──────────────┘      ↗
T05 ─────────────────────┘
T06 ─────────────────────┘ (paralelo con T05 tras T02; útil tras T01)
```

**Paralelizables desde inicio**: T01 + T02 + T03 (hasta 3 agentes)

**Paralelizables tras T02**: T05 + T06 (en paralelo con T04 si T03 listo)

**Secuenciales críticos**: T04 → T07 → T08

## Orden de ejecución recomendado

### Ola 1 — Fundamentos (paralelo, 3 agentes)
- **T01** assessment signals puro
- **T02** session-store extensions
- **T03** mode bootstrap puro

### Ola 2 — Integración core (1–2 agentes)
- **T04** study.js continuity wiring (bloqueante)
- **T05** RSVP/Questions sync (paralelo si otro agente libre)

### Ola 3 — Cloze + flujo (paralelo, 2 agentes)
- **T06** Cloze prioritization
- **T07** Flow panel exit hooks

### Ola 4 — Cierre (1 agente)
- **T08** cursor-tests + quickstart QA

**MVP mínimo útil**: T02 + T03 + T04 — recommend → modo sin re-upload.

---

## PROMPT T01 — Assessment signals

Implementa **T01** del ROADMAP Mode Continuity.

**Contexto**: Feature `20260612-mode-continuity`. Contrato en `specs/20260612-mode-continuity/contracts/assessment-signals-api.md` y `data-model.md`.

**Archivos**:
- `src/js/assessment-signals.js` (NUEVO) — `extractSignalsFromBlockSession`, `mergeAssessmentSignals`, `prioritizeByAssessmentSignals`
- `cursor-tests/20260612_mode-continuity.mjs` (NUEVO) — sección unit assessment (≥10 casos)

**Reglas clave**:
- Funciones puras, sin DOM ni localStorage
- Weight según fórmula en data-model
- Mapeo pregunta→concepto con fallbacks documentados

**Criterio de éxito**: suite unit assessment pasa con `node --import ./cursor-tests/register.mjs`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Session store extensions

Implementa **T02** del ROADMAP Mode Continuity.

**Contexto**: Campos opcionales `shared.uploadMeta` y `shared.assessmentSignals`. Ver `data-model.md`.

**Archivos**:
- `src/js/session-store.js` — defaults en `createSession`; `setUploadMeta`, `syncAssessmentSignalsToShared`, `getAssessmentSignals`
- `src/js/session-types.js` — validación opcional de nuevos campos
- `cursor-tests/20260612_mode-continuity.mjs` — tests CRUD signals (ampliar si T01 creó archivo)

**Reglas clave**:
- Backward compatible: sin bump `schemaVersion`
- `syncAssessmentSignalsToShared` usa merge de T01

**Criterio de éxito**: createSession incluye defaults; sync merge persiste en doc mock. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Mode bootstrap

Implementa **T03** del ROADMAP Mode Continuity.

**Contexto**: Contrato `specs/20260612-mode-continuity/contracts/mode-bootstrap-api.md`. Reutiliza `createClozeSession`, `createSlowSession` de `study.js` o extrae imports mínimos.

**Archivos**:
- `src/js/mode-bootstrap.js` (NUEVO) — `resolveModeEntryState`, `buildModeSliceFromShared`
- `cursor-tests/20260612_mode-continuity.mjs` — tests resolve/bootstrap (≥8 casos)

**Reglas clave**:
- `resume` si slice resumible existe
- `bootstrap` si hay `rawMarkdown` sin slice
- `upload_required` solo sin documento

**Criterio de éxito**: tests pure bootstrap pasan. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Study.js continuity wiring

Implementa **T04** del ROADMAP Mode Continuity.

**Contexto**: Tras T02+T03. Ver `contracts/consumer-integration.md` y `bootstrap-create-ui.md`.

**Archivos**:
- `src/js/study.js` — `enterModeWithContinuity`, wire `startModeFromRecommendation`, mode radio, `recommendFlowFromUploadedFile` + `setUploadMeta`
- `index.html` — `#modeMaterialLoadedBanner`
- `src/js/ui.js` — ref banner
- CSS mínimo si hace falta en `main.css`

**Flujos**:
- Recommend upload → pick mode → banner + no file input
- Bootstrap RSVP: Generate usa `shared.rawMarkdown` / `state.lastCleanedMaterialText`
- Resume path sin regresión

**Criterio de éxito**: QA-MC-1 y QA-MC-2 manuales verificables. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — RSVP/Questions shared sync

Implementa **T05** del ROADMAP Mode Continuity.

**Contexto**: Promover inventario y señales a `shared`. Ver `consumer-integration.md`.

**Archivos**:
- `src/js/study.js` — tras generate: `addConceptsToShared`; tras guardar respuestas: `syncAssessmentSignalsToShared`
- Buscar handlers de assessment en RSVP/Questions y enganchar sync

**Reglas clave**:
- `detectedBy: 'rsvp'` en conceptos
- Sync no debe romper sesiones sin `_responses`

**Criterio de éxito**: tras RSVP generate, `doc.shared.conceptInventory.length > 0`; tras wrong answer, signals actualizados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Cloze gap prioritization

Implementa **T06** del ROADMAP Mode Continuity.

**Contexto**: Tras T01+T02. `prioritizeByAssessmentSignals` en orden de estudio Cloze.

**Archivos**:
- `src/js/cloze/study.js` y/o `src/js/cloze/pipeline.js` — aplicar priorización al generar `studyOrder`
- `cursor-tests/20260612_mode-continuity.mjs` — test ≥60% weak-first cuando hay signals

**Reglas clave**:
- Sin LLM extra v1; solo reordenar
- Sin signals → orden actual

**Criterio de éxito**: QA-MC-4 verificable; test prioritize pasa. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Flow panel + exit hooks

Implementa **T07** del ROADMAP Mode Continuity.

**Contexto**: Tras T04. Continue del flow panel debe usar `enterModeWithContinuity`. Ver `consumer-integration.md`.

**Archivos**:
- `src/js/study.js` — hooks al volver a `modeSelect` desde ready/slow/cloze; `updateFlowProgress` + `renderFlowPanel`

**Reglas clave**:
- `recommendationStartBtn` ya wired — asegurar usa continuity
- Pasos completados reflejan estado real cross-mode

**Criterio de éxito**: QA-MC-3 y QA-MC-5 verificables. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Tests + QA closure

Implementa **T08** del ROADMAP Mode Continuity.

**Contexto**: Cerrar feature. Ver `quickstart.md`.

**Archivos**:
- `cursor-tests/20260612_mode-continuity.mjs` — ampliar integración smoke
- `cursor-tests/loader.mjs` — registrar suite si aplica
- `specs/20260612-mode-continuity/quickstart.md` — marcar QA checklist

**Casos mínimos**:
- 10+ assessment unit
- 8+ bootstrap unit
- Smoke: resolve bootstrap con doc mock
- Sync inventory + signals integration

**Criterio de éxito**: suite pasa; quickstart QA-MC-1..7 documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (3 chats): PROMPT T01, T02, T03
2. **Esperar** a que los tres terminen
3. **Lanzar** PROMPT T04 (bloqueante)
4. **Lanzar en paralelo** PROMPT T05 y T06
5. **Lanzar** PROMPT T07 cuando T04 esté listo
6. **Lanzar** PROMPT T08 cuando T05–T07 estén listos

**Tiempo total estimado**: 1 ola (3) + 1 secuencial (T04) + 1 ola (2) + 2 secuenciales (T07, T08).

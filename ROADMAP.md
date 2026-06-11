# ROADMAP — RSVP Assessment Reposition

**Feature**: `20260611-rsvp-assessment-reposition` | **Spec**: `specs/20260611-rsvp-assessment-reposition/spec.md` | **Plan**: `specs/20260611-rsvp-assessment-reposition/plan.md`

**Prerrequisitos externos**: `20260611-rsvp-block-recommend` (split inventory/pack), `20260612-mode-continuity` (promoción inventario completo a shared)

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `config/flags.js` — feature flags + `isPrePackingAssessmentEnabled()` | — | S | [x] |
| T02 | `session.js` — persistencia `knowledge_profile`, `assessment_skipped`, `packing_ignored_profile` | — | S | [x] |
| T03 | `api.js` — `generatePrePackingAssessmentItems`, `evaluatePrePackingAssessmentResponses`, normalizers | — | M | [x] |
| T04 | `api.js` + `session.js` — `packInventoryToBlocks` con `knowledgeProfile`, N techo, `learning_goal` | T02 | M | [x] |
| T05 | `study.js` — orquestación inventory → assessment gate → pack (flujo principal) | T01–T04 | L | [x] |
| T06 | UI pantalla Assessment pre-packing (quiz MCQ + skip) | T03, T05 | M | [x] |
| T07 | UI resultados + packing paralelo + ignorar perfil + diff | T04, T05, T06 | M | [x] |
| T08 | Desactivar assessment legacy post-packing en RSVP (flag-gated) | T01, T05 | M | [x] |
| T09 | Tests integración + quickstart QA closure | T05–T08 | M | [x] |

## Diagrama de dependencias

```text
T01 ──────────────┐
T02 ──────────────┼──→ T04 ──→ T05 ──→ T06 ──→ T07 ──→ T09
T03 ──────────────┘              ↘ T08 ↗
```

**Paralelizables desde inicio**: T01 + T02 + T03 (hasta 3 agentes)

**Paralelizables tras T05**: T06 + T08 (2 agentes)

**Secuenciales críticos**: T04 → T05 → T07 → T09

## Orden de ejecución recomendado

### Ola 1 — Fundamentos (paralelo, 3 agentes)
- **T01** feature flags
- **T02** session meta helpers
- **T03** assessment LLM API

### Ola 2 — Pack con perfil (1 agente)
- **T04** packInventoryToBlocks + deepSeekPackConceptsToBlocks

### Ola 3 — Orquestación core (1 agente, bloqueante)
- **T05** study.js flow wiring

### Ola 4 — UI + legacy (paralelo, 2 agentes)
- **T06** assessment quiz screen
- **T08** gate legacy post-packing

### Ola 5 — Resultados (1 agente)
- **T07** results screen + parallel + ignorar

### Ola 6 — Cierre (1 agente)
- **T09** cursor-tests + quickstart QA

**MVP mínimo útil**: T01 + T02 + T03 + T04 + T05 + T06 — quiz pre-packing reduce blockIndex sin pantalla de resultados pulida.

---

## PROMPT T01 — Feature flags

Implementa **T01** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Feature `20260611-rsvp-assessment-reposition`. Contrato en `specs/20260611-rsvp-assessment-reposition/contracts/feature-flags.md`.

**Archivos**:
- `src/js/config/flags.js` (NUEVO) — `ASSESSMENT_FLAGS`, `isPrePackingAssessmentEnabled()`

**Reglas clave**:
- Valores por defecto según spec §7
- Export named; sin side effects
- Sin dependencias de DOM

**Criterio de éxito**: módulo importable desde `study.js`; `isPrePackingAssessmentEnabled()` retorna `true` por defecto. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Session meta persistence

Implementa **T02** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Ver `specs/20260611-rsvp-assessment-reposition/data-model.md` (SessionMeta, KnowledgeProfile).

**Archivos**:
- `src/js/session.js` — helpers: `setKnowledgeProfile`, `getKnowledgeProfile`, `setAssessmentSkipped`, `setPackingIgnoredProfile`, defaults en sesión activa
- `cursor-tests/20260611_rsvp-assessment-reposition.mjs` (NUEVO) — sección meta CRUD (≥6 casos)

**Reglas clave**:
- Backward compatible; campos opcionales en `_meta`
- `assessment_skipped` solo en skip de quiz; `packing_ignored_profile` solo en "Ignorar"
- No filtrar inventario al persistir

**Criterio de éxito**: tests meta pasan con `node --import ./cursor-tests/register.mjs`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Pre-packing assessment API

Implementa **T03** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Contrato `specs/20260611-rsvp-assessment-reposition/contracts/pre-packing-assessment-api.md`.

**Archivos**:
- `src/js/api.js` — `generatePrePackingAssessmentItems`, `evaluatePrePackingAssessmentResponses`, `normalizeAssessmentItems`, `normalizeKnowledgeProfile`
- `cursor-tests/20260611_rsvp-assessment-reposition.mjs` — tests normalizers (≥10 casos, sin LLM live)

**Reglas clave**:
- MCQ v1; "I don't know" manejado en evaluador cuando answer coincide constante UI
- Evaluator failure retorna `null`
- `coverage` calculado en normalizer
- Reutilizar `parseModelJsonValue` / patrones existentes

**Criterio de éxito**: normalizers y validación pasan en cursor-tests. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Pack with knowledge profile

Implementa **T04** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Contrato `specs/20260611-rsvp-assessment-reposition/contracts/pack-with-profile.md`. Principio de capas: inventario completo siempre.

**Archivos**:
- `src/js/api.js` — extender `deepSeekPackConceptsToBlocks` con `knowledgeProfile`, prompt N=techo
- `src/js/session.js` — extender `packInventoryToBlocks` con `knowledgeProfile` opcional; mapear `learning_goal`, `mastery_adjusted`; `splitRunMeta.profile_applied`
- `cursor-tests/20260611_rsvp-assessment-reposition.mjs` — invariantes: `final_n <= requested_n`, inventario length unchanged (mock pack)

**Reglas clave**:
- No omitir prerequisitos dominados si hay dependiente no dominado
- `ASSESSMENT_MASTERY_THRESHOLD` desde flags
- Bloques dominados ausentes del índice, no marcados `skipped`

**Criterio de éxito**: tests de invariantes pasan; pack sin profile comportamiento idéntico al actual. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Study.js flow orchestration

Implementa **T05** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Tras T01–T04. Ver `specs/20260611-rsvp-assessment-reposition/contracts/consumer-integration.md`.

**Archivos**:
- `src/js/study.js` — refactor handler `generateBlocksForm`: inventory/cache → gate assessment → pack; `PrePackingFlowState` ephemeral; prefetch items tras graph
- Promover inventario **completo** a shared (`addConceptsToShared`) sin filtrar

**Flujos**:
- Flag off → path legacy directo a pack (sin regresión)
- Flag on → assessment gate antes de pack
- Skip → pack sin profile, `assessment_skipped`

**Criterio de éxito**: con flag on, generate no llama pack antes del assessment (salvo skip). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Assessment quiz UI

Implementa **T06** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Contrato `specs/20260611-rsvp-assessment-reposition/contracts/assessment-ui.md`. Depende de T03+T05.

**Archivos**:
- `index.html` — `#prePackingAssessmentScreen` y elementos hijos
- `src/js/ui.js` — refs
- `src/css/main.css` — `.pre-packing-assessment-*`
- `src/js/study.js` — render quiz, progress, skip, collect responses → evaluate

**Reglas clave**:
- Opción "No lo sé" siempre visible
- Sin timer (diferente del legacy runner)
- Grafo decorativo reutiliza mount existente

**Criterio de éxito**: QA manual quiz 3+ preguntas navegable; skip llega a pack. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Results UI + parallel packing

Implementa **T07** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Tras T06. §6.3 spec + `ASSESSMENT_PARALLEL_PACKING`.

**Archivos**:
- `index.html` — `#prePackingResultsScreen` y botones Accept / Ignore / Detail
- `src/css/main.css` — `.pre-packing-results-*`
- `src/js/study.js` — parallel `packingPromise` tras evaluate; diff `hasta N → M`; ignorar re-pack sin profile; omitir pantalla si cero dominados

**Reglas clave**:
- Accept confirma bloques ya empaquetados (spinner si pending)
- Ignorar: `packing_ignored_profile: true`, profile persistido
- Grafo sigue completo tras accept

**Criterio de éxito**: QA-AR-1, QA-AR-3, QA-AR-5 de quickstart verificables. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Legacy assessment removal

Implementa **T08** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Clarificación 1B. Cuando `isPrePackingAssessmentEnabled()`, RSVP no usa post-packing assessment.

**Archivos**:
- `src/js/study.js` — ocultar `assessmentChoiceWrap` / no invocar `generateAssessmentQuestions`, `applyAssessmentResults`, gap synthesis inicial en RSVP
- `index.html` — condicional o hidden por defecto con flag on

**Reglas clave**:
- Flag off restaura comportamiento legacy intacto
- Questions mode sin cambios
- No borrar funciones legacy; solo gate

**Criterio de éxito**: QA-AR-4 — sin assessment post-bloques en RSVP con flag on. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T09 — Tests + QA closure

Implementa **T09** del ROADMAP RSVP Assessment Reposition.

**Contexto**: Cerrar feature. Ver `specs/20260611-rsvp-assessment-reposition/quickstart.md`.

**Archivos**:
- `cursor-tests/20260611_rsvp-assessment-reposition.mjs` — suite completa (meta, normalizers, pack invariants, smoke orchestration helpers)
- `cursor-tests/loader.mjs` — registrar suite si aplica
- `specs/20260611-rsvp-assessment-reposition/quickstart.md` — marcar QA checklist

**Casos mínimos**:
- 6+ meta CRUD
- 10+ normalizer unit
- Pack layer invariants
- Flag gate smoke

**Criterio de éxito**: suite pasa; quickstart QA-AR-1..6 documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (3 chats): PROMPT T01, T02, T03
2. **Esperar** a que los tres terminen
3. **Lanzar** PROMPT T04
4. **Lanzar** PROMPT T05 (bloqueante)
5. **Lanzar en paralelo** PROMPT T06 y T08
6. **Lanzar** PROMPT T07 cuando T06 esté listo
7. **Lanzar** PROMPT T09 cuando T07 y T08 estén listos

**Tiempo total estimado**: 1 ola (3) + 1 secuencial (T04) + 1 secuencial (T05) + 1 ola (2) + 2 secuenciales (T07, T09).

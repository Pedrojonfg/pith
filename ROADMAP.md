# ROADMAP — RSVP Pre-Generation Assessment Reliability

**Feature**: `20260616-fix-pregen-assessment` | **Spec**: `specs/20260616-fix-pregen-assessment/spec.md` | **Plan**: `specs/20260616-fix-pregen-assessment/plan.md`

**Objetivo**: El knowledge check **pre-generación** en RSVP aparece siempre tras inventario y antes del editor de bloques. Sin assessment **post-generación**. Fix del prefetch roto + skip silencioso.

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | Prefetch alineado — `itemsPromise` con `n_test`/`n_socratic`/`materialText`; quitar `.catch(() => [])`; `buildPrefetchConfigKey` | — | S | [x] |
| T02 | Runner resiliente — invalidar promesa vacía/stale; no auto `handlePrePackingSkip` en catch | T01 | M | [x] |
| T03 | Validación API — `generatePrePackingAssessmentItems` rechaza `n_test`/`n_socratic` no finitos | — | S | [x] |
| T04 | UX fallo generación — error visible + Retry + Skip explícito | T02 | M | [x] |
| T05 | Gate legacy post-generación — tests regresión `goAfterBlocksConfirmed` | T01 | S | [x] |
| T06 | Suite tests + quickstart QA closure | T01–T05 | M | [x] |

## Diagrama de dependencias

```text
T01 ──→ T02 ──→ T04 ──→ T06
T03 ──↗
T01 ──→ T05 ──→ T06
```

**Paralelizables desde inicio**: T01 + T03 (2 agentes)

**Paralelizables ola 2**: T02 + T05 (2 agentes, tras T01)

**Secuencial crítico**: T02 → T04 → T06

## Orden de ejecución recomendado

### Ola 0 — Fundación (2 agentes en paralelo)
- **T01** prefetch contract (`study.js`)
- **T03** API validation (`api.js`)

### Ola 1 — Runner + gate (2 agentes en paralelo)
- **T02** runner resiliente (`study.js`)
- **T05** legacy gate tests

### Ola 2 — Error UX (1 agente)
- **T04** retry/skip UI

### Ola 3 — Cierre (1 agente)
- **T06** tests + QA

**MVP mínimo útil**: T01 + T03 + T02 — knowledge check aparece en flujo feliz.

---

## PROMPT T01 — Prefetch alineado

Implementa **T01** del ROADMAP RSVP Pre-Generation Assessment Reliability.

**Contexto**: Bug: tras "Generate blocks" en RSVP el assessment pre-packing no aparece porque `itemsPromise` se crea sin `n_test`/`n_socratic` (solo `maxItems`) y `.catch(() => [])` cachea fallo vacío. Spec: `specs/20260616-fix-pregen-assessment/spec.md`. Contrato: `specs/20260616-fix-pregen-assessment/contracts/prefetch-assessment.md`.

**Archivos**:
- `src/js/study.js` — bloque `prePackingFlow` en generate handler (~6883): pasar `materialText: cleanedText`, `n_test`/`n_socratic` de `resolvePrePackingQuestionConfig()`, añadir `prefetchConfigKey` vía nuevo helper `buildPrefetchConfigKey({ qCfg, conceptInventory, cleanedText })`; **eliminar** `.catch(() => [])`

**Reglas**:
- Mismos args que `enterPrePackingAssessmentRunner` usa para generar
- Exportar `buildPrefetchConfigKey` si tests lo necesitan

**Criterio de éxito**: prefetch usa Questions params; sin swallow de errores. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Runner resiliente

Implementa **T02** del ROADMAP. Depende de **T01**.

**Contexto**: Contratos `prefetch-assessment.md` y `assessment-failure-ux.md`. `enterPrePackingAssessmentRunner` no debe reutilizar `itemsPromise` vacía ni auto-skip.

**Archivos**:
- `src/js/study.js` — `enterPrePackingAssessmentRunner`, `enterPrePackingAssessmentScreen`: si `!itemsPromise` OR `prefetchConfigKey` mismatch OR resultado `[]`, recrear promise; en `catch`, **no** llamar `handlePrePackingSkip()` — delegar a T04 o dejar error para T04

**Reglas**:
- `questions.length === 0` → error, no packing
- Mantener `renderAssessmentChrome` + skip buttons cuando pantalla assessment activa

**Criterio de éxito**: runner regenera si prefetch falló; sin skip silencioso en catch. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Validación API

Implementa **T03** del ROADMAP. Independiente de T01 (paralelo).

**Contexto**: Contrato `specs/20260616-fix-pregen-assessment/contracts/api-input-validation.md`. `Number(undefined)` → NaN bypassa checks actuales.

**Archivos**:
- `src/js/api.js` — `generatePrePackingAssessmentItems` Questions path: validar `n_test`/`n_socratic` finitos antes del LLM; mensajes de error estables

**Reglas**:
- No defaults silenciosos a 2+1 — caller debe pasar counts
- Legacy MCQ path sin cambios de comportamiento

**Criterio de éxito**: llamada sin `n_test` lanza error claro sin LLM. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — UX fallo generación

Implementa **T04** del ROADMAP. Depende de **T02**.

**Contexto**: Contrato `assessment-failure-ux.md`. FR-004: usuario debe ver error y elegir retry o skip.

**Archivos**:
- `src/js/study.js` — `retryPrePackingAssessmentGeneration()`, wire error state en runner catch; botones Retry + Skip
- `index.html` — solo si hace falta región UI (preferir reutilizar `#testError` / assessment chrome)

**Reglas**:
- Retry limpia `itemsPromise` y reintenta con config actual
- Skip solo en click explícito

**Criterio de éxito**: fallo simulado no lleva al editor de bloques sin acción del usuario. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Gate legacy post-generación

Implementa **T05** del ROADMAP. Depende de **T01** (verificación).

**Contexto**: Contrato `legacy-assessment-gate.md`. Owner no quiere assessment post-generación.

**Archivos**:
- `src/js/study.js` — verificar `goAfterBlocksConfirmed`, `setAssessmentUiDefaults`; no añadir rutas nuevas a `goToInitialAssessment` cuando flag on
- `cursor-tests/20260616_fix-pregen-assessment.mjs` — tests documentados del gate (import flags + inspección de funciones exportadas o smoke strings)

**Reglas**:
- No borrar pantalla legacy del DOM (rollback)
- Solo asegurar gate + test

**Criterio de éxito**: tests documentan que flag on → no post-generation path. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Tests + QA closure

Implementa **T06** del ROADMAP. Depende de **T01–T05**.

**Contexto**: `specs/20260616-fix-pregen-assessment/quickstart.md`

**Archivos**:
- `cursor-tests/20260616_fix-pregen-assessment.mjs` — suite: `buildPrefetchConfigKey`, API validation throws, prefetch param contract (sin LLM live)
- `cursor-tests/loader.mjs` — registrar si aplica
- `specs/20260616-fix-pregen-assessment/quickstart.md` — marcar QA checklist
- `ROADMAP.md` — marcar T01–T06 [x]

**Casos mínimos**:
- API throws on missing n_test/n_socratic
- prefetchConfigKey cambia cuando cambian counts
- documentación gate legacy

**Criterio de éxito**: suite pasa; QA-PA-1..PA-6 documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (2 chats): **PROMPT T01**, **PROMPT T03**
2. **Esperar** T01 y T03
3. **Lanzar en paralelo** (2 chats): **PROMPT T02**, **PROMPT T05**
4. **Esperar** T02
5. **Lanzar** **PROMPT T04**
6. **Lanzar** **PROMPT T06**

**Tiempo total estimado**: 4 olas; máximo 2 agentes en paralelo.

**Prioridad si hay prisa**: T01 → T03 → T02 (MVP: knowledge check visible en generate normal).

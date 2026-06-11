# Feature: RSVP Pre-Packing Assessment — Questions Mode Parity

**Versión:** 1.0  
**Fecha:** 2026-06-12  
**Módulo:** RSVP — Pre-Packing Assessment  
**Prioridad:** P0  
**Estado:** Clarified  
**Prerrequisito:** `20260611-rsvp-assessment-reposition` (flujo inventory → assessment → pack implementado)

## Clarifications

### Session 2026-06-12

- Q: ¿Qué significa "equivalente a una sesión del modo Questions"? → A: Misma **estructura de ítems** (`type: test | socratic`), mismas reglas de generación (4 opciones A–D con paridad, feedback en test, socráticas abiertas), mismo **conteo** (`n_test` + `n_socratic` de la sesión/create form), mismo **render** (pantallas `test` / `socratic` existentes: markdown/LaTeX, botones A–D, feedback post-respuesta). El assessment sigue siendo pre-packing y alimenta `knowledge_profile`.
- Q: ¿Se mantiene la pantalla custom `prePackingAssessment`? → A: **No** — se elimina del flujo activo; se reutilizan las pantallas Questions. Skip permanece accesible (header o acción equivalente).
- Q: ¿Cuántas preguntas? → A: Exactamente `n_test` test + `n_socratic` socráticas (defaults sesión: 2+1), no `ASSESSMENT_ITEMS_MAX` arbitrario ni ~4 MCQ sueltas.
- Q: ¿Cómo se mapea a `knowledge_profile`? → A: Cada ítem lleva `concept_id` (o edge). Test: auto-score + confidence por acierto. Socrática: evaluador LLM conservador → mastery por concepto. "No lo sé" en test → `none`.
- Q: ¿Qué pasa con el evaluador batch actual? → A: Se reemplaza/amplía para aceptar respuestas Questions-format; test no requiere LLM para puntuar.

---

## 1. Problema

El assessment pre-packing implementado en `20260611-rsvp-assessment-reposition` genera ~4–7 ítems MCQ con prompt mínimo, normalizer `type: mcq`, opciones como array de strings, y UI custom (`screenPrePackingAssessment`) sin markdown, sin feedback, sin socráticas, sin paridad de opciones ni reglas pedagógicas del modo Questions.

Resultado: preguntas mal hechas, mal formateadas, y experiencia disonante respecto al resto del producto.

---

## 2. Solución

**Reutilizar el stack Questions** para generación, normalización y UI del assessment pre-packing, manteniendo el contrato de salida `knowledge_profile` para block packing.

```
concept_inventory + material
    → generatePrePackingAssessmentBlock (Questions schema)
    → normalize + shuffle (mismos helpers que bloques)
    → runner en pantallas test/socratic (modo assessment)
    → evaluate → knowledge_profile → pack
```

### Invariantes

| Aspecto | Modo Questions (bloque) | Assessment pre-packing (nuevo) |
|---------|---------------------------|--------------------------------|
| Tipos | `test`, `socratic` | Igual |
| Conteo | `n_test` + `n_socratic` | Igual (sesión/create) |
| Test options | `{A,B,C,D}` + `answer` + `feedback` | Igual |
| Socrática | abierta, sin opciones | Igual |
| Render | `renderTestQuestion`, `renderSocraticQuestion` | Reutilizar (modo assessment) |
| Prompt rules | `MC_OPTION_PARITY`, `TEST_FEEDBACK`, `QUESTION_PEDAGOGY` | Igual (fuente: inventario + chunks) |
| Salida | progreso de bloque | `knowledge_profile` |

### Fuera de scope

- Connection questions entre bloques (no hay bloques previos en assessment)
- Explicación RSVP del bloque (no hay lectura previa)
- Cambiar el flujo inventory → pack ni la pantalla de resultados

---

## 3. Requisitos funcionales

### FR-1 — Generación Questions-equivalente

- `generatePrePackingAssessmentItems` (o sucesor) debe devolver un pseudo-bloque `{ questions: [...] }` compatible con `normalizeBlockJson` / `normalizeTestQuestion`.
- Prompt debe incluir `concept_inventory`, chunks de material referenciados, y reglas pedagógicas de `buildQuestionsOnlySystemPrompt`.
- Cada pregunta debe incluir `concept_id` (obligatorio) para mapeo a perfil.

### FR-2 — Conteo

- Generar exactamente `n_test` test y `n_socratic` socráticas desde `resolveBlockQuestionConfig(0)` o defaults de sesión.
- `ASSESSMENT_ITEMS_MAX` deja de ser el driver de conteo (puede quedar como techo de seguridad `n_test + n_socratic ≤ 8`).

### FR-3 — UI

- Eliminar uso activo de `screenPrePackingAssessment` en el flujo feliz.
- Runner assessment: reutiliza `screenTest` y `screenSocratic` con flag `prePackingFlow.runnerMode === 'assessment'`.
- Skip assessment visible sin romper layout Questions.
- Test: feedback tras responder (como estudio); en assessment no avanza bloque sino siguiente pregunta → evaluación.
- Socrática: textarea + submit; evaluación al final del quiz (no tutor interactivo bloqueante por pregunta).

### FR-4 — Evaluación → knowledge_profile

- Test: comparar `chosen` vs `answer`; correcto → `partial` mínimo (full si feedback indica precisión); incorrecto/dont-know → `none`.
- Socrática: LLM evaluador por ítem → mastery conservador.
- Agregar por `concept_id`; `coverage` y `assessed_at` sin cambios semánticos.

### FR-5 — Regresión

- Flujo skip, parallel packing, results screen, legacy gate: sin cambios de comportamiento.
- Flag `ASSESSMENT_BEFORE_PACKING: false` → sin cambios.

---

## 4. Criterios de aceptación

- [ ] Assessment muestra preguntas con markdown/LaTeX renderizado como en modo Questions.
- [ ] Test tiene 4 botones A–D, feedback visible tras responder.
- [ ] Incluye socráticas cuando `n_socratic > 0`.
- [ ] Conteo = `n_test` + `n_socratic` de la sesión (no ~4 MCQ genéricas).
- [ ] `knowledge_profile` se genera y packing funciona igual que hoy.
- [ ] `screenPrePackingAssessment` no se muestra en flujo activo.
- [ ] cursor-tests cubren normalizer y mapping test-score → profile.

---

## 5. Referencias

- `specs/20260611-rsvp-assessment-reposition/` — flujo base
- `src/js/api.js` — `buildQuestionsOnlySystemPrompt`, `generatePrePackingAssessmentItems`
- `src/js/study.js` — `renderTestQuestion`, `renderSocraticQuestion`, `enterPrePackingAssessmentScreen`

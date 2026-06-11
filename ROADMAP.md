# ROADMAP — RSVP Assessment Questions Parity

**Feature**: `20260612-rsvp-assessment-questions-parity` | **Spec**: `specs/20260612-rsvp-assessment-questions-parity/spec.md` | **Plan**: `specs/20260612-rsvp-assessment-questions-parity/plan.md`

**Prerrequisito**: `20260611-rsvp-assessment-reposition` (T01–T09 completos)

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `api.js` — `buildPrePackingAssessmentSystemPrompt` + `normalizePrePackingAssessmentQuestions` + revisar `generatePrePackingAssessmentItems` | — | M | [x] |
| T02 | `api.js` — `scorePrePackingTestResponses` + evaluador socrático revisado | — | M | [x] |
| T03 | `flags.js` — `ASSESSMENT_USE_QUESTIONS_UI`, deprecar `ASSESSMENT_ITEMS_MAX` como conteo | T01 | S | [x] |
| T04 | `study.js` — assessment runner reutilizando `renderTestQuestion` / `renderSocraticQuestion` | T01, T02 | L | [x] |
| T05 | Eliminar happy-path `screenPrePackingAssessment`; skip chrome en runner | T04 | S | [x] |
| T06 | Tests + quickstart QA closure | T01–T05 | M | [x] |

## Diagrama de dependencias

```text
T01 ──→ T03 ──→ T05 ──→ T06
T02 ──→ T04 ──↗
T01 ──→ T04
```

**Paralelizables desde inicio**: T01 + T02 (2 agentes)

**Secuenciales críticos**: T04 → T05 → T06

## Orden de ejecución recomendado

### Ola 1 — API (paralelo, 2 agentes)
- **T01** generación Questions-parity
- **T02** evaluación test + socrática

### Ola 2 — Flags (1 agente)
- **T03** feature flags

### Ola 3 — Runner UI (1 agente, bloqueante)
- **T04** study.js runner mode

### Ola 4 — Cleanup + QA (secuencial)
- **T05** deprecar pantalla custom
- **T06** cursor-tests + quickstart

**MVP mínimo útil**: T01 + T02 + T04 — assessment con formato Questions aunque skip chrome sea básico.

---

## PROMPT T01 — Assessment generation (Questions parity)

Implementa **T01** del ROADMAP RSVP Assessment Questions Parity.

**Contexto**: Feature `20260612-rsvp-assessment-questions-parity`. El assessment pre-packing actual genera MCQ mal formateadas; debe usar el mismo schema y reglas que modo Questions. Contrato: `specs/20260612-rsvp-assessment-questions-parity/contracts/assessment-generation.md`.

**Archivos**:
- `src/js/api.js` — `buildPrePackingAssessmentSystemPrompt`, `normalizePrePackingAssessmentQuestions`, revisar `generatePrePackingAssessmentItems` para aceptar `n_test`, `n_socratic`, `materialText`
- `cursor-tests/20260612_rsvp-assessment-questions-parity.mjs` (NUEVO) — tests normalizer (≥8 casos, sin LLM live)

**Reglas clave**:
- Reutilizar `MC_OPTION_PARITY_RULES`, `TEST_FEEDBACK_RULES`, `QUESTION_PEDAGOGY_RULES` de Questions
- Cada pregunta lleva `concept_id` obligatorio
- Post-process: `normalizeTestQuestion` + `shuffleTestQuestionsInList`
- Mantener `normalizeAssessmentItems` legacy para rollback

**Criterio de éxito**: normalizer valida counts, concept_id, options A–D, feedback. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Assessment evaluation

Implementa **T02** del ROADMAP RSVP Assessment Questions Parity.

**Contexto**: Contrato `specs/20260612-rsvp-assessment-questions-parity/contracts/assessment-evaluation.md`.

**Archivos**:
- `src/js/api.js` — `scorePrePackingTestResponses`, revisar `evaluatePrePackingAssessmentResponses` para pipeline test (sync) + socrática (LLM)
- `cursor-tests/20260612_rsvp-assessment-questions-parity.mjs` — tests scoring (≥6 casos)

**Reglas clave**:
- Test: scoring determinista; dont-know → none
- Merge por concept_id (max mastery)
- Fallo LLM socrático: retornar perfil solo de test si hay datos

**Criterio de éxito**: tests scoring pasan con `node --import ./cursor-tests/register.mjs`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Feature flags

Implementa **T03** del ROADMAP RSVP Assessment Questions Parity.

**Contexto**: Contrato `specs/20260612-rsvp-assessment-questions-parity/contracts/feature-flags.md`.

**Archivos**:
- `src/js/config/flags.js` — `ASSESSMENT_USE_QUESTIONS_UI`, `ASSESSMENT_LEGACY_MCQ_UI`, `isAssessmentQuestionsUiEnabled()`

**Reglas clave**:
- Default: Questions UI on, legacy off
- `ASSESSMENT_ITEMS_MAX` ya no dirige conteo en study.js (usar n_test + n_socratic)

**Criterio de éxito**: helpers importables; defaults correctos. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Assessment runner UI

Implementa **T04** del ROADMAP RSVP Assessment Questions Parity.

**Contexto**: Contrato `specs/20260612-rsvp-assessment-questions-parity/contracts/assessment-runner-ui.md`. Depende de T01+T02.

**Archivos**:
- `src/js/study.js` — `prePackingFlow.runnerMode`, `enterPrePackingAssessmentRunner`, guards en `getActiveQuestionContext` / `handleTestAnswer`, socratic submit handler
- `index.html` — skip affordance en test/socratic si necesario (`#assessmentRunnerSkip`)
- `src/js/ui.js` — refs

**Reglas clave**:
- Reutilizar `renderTestQuestion` y `renderSocraticQuestion` sin duplicar markup
- No escribir `recordResponse` de sesión de estudio durante assessment
- Pasar `n_test`/`n_socratic` desde `resolveBlockQuestionConfig(0)` a generación
- `materialText` desde `prePackingFlow.cleanedText`

**Criterio de éxito**: QA manual — assessment abre pantalla test con botones A–D y feedback. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Deprecate custom assessment screen

Implementa **T05** del ROADMAP RSVP Assessment Questions Parity.

**Contexto**: Tras T04. Happy path no usa `screenPrePackingAssessment`.

**Archivos**:
- `src/js/study.js` — `enterPrePackingAssessmentScreen` delega a runner cuando `isAssessmentQuestionsUiEnabled()`; legacy path si flag off
- `src/css/main.css` — `.assessment-runner-chrome` si aplica

**Reglas clave**:
- `ASSESSMENT_LEGACY_MCQ_UI: true` restaura pantalla custom intacta
- Skip assessment sigue funcionando desde runner

**Criterio de éxito**: con flags default, nunca se muestra `screenPrePackingAssessment`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Tests + QA closure

Implementa **T06** del ROADMAP RSVP Assessment Questions Parity.

**Contexto**: Cerrar feature. Ver `specs/20260612-rsvp-assessment-questions-parity/quickstart.md`.

**Archivos**:
- `cursor-tests/20260612_rsvp-assessment-questions-parity.mjs` — suite completa
- `cursor-tests/loader.mjs` — registrar suite si aplica
- `specs/20260612-rsvp-assessment-questions-parity/quickstart.md` — marcar QA checklist

**Casos mínimos**:
- 8+ normalizer unit
- 6+ scoring unit
- Flag gate smoke

**Criterio de éxito**: suite pasa; QA-AQP-1..5 documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (2 chats): PROMPT T01, PROMPT T02
2. **Esperar** a que ambos terminen
3. **Lanzar** PROMPT T03
4. **Lanzar** PROMPT T04 (bloqueante)
5. **Lanzar** PROMPT T05
6. **Lanzar** PROMPT T06

**Tiempo total estimado**: 1 ola (2) + 1 secuencial (T03) + 1 secuencial (T04) + 2 secuenciales (T05, T06).

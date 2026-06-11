# Research: RSVP Assessment Questions Parity

**Feature**: `20260612-rsvp-assessment-questions-parity`  
**Date**: 2026-06-12

## R1 — Schema de preguntas

**Decision**: Adoptar schema Questions (`type: "test" | "socratic"`, options `{A,B,C,D}`, `answer`, `feedback`) + campo extendido `concept_id` por ítem.

**Rationale**: `normalizeTestQuestion`, `shuffleTestQuestionsInList`, y `renderTestQuestion` ya esperan este shape. El normalizer actual `normalizeAssessmentItems` (mcq array) es incompatible.

**Alternatives considered**:
- Adaptar render custom a Questions look — duplica trabajo y diverge
- Mantener mcq y mejorar prompt solo — no resuelve formato/UI

## R2 — Prompt de generación

**Decision**: Nuevo `buildPrePackingAssessmentSystemPrompt` en `api.js`, derivado de `buildQuestionsOnlySystemPrompt` con:
- Input: `concept_inventory`, `edges`, material chunks (concat de `chunk_refs`)
- Sin connection questions, sin explanation block
- Cobertura: al menos una pregunta por concepto THESIS/ARGUMENT prioritario hasta agotar budget
- Mismas constantes: `MC_OPTION_PARITY_RULES`, `TEST_FEEDBACK_RULES`, `QUESTION_PEDAGOGY_RULES`

**Rationale**: Una sola fuente de verdad pedagógica; el usuario percibe la misma calidad que Questions.

**Alternatives considered**:
- Llamar `deepSeekRegenerateBlockQuestions` con explanation sintética — frágil, explanation fake degrada preguntas
- Reusar `generateAssessmentQuestions` post-packing — orientado a block summaries, no inventario

## R3 — Conteo de preguntas

**Decision**: `n_test` + `n_socratic` desde `resolveBlockQuestionConfig(0)` / sesión activa en create flow. Techo: `MAX_N_TEST` (5) + 3 socráticas = 8 total (igual que bloques).

**Rationale**: Spec clarification: "equivalente a una sesión Questions". `ASSESSMENT_ITEMS_MAX: 7` deja de dirigir conteo.

**Alternatives considered**:
- Escalar por número de conceptos — impredecible, rompe expectativa del usuario
- Fijo 5 MCQ — es el problema actual

## R4 — UI runner

**Decision**: Modo `prePackingFlow.runnerMode = 'assessment'` que:
1. Materializa pseudo-bloque en `prePackingFlow.assessmentBlock`
2. Usa `state.activeBlockIndex = -1` o sentinel + `prePackingFlow.questionIndex`
3. Intercepta `handleTestAnswer` / socratic submit para no `recordResponse` de sesión de estudio ni avanzar bloques
4. Reutiliza `renderTestQuestion` / `renderSocraticQuestion` con guards

**Rationale**: Máxima paridad visual; una sola implementación de render markdown/LaTeX/feedback.

**Alternatives considered**:
- iframe o componente nuevo — over-engineering
- Mantener `screenPrePackingAssessment` mejorada — sigue siendo segunda UI

## R5 — Evaluación test vs socrática

**Decision**:
- **Test**: scoring determinista en cliente (`chosen === answer`); mapping: correct → `partial` (0.6 conf) si no hay señal extra, `full` (0.9) si ítem marcado `assessment_precision: true` en metadata opcional; wrong → `none` (0.15); dont-know → `none` (0.1)
- **Socrática**: batch LLM `evaluatePrePackingAssessmentResponses` ampliado para recibir respuestas texto + rubric conservador
- Agregar por `concept_id`: tomar peor mastery si conflicto

**Rationale**: Test no necesita LLM (más rápido, determinista). Socrática requiere comprensión semántica.

**Alternatives considered**:
- LLM para todo — latencia y costo innecesarios en MCQ
- Solo test, n_socratic=0 forzado — pierde paridad Questions

## R6 — "No lo sé" en test

**Decision**: Quinto affordance como botón secundario (no opción LLM), igual que hoy pero estilizado como Questions. Mapea a `PREPACKING_DONT_KNOW` constant.

**Rationale**: Evita contaminar paridad A–D del LLM; ya existe en flujo reposition.

## R7 — Deprecación UI custom

**Decision**: `screenPrePackingAssessment` permanece en DOM pero no se invoca en happy path; `enterPrePackingAssessmentScreen` redirige a runner. CSS `.pre-packing-assessment-*` sin nuevos estilos salvo skip chrome.

**Rationale**: Rollback rápido si flag `ASSESSMENT_QUESTIONS_LEGACY_UI` (opcional, default off).

## R8 — Tests

**Decision**: Suite dedicada para: normalizer Questions-shape + concept_id; test score aggregation; runner state machine smoke (pure helpers exportados).

**Rationale**: UI integration manual en quickstart; LLM no en CI.

# Contract: Flow Progress Tracker API

**Module**: `src/js/recommendation/tracker.js`

## Public API

```js
/**
 * Evalúa session.modes y actualiza completedSteps + currentStepIndex.
 * No muta el input; retorna copia.
 * @param {ModeRecommendation} recommendation
 * @param {import("../../session-types.js").DocumentSession} session
 * @returns {ModeRecommendation}
 */
export function updateFlowProgress(recommendation, session)

/**
 * @param {ModeRecommendation} recommendation
 * @param {string} stepId
 * @returns {ModeRecommendation}
 */
export function markStepCompleted(recommendation, stepId)

/**
 * @param {ModeRecommendation} recommendation
 * @param {string} chosenMode — 'rsvp'|'slow'|'cloze'|'questions'
 * @returns {ModeRecommendation}
 */
export function recordUserOverride(recommendation, chosenMode)
```

## updateFlowProgress logic

Para cada `ModeStep` en `primaryFlow`, si `id` no está en `completedSteps`, evaluar condición de completado (ver `data-model.md`). Al completar: push id, set `completedAt`, avanzar `currentStepIndex` al siguiente no completado.

Modos usados fuera de orden también marcan completado — no penalizar.

## recordUserOverride logic

- `userOverride = true`
- `currentStepIndex = -1` (flujo ignorado para intro panel)
- No borrar `primaryFlow`

## Immutability

Funciones retornan nuevo objeto (spread); callers persisten vía `updateRecommendation`.

## Tests

`cursor-tests/20260609_flow-recommendation-tracker.mjs` — caso slow phase 3 → `completedSteps: ['step_slow_1']`, `currentStepIndex: 1`.

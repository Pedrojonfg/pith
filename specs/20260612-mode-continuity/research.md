# Research: Mode Continuity

**Feature**: `20260612-mode-continuity` | **Date**: 2026-06-11

## R1 — Punto de fricción actual (recomendación → modo)

**Decision**: El documento ya se persiste en `recommendFlowFromUploadedFile` vía `ensureDocumentSessionForUpload`, pero `startModeFromRecommendation` → `enterCreateScreenForMode` → `showModeResumeOrUpload` muestra el formulario de upload cuando no existe `modes[slot]`.

**Rationale**: La capa de datos está; falta orquestación de entrada (bootstrap) que use `shared.rawMarkdown` sin exigir segundo file input.

**Alternatives considered**:
- Pre-llenar el `<input type="file">` — imposible por seguridad del navegador.
- Auto-disparar generate al entrar — demasiado agresivo; mejor pantalla “material loaded” con CTA explícito (Generate / Continue).

## R2 — Patrón de bootstrap por modo

**Decision**: Nuevo módulo `mode-bootstrap.js` con `resolveModeEntryState(doc, mode)` que devuelve una de: `resume` | `bootstrap` | `upload_required`.

| Modo | Sin slice | Con slice incompleto | Con slice completo/resumible |
|------|-----------|----------------------|------------------------------|
| RSVP | bootstrap desde shared + CTA generate | resume ready/blocks | resume |
| Questions | igual RSVP | resume | resume |
| Slow | createSlowSession desde shared | resume por phase | resume |
| Cloze | createClozeSession desde shared | resume pipeline UI | resume study |
| Review | startReviewFromSessionBlocks | — | — |

**Rationale**: Centraliza lógica que hoy está dispersa en `showModeResumeOrUpload`, handlers de upload y flow panel.

**Alternatives considered**:
- Duplicar lógica en cada handler — rechazado (4 copias, drift).
- Forzar auto-generate LLM al entrar — rechazado (coste, necesita API key).

## R3 — Inventario compartido RSVP → shared

**Decision**: Tras `twoPhaseConceptSplit` / `packInventoryToBlocks`, llamar `addConceptsToShared(docId, inventory, { detectedBy: 'rsvp' })`. Cloze ya lee `shared.conceptInventory` en `shouldSkipClozePhase0`.

**Rationale**: Spec unified-session ya define el contrato; hoy el inventario vive en `session._meta.material_graph` sin promoción sistemática a `shared`.

**Alternatives considered**:
- Solo cache efímero `blockSplitCache` — no persiste cross-mode tras reload.

## R4 — Señales de laguna (assessment signals)

**Decision**: Nuevo campo opcional `shared.assessmentSignals: AssessmentSignal[]`:

```js
{
  canonicalId: string,      // concepto si mapeable
  blockIndex: number | null,
  sourceMode: 'rsvp' | 'questions',
  wrongCount: number,
  correctCount: number,
  lastResult: 'wrong' | 'correct',
  lastAt: number,
  weight: number            // derivado para priorización
}
```

Sincronizar desde `_responses.blocks[bi].questions[qi]` comparando `user_answer` vs `correct_answer` (o heurística existente de scoring).

**Rationale**: Cloze necesita datos estructurados en shared, no parsear slices RSVP en cada pipeline run.

**Alternatives considered**:
- Leer `_responses` en tiempo real en pipeline — acoplado al schema de bloque RSVP.
- Duplicar en `cloze.generationMeta` — no reutilizable por otros modos.

## R5 — Priorización Cloze por lagunas

**Decision**: Función pura `prioritizeClozeStudyOrder(items, assessmentSignals)` y hook en pipeline fase de ordenación / `studyOrder` inicial: conceptos con `weight >= threshold` primero; objetivo ≥60% de primeros N ítems con laguna si existen.

**Rationale**: Spec SC-003; no requiere más ítems LLM, solo reordenar y opcionalmente sesgar selección de nodos en fases 2–4.

**Alternatives considered**:
- Regenerar todos los ítems — costoso.
- UI “refuerzo” separada — scope P3; reordenar es MVP.

## R6 — Contexto de upload tras recomendación

**Decision**: Persistir en `state` (sesión UI) y opcionalmente `shared.uploadMeta`:

```js
{ fileName, originalFormat, uploadedAt }
```

`recommendFlowFromUploadedFile` ya tiene el `File`; guardar metadatos para `materialMeta` en slices creados por bootstrap.

**Rationale**: `createClozeSession` / `createSlowSession` requieren `fileName`; sin esto bootstrap crea slices con nombres vacíos.

## R7 — Continuar siguiente paso del flujo

**Decision**: `recommendationStartBtn` y nuevo handler post-completion llaman `bootstrapModeFromDocument(mode)` en lugar de solo `enterCreateScreenForMode`. Tras salir de modo (ready screen / phase complete), invocar `updateFlowProgress` + `renderFlowPanel` si el usuario vuelve a mode select.

**Rationale**: Tracker ya existe (`updateFlowProgress`); falta enganchar en exit points y en bootstrap.

## R8 — “Nueva sesión” en un modo

**Decision**: `newSessionModeBtn` resetea solo `doc.modes[slot]`; no toca `shared` salvo flag explícito futuro. Confirmación existente se mantiene.

**Rationale**: FR-010 de la spec; comportamiento ya parcialmente alineado.

## R9 — Validación schema

**Decision**: `assessmentSignals` y `uploadMeta` opcionales en `validateDocumentSession`; default `[]` / `null` en `createSession`.

**Rationale**: Migración backward-compatible sin bump de `schemaVersion`.

## R10 — Testing

**Decision**: Suite `cursor-tests/20260612_mode-continuity.mjs` con:
- Pure: assessment-signals extract/merge, bootstrap resolve states, cloze prioritize
- Integration smoke: recommend upload → bootstrap RSVP shows loaded state (mock doc)

**Rationale**: Consistente con features hermanas (`20260611`, `20260609`).

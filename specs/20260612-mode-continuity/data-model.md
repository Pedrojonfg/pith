# Data Model: Mode Continuity

**Feature**: `20260612-mode-continuity`

Extiende `DocumentSession.shared` de `20260609-unified-session`. No incrementa `schemaVersion`.

## SharedLayer (extensiones)

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `uploadMeta` | `UploadMeta \| null` | no | `null` | Metadatos del último archivo subido para este documento |
| `assessmentSignals` | `AssessmentSignal[]` | no | `[]` | Lagunas detectadas en RSVP/Questions |

Campos existentes reutilizados sin cambio: `rawMarkdown`, `docHierarchy`, `conceptInventory`, `annotations`, `modeRecommendation`, `smItems`.

## UploadMeta

| Field | Type | Description |
|-------|------|-------------|
| `fileName` | `string` | Nombre original del archivo |
| `originalFormat` | `string` | Extensión o MIME simplificado (`pdf`, `md`, …) |
| `uploadedAt` | `string` | ISO timestamp |

**Write rule**: Actualizar en `recommendFlowFromUploadedFile` y en upload normal del create screen cuando se crea/actualiza documento.

## AssessmentSignal

| Field | Type | Description |
|-------|------|-------------|
| `canonicalId` | `string` | ID estable del concepto (si mapeable) |
| `conceptLabel` | `string` | Fallback display si no hay canonicalId |
| `blockIndex` | `number \| null` | Bloque RSVP/Questions origen |
| `sourceMode` | `'rsvp' \| 'questions'` | Modo que generó la señal |
| `wrongCount` | `number` | Respuestas incorrectas acumuladas |
| `correctCount` | `number` | Respuestas correctas posteriores |
| `lastResult` | `'wrong' \| 'correct'` | Último resultado |
| `lastAt` | `number` | ms timestamp |
| `weight` | `number` | Prioridad derivada (mayor = más laguna) |

### Weight formula (determinística)

```
weight = wrongCount - correctCount * 0.5
if lastResult === 'wrong' then weight += 1
if lastResult === 'correct' && correctCount > wrongCount then weight = max(0, weight - 1)
```

**Invariant**: `canonicalId` o `conceptLabel` debe estar presente.

## ModeEntryResolution (runtime, no persistido)

| Field | Type | Values |
|-------|------|--------|
| `kind` | `string` | `'resume' \| 'bootstrap' \| 'upload_required'` |
| `mode` | `string` | `rsvp \| slow \| cloze \| questions \| review` |
| `reason` | `string` | Debug / UI hint |
| `bootstrapPayload` | `object \| null` | Datos para crear slice sin upload |

## State transitions

```text
[Upload for recommendation]
    → DocumentSession created/activated
    → shared.uploadMeta set
    → shared.modeRecommendation computed

[User picks mode from flow panel]
    → resolveModeEntryState(doc, mode)
        → resume: load modes[slot], navigate to ready/reader/cloze panel
        → bootstrap: create slice from shared.rawMarkdown, show CTA (no file input)
        → upload_required: only if no rawMarkdown (edge)

[RSVP answer saved]
    → syncAssessmentSignalsFromSlice(docId, rsvpSlice)
    → optional: addConceptsToShared on generate

[User completes mode step]
    → updateFlowProgress(recommendation, doc)
    → panel shows next step + Continue CTA

[User: New session in mode]
    → modes[slot] = null
    → shared unchanged
    → re-enter → bootstrap
```

## Consumer modules

| Module | Reads | Writes |
|--------|-------|--------|
| `mode-bootstrap.js` | `shared.*`, `modes[slot]` | `modes[slot]` on bootstrap create |
| `assessment-signals.js` | slice `_responses`, block concepts | — (pure) |
| `session-store.js` | — | `assessmentSignals`, `uploadMeta` |
| `study.js` | all | orchestration |
| `cloze/pipeline.js` | `assessmentSignals`, `conceptInventory` | `studyOrder` |

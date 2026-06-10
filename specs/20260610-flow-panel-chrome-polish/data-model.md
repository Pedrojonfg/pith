# Data Model: Flow Panel & Study Chrome Polish

**Feature**: `20260610-flow-panel-chrome-polish`

## ChromeVisibilityContext

Entrada derivada en runtime (no persistida).

| Field | Type | Description |
|-------|------|-------------|
| `screenId` | string | `modeSelect`, `create`, `test`, `socratic`, `between`, `slowReader`, etc. |
| `studyMode` | enum | `rsvp`, `slow`, `cloze`, `questions` |
| `blockReadWanted` | boolean | Proveedor de contenido de bloque activo |
| `hasConcepts` | boolean | Sesión tiene conceptos en diccionario |
| `offline` | boolean | `isOfflineMode()` |
| `assessmentActive` | boolean | `body.assessment-active` |

### Salida: ChromeVisibility

| Field | Type | Rule |
|-------|------|------|
| `showBlockReadFab` | boolean | FR-001 |
| `showGuideFab` | boolean | FR-002 |
| `showDictionaryFab` | boolean | Igual que guía en between con conceptos; inline dict no usa FAB |

## FlowPanelViewState

Derivado de documento activo (no persistido).

| Value | Condition |
|-------|-----------|
| `cta_upload` | Pantalla mode-select/create con material pendiente de recomendación |
| `intro` | `modeRecommendation` presente, `completedSteps.length === 0`, `!userOverride` |
| `progress` | `modeRecommendation` presente, `completedSteps.length > 0`, `!userOverride` |
| `hidden` | Sin doc, `userOverride`, o sin `modeRecommendation` |

## ModeRecommendation (sin cambios)

Reutiliza esquema de `specs/20260609-flow-recommendation/data-model.md`.

Campos UI consumidos:
- `analysis.genreLabel`, `analysis.estimatedReadTimeMin`
- `primaryFlow[]`, `quickFlow[]`
- `reasoning`, `currentStepIndex`, `completedSteps[]`
- `userOverride`

Campos pedagógicos para «Why» (vía session o recomendación):
- `pedagogicalMeta.genreReasoning` si disponible en doc/hierarchy cache
- fallback: `reasoning`

## FlowProgressStep (vista)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | ModeStep.id |
| `label` | string | ModeStep.label |
| `status` | enum | `completed`, `current`, `upcoming` |
| `estimatedTimeMin` | number | Opcional en tooltip |

## DOM contract summary

Ver `contracts/flow-panel-ui.md` y `contracts/chrome-visibility.md`.

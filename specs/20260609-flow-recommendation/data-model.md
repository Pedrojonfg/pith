# Data Model: Flow Recommendation

**Feature**: `20260609-flow-recommendation`

## TextMetrics

Salida de `analyzeText(markdownText)`. Todos los campos requeridos.

| Field | Type | Description |
|-------|------|-------------|
| `charCount` | `number` | Longitud del markdown |
| `wordCount` | `number` | Palabras (split whitespace) |
| `estimatedReadTimeMin` | `number` | `ceil(wordCount / 200)` |
| `structureSignals.hasExplicitHeadings` | `boolean` | Regex `^#{1,6}\s` |
| `structureSignals.headingDensity` | `number` | headings / (wordCount/1000) |
| `structureSignals.avgParagraphLength` | `number` | palabras/párrafo media |
| `structureSignals.longParagraphRatio` | `number` | 0–1, párrafos > 150 palabras |
| `contentSignals.hasBibliography` | `boolean` | `(Autor, año)`, `[1]`, etc. |
| `contentSignals.hasMathNotation` | `boolean` | `$`, `\frac`, `∑`, etc. |
| `contentSignals.hasDefinitionPatterns` | `boolean` | "se define como", "denomina", etc. |
| `contentSignals.academicVocabDensity` | `number` | 0–1 ratio |
| `contentSignals.firstPersonRatio` | `number` | 0–1 ratio yo/nosotros/I/we |
| `sizeCategory` | enum | `tiny` <2k, `short` 2–8k, `medium` 8–30k, `long` 30–80k, `very_long` >80k chars |

## PedagogicalMeta

| Field | Type | Description |
|-------|------|-------------|
| `genre` | enum | `philosophical`, `scientific_theoretical`, `scientific_empirical`, `essay`, `lecture_notes`, `textbook_chapter`, `unknown` |
| `argumentativeDensity` | `1..5` | Entero |
| `conceptualLoad` | `1..5` | Entero |
| `primaryLearningGoal` | enum | `understand_argument`, `memorize_facts`, `learn_procedure`, `survey_field` |
| `genreReasoning` | `string` | ≤ 20 palabras (LLM) o heurística |

**Source**: LLM (`method: 'llm_meta'`) o `buildDeterministicPedagogicalMeta` (`method: 'deterministic'`).

## ModeStep

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | e.g. `step_slow_1` |
| `mode` | enum | `rsvp`, `slow`, `cloze`, `questions`, `review` |
| `label` | `string` | UI corto |
| `description` | `string` | Hint pedagógico |
| `estimatedTimeMin` | `number` | Desde `TIME_FACTORS` |
| `optional` | `boolean` | Default false |
| `completedAt` | `number \| null` | ms timestamp |
| `skippedAt` | `number \| null` | ms timestamp |

## ModeRecommendation

Persistido en `session.shared.modeRecommendation`.

| Field | Type | Description |
|-------|------|-------------|
| `computedAt` | `number` | ms timestamp |
| `method` | enum | `llm_meta`, `deterministic` |
| `analysis.genre` | `string` | Copia de genre |
| `analysis.argumentativeDensity` | `number` | |
| `analysis.conceptualLoad` | `number` | |
| `analysis.estimatedReadTimeMin` | `number` | De TextMetrics |
| `analysis.genreLabel` | `string` | Localizado ES |
| `primaryFlow` | `ModeStep[]` | Flujo completo |
| `quickFlow` | `ModeStep[]` | Flujo abreviado |
| `reasoning` | `string` | 1–2 frases usuario |
| `currentStepIndex` | `number` | 0-based; -1 si ignorado |
| `completedSteps` | `string[]` | IDs completados |
| `userOverride` | `boolean` | Usuario eligió otro modo |

### TIME_FACTORS (constantes)

```js
rsvp:      words => ceil(words / 400)
slow:      words => ceil(words / 120)
cloze:     items => ceil(items * 0.5)
questions: words => ceil(words / 800)
review:    items => ceil(items * 0.3)
```

## SharedLayer extension

Añadir a `SharedLayer` (unified-session):

| Field | Type | Default |
|-------|------|---------|
| `modeRecommendation` | `ModeRecommendation \| null` | `null` |

## Completion conditions (tracker)

| mode | Condition |
|------|-----------|
| `slow` | `modes.slow.phase === 3` y fase 3 completada (`graphEnrichedUnlocked` o flag equivalente) |
| `rsvp` | Todos los bloques leídos + assessment final respondido |
| `cloze` | `studyProgress` ≥ 80% ítems con respuesta correcta |
| `questions` | Todos los bloques con ≥1 pregunta respondida |
| `review` | `getSmItemsDueToday(docId).length === 0` al salir del modo |

## State transitions

```text
Upload (new docId)
  ├─ analyzeText(markdown)
  ├─ buildDocumentHierarchy → pedagogicalMeta
  ├─ computeModeRecommendation → shared.modeRecommendation
  └─ saveActiveSession

Upload (existing docId)
  └─ updateFlowProgress only; no recompute primaryFlow

Mode select screen
  ├─ currentStepIndex === 0 && !userOverride → show intro panel
  ├─ completedSteps.length > 0 → show progress panel
  └─ userOverride → hide intro panel

Enter mode
  ├─ mode !== recommended step → recordUserOverride
  └─ on exit → updateFlowProgress
```

## Validation rules

- `primaryFlow.length >= 1` siempre
- `quickFlow.length >= 1` siempre
- `currentStepIndex` en `[-1, primaryFlow.length - 1]`
- `completedSteps` ⊆ ids de `primaryFlow`
- Enteros `argumentativeDensity`, `conceptualLoad` clamp 1–5

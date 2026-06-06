# Data Model: Slow Mode — Lectura Profunda

**Feature**: `20260528-slow-mode`

## Storage: `sessions_by_mode`

| Field | Type | Notes |
|-------|------|-------|
| `rsvp` | `ActiveSession \| null` | Slot RSVP; schema actual sin cambios en raíz |
| `slow` | `ActiveSession \| null` | Slot Slow; `studyMode: 'slow'` + sub-objeto `slow` |

**Migration**: Si `active_session` existe y `sessions_by_mode` no → `{ rsvp: active_session, slow: null }`.

**Write rules**:
- Guardar en slot del `studyMode` activo.
- Nueva sesión en modo X reemplaza solo `sessions_by_mode[X]`.

## ActiveSession (Slow slot)

| Field | Type | Notes |
|-------|------|-------|
| `studyMode` | `'slow'` | Discriminador |
| `rev` | `number` | Versión para export/resume |
| `materialMeta` | `{ fileName, originalFormat, uploadedAt }` | |
| `llmModel` | `string` | `deepseek` \| `gemini-2.5-flash` |
| `slow` | `SlowSessionData` | Ver abajo |

Campos RSVP (`blocks`, `n_blocks`, etc.) **ausentes** en slot slow.

## SlowSessionData

| Field | Type | Notes |
|-------|------|-------|
| `normalizedTextFull` | `string` | Documento completo post-pipeline |
| `normalizedFormat` | `'html_min' \| 'markdown'` | |
| `readingScope` | `ReadingScope` | Subtexto activo |
| `phase` | `'scope' \| 'phase0' \| 'phase1' \| 'phase2' \| 'phase3' \| 'complete'` | |
| `criticalMode` | `boolean` | Default `false` |
| `fillableMapMode` | `boolean` | Fase 0 alternativa |
| `phase0` | `Phase0Orientation \| null` | |
| `phase0Status` | `'idle' \| 'generating' \| 'ready' \| 'failed' \| 'skipped'` | |
| `currentPageIndex` | `number` | 0-based viewport page |
| `maxReadCharEnd` | `number` | Mayor offset leído (anti-spoiler) |
| `typography` | `SlowTypography` | fontSize, lineHeight, fontFamily |
| `annotations` | `Annotation[]` | |
| `findings` | `Finding[]` | Hallazgos registrados |
| `checkpointsDismissed` | `string[]` | IDs de sección descartados |
| `depthScore` | `DepthScore \| null` | Calculado en Fase 3 |
| `graphEnrichedUnlocked` | `boolean` | Tras Fases 1+3 completas |

## ReadingScope

| Field | Type | Notes |
|-------|------|-------|
| `kind` | `'full' \| 'chapter' \| 'section'` | |
| `charStart` | `number` | Inclusive, en `normalizedTextFull` |
| `charEnd` | `number` | Exclusive |
| `label` | `string` | Título heading o "Documento completo" |

**Invariant**: `0 <= charStart < charEnd <= normalizedTextFull.length`.

**Derived**: `scopeText = normalizedTextFull.slice(charStart, charEnd)`.

## Phase0Orientation

| Field | Type | Notes |
|-------|------|-------|
| `thesis` | `string` | Bloque 1 |
| `argumentMap` | `ArgumentMapNode[]` | P1, P2, I, C con estado |
| `conceptsToFind` | `{ term, authorUsage, graphTermId? }[]` | 3–5 |
| `guideQuestion` | `string` | Pregunta guía |
| `criticalExaminePoints` | `string[]` | Solo si `criticalMode` |
| `fillableBlanks` | `FillableMapEntry[]` | Si `fillableMapMode` |

## Annotation

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | UUID corto |
| `type` | `AnnotationType` | `≈`, `?`, `→`, etc. |
| `charStart` | `number` | En coordenadas de **scope** (0 = inicio scope) |
| `charEnd` | `number` | Exclusive |
| `userText` | `string` | Texto generado por usuario |
| `createdAt` | `number` | epoch ms |
| `aiReply` | `string \| null` | Para `⚑`, `⇑`, queries IA |
| `graphLinks` | `{ termId, relation }[]` | Para `⟷`, `🔗` |

**Invariant**: `0 <= charStart < charEnd <= scope.length`.

## SectionBoundary

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | slug del heading |
| `charStart` | `number` | En coordenadas scope |
| `charEnd` | `number` | Fin de sección (inicio siguiente o EOF) |
| `title` | `string` | |

## DepthScore

| Field | Type | Notes |
|-------|------|-------|
| `total` | `number` | Suma ponderada |
| `byType` | `Record<AnnotationType, number>` | |
| `penalties` | `{ annotationId, reason }[]` | Solo Fase 3 |
| `generativeRatio` | `number` | Anotaciones con texto / total marcas |

## Finding

| Field | Type | Notes |
|-------|------|-------|
| `conceptTerm` | `string` | De Fase 0 |
| `annotationId` | `string` | Anotación que disparó match |
| `revealedInPhase1` | `boolean` | `true` si mapa rellenable |

## SlowTypography

| Field | Type | Notes |
|-------|------|-------|
| `fontSizePx` | `number` | Default 18 |
| `lineHeight` | `number` | Default 1.6 |
| `fontFamily` | `string` | DM Sans stack |

## Pagination cache (runtime, no persistido)

| Field | Type | Notes |
|-------|------|-------|
| `breakpoints` | `{ pageIndex, charStart, charEnd }[]` | Recalculado al cambiar typography |
| `cacheKey` | `string` | Hash tipografía + scope length |

## State transitions

```text
scope → phase0 → phase1 ⇄ phase2 (checkpoints intercalados) → phase3 → complete
```

- `phase0` → `phase1`: usuario confirma/colapsa orientación (o skip tras fallo IA).
- `phase1` → `phase3`: usuario marca lectura completa del scope.
- `phase3` → `complete`: usuario termina módulos elegidos; `graphEnrichedUnlocked = true`.

## UI state (runtime)

| Field | Type | Notes |
|-------|------|-------|
| `selectedStudyMode` | `'rsvp' \| 'slow' \| null` | Sin preselección en create screen |
| `modeResumeChoice` | `'continue' \| 'new' \| null` | Tras elegir modo |
| `focusMode` | `boolean` | Fase 1 |
| `sidebarOpen` | `boolean` | Reader sidebar |
| `activeAnnotationMenu` | `{ charStart, charEnd } \| null` | Selección de texto |

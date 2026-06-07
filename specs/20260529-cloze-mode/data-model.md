# Data Model: Cloze Detection

**Feature**: `20260529-cloze-mode`

## Storage: `sessions_by_mode`

| Field | Type | Notes |
|-------|------|-------|
| `rsvp` | `ActiveSession \| null` | Sin cambios |
| `slow` | `ActiveSession \| null` | Sin cambios |
| `cloze` | `ActiveSession \| null` | Nuevo slot v1 |

**Migration**: Si `cloze` ausente en objeto parseado → `cloze: null`. Idempotente.

**Write rules**: Nueva sesión en modo X reemplaza solo `sessions_by_mode[X]`.

## ActiveSession (Cloze slot)

| Field | Type | Notes |
|-------|------|-------|
| `studyMode` | `'cloze'` | Discriminador |
| `rev` | `number` | Versión export/resume |
| `materialMeta` | `{ fileName, originalFormat, uploadedAt }` | |
| `llmModel` | `string` | `deepseek` \| `gemini-2.5-flash` |
| `cloze` | `ClozeSessionData` | Ver abajo |

Campos RSVP (`blocks`, etc.) y sub-objeto `slow` **ausentes** en slot cloze.

## ClozeSessionData

| Field | Type | Notes |
|-------|------|-------|
| `normalizedText` | `string` | Texto canónico post-pipeline |
| `normalizedFormat` | `'html_min' \| 'markdown'` | |
| `pipelineStatus` | `PipelineStatus` | Ver transiciones |
| `pipelinePhase` | `0..4 \| null` | Fase activa durante generación |
| `pipelineError` | `string \| null` | Mensaje si `failed` |
| `epistemicGraph` | `EpistemicGraph \| null` | Tras Fase 0 |
| `analysis` | `SemanticAnalysis \| null` | Tras Fase 1 |
| `items` | `ClozeItem[]` | Tras Fase 4; solo `valid` servidos |
| `studyIndex` | `number` | Índice ítem MC actual (0-based) |
| `studyStats` | `{ correct, shown }` | Contadores sesión MC |
| `generationMeta` | `{ startedAt?, completedAt?, itemCounts? }` | Opcional |

## PipelineStatus

```text
normalized → generating → phase0 → phase1 → phase2 → phase3 → phase4 → ready
                ↓ (error any phase)
              failed
```

| Status | Meaning |
|--------|---------|
| `normalized` | Upload listo; usuario no ha pulsado "Generar ítems" |
| `generating` | Pipeline iniciado |
| `phase0`…`phase4` | Fase IA en curso |
| `ready` | Ítems validados; puede iniciar estudio MC |
| `failed` | Error recuperable; reintentar fase |

**Resume rule**: Si `epistemicGraph` existe y usuario continúa sesión sin regenerar → omitir Fase 0 en nuevo pipeline solo si ítems ya `ready`.

## EpistemicGraph

| Field | Type | Notes |
|-------|------|-------|
| `nodes` | `EpistemicNode[]` | |
| `edges` | `EpistemicEdge[]` | |

### EpistemicNode

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | e.g. `node_001` |
| `text` | `string` | Término/concepto |
| `type` | `ConceptType` | `CONCEPT`, `THESIS`, `TERM`, `AUTHOR`, `CAUSE`, `EFFECT` |
| `importance` | `1..5` | Solo ≥3 generan ítems NODE |
| `semantic_cluster` | `string` | Dominio semántico |
| `aliases` | `string[]` | Opcional |

### EpistemicEdge

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `source_id` | `string` | |
| `target_id` | `string` | |
| `type` | `RelationType` | `implies`, `causes`, etc. |
| `sentence_context` | `string` | Oración ancla |

## ClozeItem

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | |
| `item_type` | `ItemType` | NODE-* / EDGE-* |
| `sentence_original` | `string` | |
| `sentence_with_blank` | `string` | `_____` placeholder |
| `blank_text` | `string` | Respuesta correcta |
| `blank_char_start` | `number` | En `sentence_original` |
| `blank_char_end` | `number` | |
| `is_synthetic` | `boolean` | |
| `importance` | `1..5` | |
| `semantic_cluster` | `string` | |
| `node_id` | `string?` | NODE ítems |
| `edge_id` | `string?` | EDGE ítems |
| `source_node_id` | `string?` | |
| `target_node_id` | `string?` | |
| `relation_type` | `RelationType?` | |
| `options` | `ClozeOption[]` | 4 opciones post-Fase 3 |
| `difficulty` | `'easy' \| 'medium' \| 'hard'` | Post-Fase 4 |
| `qa_status` | `'valid' \| 'weak' \| 'rejected'` | |
| `qa_notes` | `string?` | |
| `times_shown` | `number` | Default 0 |
| `times_correct` | `number` | Default 0 |

### ClozeOption

| Field | Type | Notes |
|-------|------|-------|
| `text` | `string` | |
| `is_correct` | `boolean` | Exactamente una `true` |
| `plausibility` | `'high' \| 'medium' \| 'low' \| null` | `null` si correcta |
| `source` | `'L1' \| 'L3' \| null` | L2 reservado v2 |
| `rationale` | `string?` | |

## Invariants

- Solo ítems `qa_status === 'valid'` entran en cola MC.
- `options.length === 4` con exactamente una `is_correct: true`.
- `studyIndex` ∈ `[0, validItems.length]` al reanudar.
- `epistemicGraph` no se lee desde slots `rsvp`/`slow`.
- Nueva sesión cloze reemplaza solo `sessions_by_mode.cloze`.

## State Transitions (study MC)

```text
ready → studying (studyIndex=0) → … → complete (studyIndex >= validCount)
```

Al responder: increment `times_shown`; si correcto increment `times_correct`; persist session.

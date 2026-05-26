# Data Model: Zero-Latency Block Transitions

**Feature**: `20260527-zero-latency-blocks`

## Runtime: Prefetch slot

| Field | Type | Notes |
|-------|------|-------|
| `blockIndex` | `number \| null` | Índice del bloque que se está generando |
| `status` | `"idle" \| "generating" \| "ready" \| "failed"` | |
| `configKey` | `string` | `n_test\|n_socratic\|profile\|gaps` |
| `data` | `BlockJson \| null` | Bloque completo cuando `ready` |
| `error` | `Error \| null` | Cuando `failed` |

**Transitions**:
- `idle` → `generating`: `triggerPrefetch(idx, cfg)`
- `generating` → `ready`: `generateBlockForIndex` resuelve → **write-through** a `session.blocks[idx]` + `session_concepts_by_block[idx]` + agregado UI
- `generating` → `failed`: error API
- `ready` → `idle`: `getPrefetchedBlock` consume (camino rápido; datos ya en sesión si hubo write-through)
- Cualquier → `idle`: `invalidatePrefetch()` (p. ej. tras assessment)

## UI: Transition overlay state

| Field | Type | Notes |
|-------|------|-------|
| `view` | `"default" \| "adjust"` | Vista actual del overlay |
| `nextIndex` | `number` | Bloque destino N+1 |
| `nextCfg` | `BlockQuestionConfig` | Counts editables en Adjust |
| `expectedConfigKey` | `string` | Para validar prefetch |
| `primaryEnabled` | `boolean` | `status === 'ready' && key match` |

## Block JSON (sin cambio de schema)

Regen parcial actualiza solo:
- `questions[]` (reemplazo total)
- `concepts[]` (opcional, si el modelo devuelve términos nuevos)

Invariantes tras regen parcial:
- `id`, `title`, `explanation` del prefetch se conservan
- `questions.length` acorde a `n_test + n_socratic` (test primero, luego socratic)

## Session persistence

Al pasar prefetch a `ready` (write-through, ver FR-010):
- `state.activeSession.blocks[idx] = prefetch.data` (bloque completo)
- Actualizar `session_concepts_by_block[idx]` (`localStorage`); agregado UI vía `dictionary.js`
- `storeActiveSession(..., { bumpRev: true })`
- El slot `prefetchState` permanece `ready` hasta consumo en transición

Al consumir prefetch o confirmar Adjust (si el bloque cambió tras Adjust):
- `state.activeSession.blocks[nextIndex] = blockData` (puede ser no-op si write-through ya igual)
- `storeActiveSession(..., { bumpRev: true })`
- Regen/invalidación: reemplazar en diccionario solo `concepts` del índice `idx` afectado (FR-012)

## Session concepts (dictionary)

| Store | Key | Shape | Notes |
|-------|-----|-------|-------|
| Legacy aggregate | `session_concepts` | `Concept[]` | Commits al terminar bloque; backward compat |
| Per-block | `session_concepts_by_block` | `Record<string, Concept[]>` | Keys = block index strings; replaced on prefetch ready / regen |

**Aggregate for UI** = merge(all `concepts_by_block` values) ∪ `session_concepts` (dedup por término).

## Export (Concept Dictionary)

Ver [contracts/export-concept-dictionary.md](./contracts/export-concept-dictionary.md).

- `collectExportConcepts`: unión `session_concepts` + `concepts_by_block` + `blocks[].concepts`
- Secciones `## Block k` iff `hasGeneratedBlockContent(blocks[k])` (incl. write-through prefetched)

## Regen mode (lógica cliente)

| Condición | Modo |
|-----------|------|
| Solo cambian `n_test` / `n_socratic` y prefetch tiene `explanation` no vacía | `questions_only` |
| Cambian `explanation_profile` o `gap_focus` | `full_block` |
| Sin prefetch / sin explanation | `full_block` |
| Camino rápido, config igual, `ready` | `consume_prefetch` (sin API) |

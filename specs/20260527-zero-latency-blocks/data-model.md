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
- `generating` → `ready`: `generateBlockForIndex` resuelve
- `generating` → `failed`: error API
- `ready` → `idle`: `getPrefetchedBlock` consume (camino rápido)
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

Al consumir prefetch o confirmar Adjust:
- `state.activeSession.blocks[nextIndex] = blockData`
- `storeActiveSession(..., { bumpRev: true })`

## Regen mode (lógica cliente)

| Condición | Modo |
|-----------|------|
| Solo cambian `n_test` / `n_socratic` y prefetch tiene `explanation` no vacía | `questions_only` |
| Cambian `explanation_profile` o `gap_focus` | `full_block` |
| Sin prefetch / sin explanation | `full_block` |
| Camino rápido, config igual, `ready` | `consume_prefetch` (sin API) |

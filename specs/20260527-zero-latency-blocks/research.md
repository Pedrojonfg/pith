# Research: Zero-Latency Block Transitions

**Feature**: `20260527-zero-latency-blocks` | **Date**: 2026-05-27

## R1 — Prefetch ya existe pero la UX no cumple el spec

**Decision**: Mantener `triggerPrefetch` en `startBlock(N)` para índice N+1; refactorizar `finishQuestions` / overlay, no reescribir el motor de prefetch.

**Rationale**: `study.js` líneas ~1398–1405 ya disparan prefetch; el cuello de botella es la transición (textarea, Continue genérico, espera post-clic).

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Prefetch 2 bloques adelante | Coste API doble; v1 innecesario |
| Web Worker para API | Sin backend; fetch sigue en main thread |

## R2 — CTA deshabilitado hasta `ready`

**Decision**: Camino rápido: botón **Siguiente bloque** `disabled` mientras `prefetchState.status !== 'ready'` para `configKey` esperada; indicador en overlay + dot global.

**Rationale**: Clarificación sesión 2026-05-27; evita doble espera post-clic.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Clic → espera inline | Sensación de latencia que el feature elimina |
| Auto-avance sin pantalla | Usuario pierde control y diccionario |

## R3 — Regen parcial (explanation fija, questions nuevas)

**Decision**: Nuevo prompt `deepSeekRegenerateBlockQuestions` que recibe `explanation` + material chunk + counts; devuelve `{ questions, concepts? }`; merge en cliente sobre bloque prefetched.

**Rationale**: Clarificación usuario: regen completa de preguntas, cuerpo RSVP intacto. Reutiliza `MC_OPTION_PARITY_RULES` y `QUESTION_PEDAGOGY_RULES`.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Recortar array local sin API | Preguntas sobrantes no son pedagógicamente válidas |
| Regen bloque completa siempre | Pierde beneficio de prefetch en Adjust |

**Fallback**: Sin `explanation` en prefetch → `generateBlockForIndex` completo (FR-008).

## R4 — Transición bifurcada

**Decision**: Vista default: diccionario colapsado + **Siguiente bloque** + **Ajustar siguiente bloque** + barra prefetch. Vista Adjust: revela `details` de preguntas + Confirmar (sin textarea guía).

**Rationale**: Clarificaciones Q4/Q5; alinea con 99%/1%.

## R5 — Dudas solo sidebar

**Decision**: Eliminar `setPendingComment` desde overlay; eliminar `ensureGuideResponseCardVisible` en `finishRSVP`; mantener `triggerCommentReply` si sidebar deja `pendingComment` (flujo existente).

**Rationale**: FR-005/005a; un solo canal.

## R6 — `betweenBlocks` HTML

**Decision**: No wire en v1; overlay dinámico es canónico. Limpieza de `#screenBetweenBlocks` opcional en tarea P3 o backlog.

**Rationale**: Grep muestra listeners mínimos; pantalla no usada en `finishQuestions`.

## R7 — `configKey` y regen parcial

**Decision**: Tras regen parcial exitosa, actualizar `prefetchState` o escribir bloque en `session.blocks[idx]` y tratar como `ready` con nueva key; `maybeRegeneratePrefetch` en Adjust sigue usando `buildBlockConfigKey`.

**Rationale**: Evita SC-003 violación (doble full gen).

## R8 — Write-through en prefetch `ready` (clarificación 2026-05-26)

**Decision**: En el `.then()` de `triggerPrefetch`, persistir bloque completo en `session.blocks[idx]` + `storeActiveSession`; mantener `prefetchState` en `ready` hasta consumo.

**Rationale**: FR-010; `ensureBlockGenerated` evita API duplicada; export mid-session incluye `## Block N+1` antes de estudiarlo.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Solo slot en memoria hasta transición | Export y diccionario no ven el bloque; bug reportado |
| Consumir slot al escribir sesión | Rompe camino rápido que espera `getPrefetchedBlock` |

## R9 — Diccionario paralelo al estudio

**Decision**: `session_concepts_by_block` en `localStorage`; al `ready` actualizar entrada `idx`; agregado para UI = merge de todas las entradas + legacy `session_concepts`.

**Rationale**: FR-009, FR-012 (reemplazo por índice sin vaciar diccionario global). Re-merge por bloque es más simple que índice inverso término→bloque.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Solo `commitSessionConceptsForBlock` al terminar bloque | No muestra términos del prefetch hasta estudiar N+1 |
| Vaciar y reconstruir todo el diccionario | Pierde términos de otros bloques en regen |

## R10 — Export Concept Dictionary

**Decision**: `collectExportConcepts(session)` — unión de `session_concepts`, `concepts_by_block`, y `blocks[].concepts` con dedup (definición más completa gana).

**Rationale**: FR-011; tolera rutas legacy y write-through parcial.

## R11 — UI refresh en `ready`

**Decision**: Callback `onPrefetchReady` registrado desde `study.js` para `updateDictionaryButtonVisibility` y re-render del diccionario en overlay si está abierto.

**Rationale**: FR-009; sin polling; evento alineado con write-through.

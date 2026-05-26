# ROADMAP — Zero-Latency Block Transitions

**Spec**: `specs/20260527-zero-latency-blocks/spec.md`  
**Plan**: `specs/20260527-zero-latency-blocks/plan.md`  
**Branch**: `20260527-zero-latency-blocks`

## Tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | API regen solo preguntas | — | M | [x] |
| T02 | `session.js`: `generateQuestionsOnlyForIndex` + merge | T01 | M | [x] |
| T03 | Overlay transición: vista default vs Adjust | T02 | L | [x] |
| T04 | Camino rápido: CTA deshabilitado + consumo prefetch | T03 | M | [x] |
| T05 | Camino Adjust: regen parcial vs completa | T02, T03 | M | [x] |
| T06 | Quitar tarjeta guía inline en `finishRSVP` | — | S | [x] |
| T07 | Tests base + quickstart §1–6 | T04, T05, T06 | M | [x] |
| **T08** | **`applyPrefetchReadySideEffects` (write-through + hook)** | T07 | M | [x] |
| **T09** | **`dictionary.js`: `concepts_by_block` + agregado UI** | T08 | M | [x] |
| **T10** | **`export.js`: `collectExportConcepts` + union export** | T08 | M | [x] |
| **T11** | **`study.js`: refresh diccionario en `onPrefetchReady`** | T08, T09 | S | [ ] |
| **T12** | **Tests T03 + quickstart §7–8 (SC-005/006)** | T09, T10, T11 | M | [ ] |

## Grafo de dependencias

```text
Fase A (hecho):
T01 → T02 → T03 → T04 → T07
          ↘     ↘ T05 ↗
T06 (independiente)

Fase B (diccionario + export):
T08 → T09 → T12
    → T10 ↗
    → T11 → T12
```

**Paralelo posible (Fase B)**:
- Tras **T08**: **T09** y **T10** en paralelo (archivos distintos).
- **T11** tras **T09** (o en paralelo con T10 si solo toca `study.js` wiring).

## Orden de ejecución recomendado

### Fase A — completada
T01 → T02 → (T06 ∥) → T03 → T04 → T05 → T07

### Fase B — pendiente (bug diccionario/export)
1. **T08** (un chat) — bloqueante  
2. **T09 ∥ T10** (dos chats en paralelo)  
3. **T11**  
4. **T12** (cerrar)

**Antes de producción**: bump `?v=` en imports (`session.js`, `dictionary.js`, `export.js`, `study.js`).

---

## PROMPT T08 — Prefetch ready side effects

Implementa **write-through y diccionario en prefetch `ready`** según clarificaciones 2026-05-26.

**Contexto**:
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-009–FR-012)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/prefetch-ready-persistence.md`
- Hoy `triggerPrefetch` en `src/js/session.js` solo asigna `prefetchState.data` sin persistir sesión ni diccionario.

**Archivos**:
- `src/js/session.js` (principal)
- `src/js/config.js` (nueva constante `LS_SESSION_CONCEPTS_BY_BLOCK_KEY` si hace falta)

**Tareas**:
1. `export function applyPrefetchReadySideEffects(blockIndex, data, cfg)` — normaliza bloque, `session.blocks[idx]=data`, `storeActiveSession`.
2. Llamar desde el `.then()` de `triggerPrefetch` **antes** de marcar `ready` (o justo después, mismo tick).
3. Invocar callback opcional `let onPrefetchReady = null; export function setOnPrefetchReady(fn)`.
4. No vaciar `prefetchState` en write-through (sigue `ready` hasta `getPrefetchedBlock`).
5. Delegar actualización de `concepts_by_block` a `dictionary.js` (import) — stub mínimo si T09 no está hecho.

**Criterio de éxito**: Tras prefetch `ready` de bloque 2, `loadActiveSession().blocks[1]` tiene `explanation` no vacía sin pulsar **Siguiente bloque**; segunda llamada a `ensureBlockGenerated(1)` no dispara API.

**ROADMAP**: T08. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T09 — Dictionary per-block store

**Contexto**: Contrato `prefetch-ready-persistence.md`; `getSortedSessionConcepts` hoy solo lee `session_concepts`.

**Archivos**:
- `src/js/dictionary.js`
- `src/js/config.js`

**Tareas**:
1. `load/saveConceptsByBlock()`, `setBlockConcepts(blockIndex, concepts)` — reemplaza entrada del índice (FR-012).
2. `getSortedSessionConcepts()` — agregado: merge todas las entradas `concepts_by_block` ∪ legacy `session_concepts` (dedup existente).
3. `export function syncConceptsFromBlock(blockIndex, concepts)` — usado por T08 y regen paths.
4. Mantener `commitSessionConceptsForBlock` idempotente.

**Criterio de éxito**: Tras `setBlockConcepts(1, [{term:"Foo",definition:"Bar"}])`, `getSortedSessionConcepts()` incluye Foo; actualizar bloque 1 no borra términos del bloque 0.

**ROADMAP**: T09 (requiere T08). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T10 — Export union

**Contexto**: Contrato `export-concept-dictionary.md`; FR-011, SC-006.

**Archivos**:
- `src/js/export.js`
- `src/js/dictionary.js` (import `collectExportConcepts` o definir en dictionary y re-export)

**Tareas**:
1. `export function collectExportConcepts(session)` — unión de las 3 fuentes con dedup (definición más larga gana).
2. `buildMarkdown` usa `collectExportConcepts` para tabla **Concept Dictionary**.
3. Verificar bucle de bloques: incluir sección solo si `hasGeneratedBlockContent` (explicación o questions); bloques write-through prefetched cuentan.

**Criterio de éxito**: Test unitario o script: sesión mock con `blocks[1].explanation` poblado por write-through y sin respuestas → export contiene `## Block 2:` y ≥1 fila en Concept Dictionary.

**ROADMAP**: T10 (requiere T08). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T11 — UI refresh on prefetch ready [x]

**Contexto**: FR-009; overlay de transición ya renderiza diccionario en `finishQuestions`.

**Archivos**:
- `src/js/study.js`

**Tareas**:
1. En init/wire: `setOnPrefetchReady(({ blockIndex }) => { ... })`.
2. Llamar `updateDictionaryButtonVisibility()`.
3. Si overlay transición abierto: re-ejecutar `renderDictionary` en `o.dictionaryWrap` con `getSortedSessionConcepts()`.
4. Tras regen Adjust / `persistNextBlock`: llamar `syncConceptsFromBlock` (T09) si no lo hace T08.

**Criterio de éxito**: quickstart §7 — durante bloque 1, con prefetch bloque 2 ready, botón diccionario muestra términos nuevos sin avanzar de bloque.

**ROADMAP**: T11 (requiere T08, T09). Ejecuta `/validate` antes de cerrar este mensaje.

**Validado**: `cursor-tests/20260527_t11-ui-refresh-prefetch-ready.mjs` (9 tests).

---

## PROMPT T12 — Tests SC-005/006 + quickstart [x]

**Contexto**: `specs/20260527-zero-latency-blocks/quickstart.md` §7–8.

**Archivos**:
- `cursor-tests/20260527_t03-prefetch-write-through.mjs` (nuevo)
- `cursor-tests/20260527_t04-export-concepts-union.mjs` (nuevo)

**Tareas**:
1. Test: mock `applyPrefetchReadySideEffects` / triggerPrefetch → `blocks[1]` poblado.
2. Test: `collectExportConcepts` dedup y fuentes múltiples.
3. Ejecutar quickstart §7–8 manual; actualizar tabla Pass criteria en quickstart.md.

**Criterio de éxito**: `node --import ./cursor-tests/register.mjs cursor-tests/20260527_t*.mjs` exit 0; SC-005 y SC-006 marcados en quickstart.

**ROADMAP**: T12 (requiere T09–T11). Ejecuta `/validate` antes de cerrar este mensaje.

**Validado**: `20260527_t03` (12), `20260527_t04` (11), `20260527_validate-t12-sc005-sc006.mjs` (8); full `20260527_t*.mjs` suite green.

---

## Instrucción de ejecución

**Lanzar primero (Fase B)**: **T08** — un chat.

**En paralelo tras T08**: **T09** y **T10** (dos chats).

**Luego**: **T11** → **T12**.

**Siguiente comando Spec Kit**: `/speckit-implement` o pegar **PROMPT T08** en un chat nuevo.

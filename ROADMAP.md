# TEST ROADMAP CONTENT
<!-- OLD ROADMAP START

**Spec**: `specs/20260527-zero-latency-blocks/spec.md`
**Branch**: `20260527-zero-latency-blocks`

## Tareas

| ID | Descripcion | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T13 | Reforzar que `explanation` conecte con el bloque anterior (para recorte del sneak peek) | - | S | [ ] |
| T14 | Helper `extractSneakPeek(explanation)` (<=4 frases) + tests unitarios | - | S | [ ] |
| T15 | Render sneak peek en `transitionOverlay` (placeholder -> texto al `ready`) | T14 | M | [ ] |
| T16 | Tests + quickstart para SC-007 (sneak peek) | T15 | M | [ ] |

## Grafo de dependencias

```text
T13 ------------------┐
T14 --> T15 --> T16
```

Secuencial: `T14 -> T15 -> T16`. Paralelo: `T13` y `T14` pueden hacerse a la vez.

## Orden de ejecucion recomendado

1. Ejecuta `T13` y `T14` en paralelo (dos chats).
2. Luego ejecuta `T15`.
3. Finalmente ejecuta `T16`.

## PROMPT T13 - Conexion temprana en `explanation` (para sneak peek)

Actualiza el prompt de generacion para que el `explanation` incluya la conexion con el bloque anterior al inicio, ya que el sneak peek usa un recorte local de las primeras <=4 frases sin re-LLM.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002e, SC-007)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/api.js`

**Tareas**
1. Modificar `EXPLANATION_RSVP_THOROUGH` y `EXPLANATION_BRIEF_DEEP` para que, cuando `blockIndex >= 1` (bloque 2+):
   - La primera frase del parrafo Hook/Core haga explicita la conexion con el bloque inmediatamente anterior (menciona titulo y/o concepto clave).
   - La conexion aparezca antes de la parte que seria "Connection" al final (ya que el sneak peek recorta el inicio).
2. Verifica que el cambio no introduce nuevos campos JSON ni rompe las reglas de formato existentes (sin etiquetas visibles, parrafos separados por una linea en blanco, <=15 palabras por frase, etc.).
3. En `buildBlockGenerationUserContent`, cuando `blockIndex > 0`, anade (o refuerza) una linea corta con el titulo del bloque anterior dentro de la lista confirmada / contexto del modelo, para mejorar el puente textual.

**Criterio de exito**
- Para un bloque 2+, el `explanation` generado comienza con una frase que referencia el bloque anterior; al recortar primeras <=4 frases con el helper, el sneak peek ya incluye el puente pedagogico.

criterio de exito: El prompt fuerza conexion en las primeras frases sin campos nuevos. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T14 - Helper `extractSneakPeek` + unit tests

Crea un helper portable (sin DOM) que derive el sneak peek del `explanation` sin tokens extra: normaliza whitespace y devuelve hasta las primeras 4 frases como un unico parrafo compacto.

**Contexto**
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c/FR-002d)

**Archivos**
- `src/js/sneakPeek.js` (nuevo)
- `cursor-tests/20260527_t14-sneak-peek-extract.mjs` (nuevo)

**Tareas**
1. Implementa `export function extractSneakPeek(explanation, maxSentences = 4)`:
   - Normaliza whitespace (trim; colapsar `\\s+` a espacio).
   - Divide en frases con una regla conservadora que no se rompa por `? ! .`.
   - Devuelve `""` si `explanation` es vacio/no valido.
   - Devuelve max `maxSentences` frases unidas con espacio simple.
2. Crea unit tests:
   - Explicacion con 0/1/3/4/5+ frases.
   - Signos `? ! .` para segmentacion.
   - Texto con secuencias tipo LaTeX inline `\\( ... \\)` para garantizar que no se rompe el conteo de frases.

**Criterio de exito**
- `extractSneakPeek` nunca devuelve mas de 4 frases y pasa todos los tests.

criterio de exito: Helper + tests unitarios green. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T15 - Render sneak peek en `transitionOverlay`

Anade el sneak peek a la UI de transicion: se muestra encima del diccionario colapsado. Mientras `prefetch` no este `ready`, se muestra placeholder "Preparando siguiente bloque...". Cuando pasa a `ready`, el texto se reemplaza por el sneak peek derivado del `explanation` del bloque N+1.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002d)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/study.js`
- `src/js/sneakPeek.js`

**Tareas**
1. En `getOrCreateTransitionOverlay()`:
   - Crea `sneakPeekWrap` y `sneakPeekText`.
   - Inserta `sneakPeekWrap` encima de `dictionaryWrap`.
2. En `finishQuestions(blockIndex)` al abrir la transicion:
   - Si `prefetch.status !== "ready"` para el configKey esperado: muestra placeholder.
   - Si esta `ready`: obtiene el `explanation` del bloque N+1 (preferir `prefetchState.data.explanation`, con fallback a `getBlock(nextIndex).explanation`) y renderiza `extractSneakPeek(explanation)`.
3. Asegura que al pasar a `ready` con el overlay abierto se actualice el sneak peek:
   - Reusa/hookea la misma logica que ya actualiza el diccionario en `refreshUiOnPrefetchReady()` o extiende `syncPrefetchUi()`/`refreshUiOnPrefetchReady()` con un render adicional.
4. Mantener el sneak peek fuera de la vista `adjust`.

**Criterio de exito**
- En transicion: placeholder aparece mientras genera; al estar `ready` el texto cambia a un parrafo <=4 frases derivado del `explanation`.

criterio de exito: Sneak peek visible y reactivo al ready sin llamadas extra. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T16 - Tests + quickstart para SC-007

Anade tests y documentacion para validar SC-007 (sneak peek) y que no se rompe la suite.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (SC-007)
- Quickstart: `specs/20260527-zero-latency-blocks/quickstart.md`

**Archivos**
- `cursor-tests/20260527_t16-sneak-peek-ui.mjs` (nuevo)
- `specs/20260527-zero-latency-blocks/quickstart.md` (anadir seccion/manual §9)

**Tareas**
1. Implementa un test de integracion "UI logic":
   - Con `prefetch` en `generating`: placeholder visible.
   - Con `prefetch` `ready`: texto derivado del `explanation` y <=4 frases.
2. Actualiza `quickstart.md` con un paso manual para SC-007 (como comprobar visualmente sneak peek y placeholder).

**Criterio de exito**
- Suite `cursor-tests/20260527_t*.mjs` sigue pasando y quickstart documenta SC-007 claramente.

criterio de exito: Tests+docs SC-007 completados sin romper suite. Ejecuta /validate antes de cerrar este mensaje

<!-- OLD ROADMAP START

**Spec**: `specs/20260527-zero-latency-blocks/spec.md`  
**Branch**: `20260527-zero-latency-blocks`

## Tareas

| ID | Descripcion | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T13 | Reforzar que `explanation` conecte con el bloque anterior (para recorte del sneak peek) | - | S | [ ] |
| T14 | Helper `extractSneakPeek(explanation)` (<=4 frases) + tests unitarios | - | S | [ ] |
| T15 | Render sneak peek en `transitionOverlay` (placeholder -> texto al `ready`) | T14 | M | [ ] |
| T16 | Tests + quickstart para SC-007 (sneak peek) | T15 | M | [ ] |

## Grafo de dependencias

```text
T13 ------------------┐
T14 --> T15 --> T16
```

Secuencial: `T14 -> T15 -> T16`. Paralelo: `T13` y `T14` pueden hacerse a la vez.

## Orden de ejecucion recomendado

1. Ejecuta **T13** y **T14** en paralelo (dos chats).
2. Luego ejecuta **T15**.
3. Finalmente ejecuta **T16**.

## PROMPT T13 - Conexion temprana en `explanation` (para sneak peek)

Actualiza el prompt de generacion para que el `explanation` incluya la conexion con el bloque anterior **al inicio**, ya que el sneak peek usa un recorte local de las **primeras <=4 frases** sin re-LLM.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002e, SC-007)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/api.js`

**Tareas**
1. Modificar `EXPLANATION_RSVP_THOROUGH` y `EXPLANATION_BRIEF_DEEP` para que, cuando `blockIndex >= 1` (bloque 2+):
   - La **primera frase** del parrafo Hook/Core haga explicita la conexion con el bloque inmediatamente anterior (menciona titulo y/o concepto clave).
   - Asegurar que la **conexion** aparezca antes de la parte que seria “Connection” al final (ya que el sneak peek recorta el inicio).
2. Verifica que el cambio **no** introduce nuevos campos JSON ni rompe las reglas de formato existentes (sin etiquetas visibles, parrafos separados por una linea en blanco, <=15 palabras por frase, etc.).
3. En `buildBlockGenerationUserContent`, cuando `blockIndex > 0`, anade (o refuerza) una linea corta con el **titulo del bloque anterior** dentro de la lista confirmada / contexto del modelo, para mejorar el “puente” textual.

**Criterio de exito**
- Para un bloque 2+, el `explanation` generado comienza con una frase que referencia el bloque anterior; al recortar primeras <=4 frases con el helper, el sneak peek ya incluye el “puente” pedagogico.

criterio de exito: El prompt fuerza conexion en las primeras frases sin campos nuevos. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T14 - Helper `extractSneakPeek` + unit tests

Crea un helper portable (sin DOM) que derive el sneak peek del `explanation` sin tokens extra: normaliza whitespace y devuelve hasta las **primeras 4 frases** como un unico parrafo compacto.

**Contexto**
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c/FR-002d)

**Archivos**
- `src/js/sneakPeek.js` (nuevo)
- `cursor-tests/20260527_t14-sneak-peek-extract.mjs` (nuevo)

**Tareas**
1. Implementa `export function extractSneakPeek(explanation, maxSentences = 4)`:
   - Normaliza whitespace (trim; colapsar `\\s+` a espacio).
   - Divide en frases con una regla conservadora que no se rompa por `? ! .`.
   - Devuelve `""` si `explanation` es vacio/no valido.
   - Devuelve max `maxSentences` frases unidas con espacio simple.
2. Crea unit tests:
   - Explicacion con 0/1/3/4/5+ frases.
   - Signos `? ! .` para segmentacion.
   - Texto con secuencias tipo LaTeX inline `\\( ... \\)` para garantizar que no se rompe el conteo de frases.

**Criterio de exito**
- `extractSneakPeek` nunca devuelve mas de 4 frases y pasa todos los tests.

criterio de exito: Helper + tests unitarios green. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T15 - Render sneak peek en `transitionOverlay`

Aade el sneak peek a la UI de transicion: se muestra **encima del diccionario colapsado**. Mientras `prefetch` no este `ready`, se muestra placeholder “Preparando siguiente bloque...”. Cuando pasa a `ready`, el texto se reemplaza por el sneak peek derivado del `explanation` del bloque N+1.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002d)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/study.js`
- `src/js/sneakPeek.js`

**Tareas**
1. En `getOrCreateTransitionOverlay()`:
   - Crea `sneakPeekWrap` y `sneakPeekText`.
   - Inserta `sneakPeekWrap` **encima** de `dictionaryWrap`.
2. En `finishQuestions(blockIndex)` al abrir la transicion:
   - Si `prefetch.status !== "ready"` para el `configKey` esperado: muestra placeholder.
   - Si esta `ready`: obtiene el `explanation` del bloque N+1 (preferir `prefetchState.data.explanation`, con fallback a `getBlock(nextIndex).explanation`) y renderiza `extractSneakPeek(explanation)`.
3. Asegura que al pasar a `ready` con overlay abierto se actualice el sneak peek:
   - Reusa/hookea la misma logica que ya actualiza el diccionario en `refreshUiOnPrefetchReady()` o extiende `syncPrefetchUi()`/`refreshUiOnPrefetchReady()` con un render adicional.
4. Mantén el sneak peek fuera de la vista `adjust` (no lo ocultes, pero no mezclar con controles de preguntas).

**Criterio de exito**
- En transicion: placeholder aparece mientras genera; al estar `ready` el texto cambia a un parrafo <=4 frases derivado del `explanation`.

criterio de exito: Sneak peek visible y reactivo al ready sin llamadas extra. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T16 - Tests + quickstart para SC-007

Aade tests y documentacion para validar SC-007 (sneak peek) y que no se rompe la suite.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (SC-007)
- Quickstart: `specs/20260527-zero-latency-blocks/quickstart.md`

**Archivos**
- `cursor-tests/20260527_t16-sneak-peek-ui.mjs` (nuevo) o nombre equivalente siguiendo convencion del repo
- `specs/20260527-zero-latency-blocks/quickstart.md` (anadir seccion/manual §9)

**Tareas**
1. Implementa test de integracion “UI logic”:
   - Montar/activar overlay con `prefetch` en estado `generating`: debe mostrar placeholder.
   - Con `prefetch` `ready`: debe mostrar texto derivado del `explanation`, y debe respetar <=4 frases.
2. Actualiza `quickstart.md` con un paso manual para SC-007 (como comprobar visualmente el sneak peek y el placeholder).

**Criterio de exito**
- Suite `cursor-tests/20260527_t*.mjs` sigue pasando y quickstart documenta SC-007 claramente.

criterio de exito: Tests+docs SC-007 completados sin romper suite. Ejecuta /validate antes de cerrar este mensaje

# ROADMAP — Zero-Latency Block Transitions (Sneak Peek)

**Spec**: `specs/20260527-zero-latency-blocks/spec.md`  
**Branch**: `20260527-zero-latency-blocks`

## Tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T13 | Reforzar que `explanation` conecte con el bloque anterior (para recorte del sneak peek) | — | S | [ ] |
| T14 | Helper `extractSneakPeek(explanation)` (≤4 frases) + tests unitarios | — | S | [ ] |
| T15 | Render sneak peek en `transitionOverlay` (placeholder → texto al `ready`) | T14 | M | [ ] |
| T16 | Tests + quickstart para SC-007 (sneak peek) | T15 | M | [ ] |

## Grafo de dependencias

```text
T13 ───────────────┐
T14 ──> T15 ──> T16
```

Secuencial: `T14 → T15 → T16`. Paralelo: `T13` y `T14` pueden hacerse a la vez.

## Orden de ejecución recomendado

1. Ejecuta **T13** y **T14** en paralelo (dos chats).
2. Luego ejecuta **T15**.
3. Finalmente ejecuta **T16**.

## PROMPT T13 — Conexión temprana en `explanation` (para sneak peek)

Actualiza el prompt de generación para que el `explanation` incluya la conexión con el bloque anterior **al inicio**, ya que el sneak peek usa un recorte local de las **primeras ≤4 frases** sin re-LLM.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002e, SC-007)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/api.js`

**Tareas**
1. Modificar `EXPLANATION_RSVP_THOROUGH` y `EXPLANATION_BRIEF_DEEP` para que, cuando `blockIndex >= 1` (bloque 2+):
   - La **primera frase** del párrafo Hook/Core haga explícita la conexión con el bloque inmediatamente anterior (menciona título y/o concepto clave).
   - Asegurar que la **conexión** aparezca antes de la parte que sería “Connection” al final (ya que el sneak peek recorta el inicio).
2. Verifica que el cambio **no** introduce nuevos campos JSON ni rompe las reglas de formato existentes (no etiquetas visibles, párrafos separados por una línea en blanco, ≤15 palabras por frase, etc.).
3. En `buildBlockGenerationUserContent`, cuando `blockIndex > 0`, añade (o refuerza) una línea corta con el **título del bloque anterior** dentro de la lista confirmada / contexto del modelo, para mejorar el “puente” textual.

**Criterio de éxito**
- Para un bloque 2+, el `explanation` generado comienza con una frase que referencia el bloque anterior; al recortar primeras ≤4 frases con el helper, el sneak peek ya incluye el “puente” pedagógico.

criterio de éxito: El prompt fuerza conexión en las primeras frases sin campos nuevos. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T14 — Helper `extractSneakPeek` + unit tests

Crea un helper portable (sin DOM) que derive el sneak peek del `explanation` sin tokens extra: normaliza whitespace y devuelve hasta las **primeras 4 frases** como un único párrafo compacto.

**Contexto**
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c/FR-002d)

**Archivos**
- `src/js/sneakPeek.js` (nuevo)
- `cursor-tests/20260527_t14-sneak-peek-extract.mjs` (nuevo)

**Tareas**
1. Implementa `export function extractSneakPeek(explanation, maxSentences = 4)`:
   - Normaliza whitespace (trim; colapsar `\\s+` a espacio).
   - Divide en frases con una regla conservadora que no se rompa por `? ! .`.
   - Devuelve `""` si `explanation` es vacío/no válido.
   - Devuelve máximo `maxSentences` frases unidas con espacio simple.
2. Crea unit tests:
   - explicación con 0/1/3/4/5+ frases.
   - signos `? ! .` para segmentación.
   - texto con secuencias tipo LaTeX inline `\\( ... \\)` para garantizar que no se rompe el conteo de frases.

**Criterio de éxito**
- `extractSneakPeek` nunca devuelve más de 4 frases y pasa todos los tests.

criterio de éxito: Helper + tests unitarios green. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T15 — Render sneak peek en `transitionOverlay`

Añade el sneak peek a la UI de transición: se muestra **encima del diccionario colapsado**. Mientras `prefetch` no esté `ready`, se muestra placeholder “Preparando siguiente bloque…”. Cuando pasa a `ready`, el texto se reemplaza por el sneak peek derivado del `explanation` del bloque N+1.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002d)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/study.js`
- `src/js/sneakPeek.js`

**Tareas**
1. En `getOrCreateTransitionOverlay()`:
   - Crea `sneakPeekWrap` y `sneakPeekText`.
   - Inserta `sneakPeekWrap` **encima** de `dictionaryWrap`.
2. En `finishQuestions(blockIndex)` al abrir la transición:
   - Si `prefetch.status !== "ready"` para el `configKey` esperado: muestra placeholder.
   - Si está `ready`: obtiene el `explanation` del bloque N+1 (preferir `prefetchState.data.explanation`, con fallback a `getBlock(nextIndex).explanation`) y renderiza `extractSneakPeek(explanation)`.
3. Asegura que al pasar a `ready` con overlay abierto se actualice el sneak peek:
   - Reusa/hookea la misma lógica que ya actualiza el diccionario en `refreshUiOnPrefetchReady()` o extiende `syncPrefetchUi()`/`refreshUiOnPrefetchReady()` con un render adicional.
4. Mantén el sneak peek fuera de la vista `adjust` (no lo ocultes, pero no mezclar con controles de preguntas).

**Criterio de éxito**
- En transición: placeholder aparece mientras genera; al estar `ready` el texto cambia a un párrafo ≤4 frases derivado del `explanation`.

criterio de éxito: Sneak peek visible y reactivo al ready sin llamadas extra. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T16 — Tests + quickstart para SC-007

Añade tests y documentación para validar SC-007 (sneak peek) y que no se rompe la suite.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (SC-007)
- Quickstart: `specs/20260527-zero-latency-blocks/quickstart.md`

**Archivos**
- `cursor-tests/20260527_t16-sneak-peek-ui.mjs` (nuevo) o nombre equivalente siguiendo convención del repo
- `specs/20260527-zero-latency-blocks/quickstart.md` (añadir sección/manual §9)

**Tareas**
1. Implementa test de integración “UI logic”:
   - Montar/activar overlay con `prefetch` en estado `generating`: debe mostrar placeholder.
   - Con `prefetch` `ready`: debe mostrar texto derivado del `explanation`, y debe respetar ≤4 frases.
2. Actualiza `quickstart.md` con un paso manual para SC-007 (cómo comprobar visualmente el sneak peek y placeholder).

**Criterio de éxito**
- Suite `cursor-tests/20260527_t*.mjs` sigue pasando y quickstart documenta SC-007 claramente.

criterio de éxito: Tests+docs SC-007 completados sin romper suite. Ejecuta /validate antes de cerrar este mensaje

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
| **T13** | **`api.js`: reforzar conexión entre bloques al inicio del `explanation`** | T07 | S | [ ] |
| **T14** | **Helper `extractSneakPeek(explanation)` (≤4 frases) + unit tests** | — | S | [ ] |
| **T15** | **`study.js`: render sneak peek en transición (placeholder→texto al `ready`)** | T14, T11 | M | [ ] |
| **T16** | **Tests + quickstart: SC-007 sneak peek** | T13, T15 | M | [ ] |

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

Sneak peek:
T13 (prompt) ───────────────┐
T14 (helper) → T15 (UI) → T16 (tests/docs) ←┘
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

### Sneak peek — nuevo (SC-007)
1. **T14 ∥ T13** (dos chats en paralelo)  
2. **T15**  
3. **T16**  

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

**PROMPT T13 — Conexión al inicio del explanation (para sneak peek)**

Actualiza el prompt de generación de bloques para que el `explanation` enfatice explícitamente la conexión con el bloque anterior **en las primeras frases**, ya que el sneak peek se recorta como “primeras ≤4 frases” sin llamada extra.

**Contexto**:
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002e, SC-007)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`
- Hoy `EXPLANATION_RSVP_THOROUGH` ya tiene una sección “Connection” al final; eso NO sirve para el sneak peek si el recorte toma el inicio.

**Archivos**:
- `src/js/api.js`

**Tareas**:
1. Modificar `EXPLANATION_RSVP_THOROUGH` (y opcionalmente `EXPLANATION_BRIEF_DEEP`) para exigir:
   - En bloques con `blockIndex >= 1`: la primera frase del Hook debe enlazar con el bloque anterior (mencionar el concepto o el título de bloque previo).
   - Las primeras 4 frases deben dar mini‑intro + puente (sin depender del párrafo “Connection” final).
2. En `buildBlockGenerationUserContent`, cuando `blockIndex > 0`, incluir una línea adicional con el título del bloque anterior (extraído de `blocksListText`) para que el modelo tenga el texto exacto.
3. Mantener reglas RSVP (≤15 palabras, etc.) y no introducir nuevos campos en JSON.

**Criterio de éxito**: Para un bloque 2+, el `explanation` generado comienza con una frase que referencia el bloque anterior; el sneak peek (primeras 4 frases) incluye ese puente sin necesidad de reescritura.  

criterio de éxito: El prompt fuerza conexión en las primeras frases sin campos nuevos. Ejecuta /validate antes de cerrar este mensaje

---

**PROMPT T14 — Helper extractSneakPeek + tests unitarios**

Crea un helper portable (sin DOM) que derive el sneak peek del `explanation` sin tokens extra: normaliza whitespace y devuelve las primeras ≤4 frases como un párrafo compacto.

**Contexto**:
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md` (algoritmo)

**Archivos**:
- `src/js/sneakPeek.js` (nuevo)
- `cursor-tests/20260527_t14-sneak-peek-extract.mjs` (nuevo)

**Tareas**:
1. Implementar `export function extractSneakPeek(explanation, maxSentences = 4)`:
   - `normalizeWhitespace`
   - split de frases conservador y recorte a `maxSentences`
   - si explanation vacío → `""`
2. Tests: whitespace, <4 frases, >4 frases, signos `? ! .`, y contenido con `\\( ... \\)` (no debe romper).

**Criterio de éxito**: `node --import ./cursor-tests/register.mjs cursor-tests/20260527_t14-*.mjs` exit 0 y `extractSneakPeek` nunca devuelve más de 4 frases.

criterio de éxito: Helper + tests unitarios green. Ejecuta /validate antes de cerrar este mensaje

---

**PROMPT T15 — UI: sneak peek en overlay de transición**

Añade el sneak peek a la UI de transición: se muestra **encima** del diccionario colapsado. Solo aparece cuando prefetch de N+1 está `ready`; mientras tanto muestra placeholder “Preparando siguiente bloque…”. Debe actualizarse cuando el prefetch pasa a ready con el overlay abierto.

**Contexto**:
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002d, SC-007)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`
- `study.js` ya tiene `syncPrefetchUi()` y `refreshUiOnPrefetchReady()`.

**Archivos**:
- `src/js/study.js`
- `src/js/sneakPeek.js` (importar `extractSneakPeek`)

**Tareas**:
1. En `getOrCreateTransitionOverlay()`, crear `sneakPeekWrap` + `sneakPeekText` y insertarlo **antes** de `dictionaryWrap`.
2. En `finishQuestions(idx)`, render inicial:
   - placeholder si no `ready`
   - si `ready`, usar `extractSneakPeek` desde `prefetchState.data.explanation` o desde `getBlock(nextIndex).explanation`.
3. Actualizar en:
   - `syncPrefetchUi()` cuando detecta `ready`
   - `refreshUiOnPrefetchReady()` (ya se llama al `ready`) si overlay abierto
4. Si explanation tiene 0–3 frases: mostrar lo disponible; si vacío total y ready: oculta wrap o deja placeholder (sin LLM extra).

**Criterio de éxito**: En transición, al pasar prefetch a `ready`, el texto cambia de placeholder a sneak peek sin recargar; nunca se hace llamada API adicional.

criterio de éxito: Sneak peek visible y reactivo al ready. Ejecuta /validate antes de cerrar este mensaje

---

**PROMPT T16 — Tests + quickstart para SC-007**

Añade tests y documentación para validar el sneak peek.

**Archivos**:
- `cursor-tests/20260527_t16-sneak-peek-ui.mjs` (nuevo)
- `specs/20260527-zero-latency-blocks/quickstart.md` (añadir sección §9)

**Tareas**:
1. Test integración: montar `transitionOverlay` (o llamar a funciones exportadas si existen) con estados:
   - `generating` → placeholder
   - `ready` → texto derivado (≤4 frases)
2. Actualizar `quickstart.md` con pasos manuales para SC-007 (sneak peek).

**Criterio de éxito**: suite `cursor-tests/20260527_t*.mjs` sigue green y quickstart documenta SC-007 claramente.

criterio de éxito: Tests+docs SC-007 completados sin romper suite. Ejecuta /validate antes de cerrar este mensaje

## Instrucción de ejecución

**Lanzar primero (Fase B)**: **T08** — un chat.

**En paralelo tras T08**: **T09** y **T10** (dos chats).

**Luego**: **T11** → **T12**.

**Siguiente comando Spec Kit**: `/speckit-implement` o pegar **PROMPT T08** en un chat nuevo.
-->

# ROADMAP — Zero-Latency Block Transitions (Sneak Peek Only)

**Spec**: `specs/20260527-zero-latency-blocks/spec.md`  
**Branch**: `20260527-zero-latency-blocks`

## Tareas

| ID  | Descripción                                                                                   | Dep. | Complejidad | Estado |
|-----|-----------------------------------------------------------------------------------------------|------|------------|--------|
| T13 | Reforzar que `explanation` conecte con el bloque anterior (para recorte del sneak peek)      | —    | S          | [ ]    |
| T14 | Helper `extractSneakPeek(explanation)` (≤4 frases) + tests unitarios                         | —    | S          | [ ]    |
| T15 | Render sneak peek en `transitionOverlay` (placeholder → texto al `ready`)                    | T14  | M          | [ ]    |
| T16 | Tests + quickstart para SC-007 (sneak peek)                                                  | T15  | M          | [ ]    |

## Grafo de dependencias

```text
T13 ---------------------┐
T14 ----> T15 ----> T16
```

- **Secuencial**: `T14 → T15 → T16`.  
- **Paralelo**: `T13` y `T14` pueden hacerse a la vez (no comparten archivos).

## Orden de ejecución recomendado

1. Lanzar **T13** y **T14** en paralelo (dos chats independientes).  
2. Cuando T14 esté hecha, lanzar **T15**.  
3. Al terminar T15, lanzar **T16** (cierra SC-007).

---

## PROMPT T13 — Conexión temprana en `explanation` (para sneak peek)

Actualiza el prompt de generación para que el `explanation` incluya la conexión con el bloque anterior **al inicio**, ya que el sneak peek recorta localmente las **primeras ≤4 frases** sin re-LLM.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002e, SC-007)
- Contrato: `specs/20260527-zero-latency-blocks/contracts/block-sneak-peek.md`

**Archivos**
- `src/js/api.js`

**Tareas**
1. Modifica `EXPLANATION_RSVP_THOROUGH` y `EXPLANATION_BRIEF_DEEP` para que, cuando `blockIndex >= 1` (bloque 2+):
   - La **primera frase** del párrafo Hook/Core haga explícita la conexión con el bloque inmediatamente anterior (menciona título y/o concepto clave).
   - Esa conexión aparezca **antes** del párrafo “Connection” final (el sneak peek no llega hasta ahí).
2. Verifica que el cambio **no** introduce nuevos campos JSON ni rompe reglas de formato:
   - Sin etiquetas visibles (HOOK, CORE, etc.).
   - Párrafos separados por una línea en blanco.
   - ≤15 palabras por frase; una idea por frase.
3. En `buildBlockGenerationUserContent`, cuando `blockIndex > 0`, añade (o refuerza) una línea corta con el **título del bloque anterior** dentro del contexto que se pasa al modelo, para facilitar el puente textual (sin nuevos campos en el JSON final).

**Criterio de éxito**
- Para un bloque 2+, el `explanation` generado comienza con una frase que referencia explícitamente el bloque anterior; al recortar primeras ≤4 frases con el helper, el sneak peek ya incluye ese puente pedagógico sin reescritura adicional.

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
   - Normaliza whitespace (trim, colapsar `\s+` a espacio).
   - Divide en frases con una regla conservadora que no se rompa por `? ! .`.
   - Devuelve `""` si `explanation` es vacío/no válido.
   - Devuelve como mucho `maxSentences` frases unidas con un espacio simple.
2. Crea unit tests:
   - Explicación con 0/1/3/4/5+ frases.
   - Signos `? ! .` para segmentación.
   - Texto con secuencias tipo LaTeX inline `\(...\)` para garantizar que no se rompe el conteo de frases.

**Criterio de éxito**
- `extractSneakPeek` nunca devuelve más de 4 frases y pasa todos los tests.

criterio de éxito: Helper + tests unitarios green. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T15 — Render sneak peek en `transitionOverlay`

Añade el sneak peek a la UI de transición: se muestra **encima** del diccionario colapsado. Mientras `prefetch` no esté `ready`, se muestra placeholder `"Preparando siguiente bloque..."`. Cuando pasa a `ready`, el texto se reemplaza por el sneak peek derivado del `explanation` del bloque N+1.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (FR-002c, FR-002d, SC-007)
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
3. Asegura que al pasar a `ready` con el overlay abierto se actualice el sneak peek:
   - Usa la misma lógica que ya actualiza el diccionario en `refreshUiOnPrefetchReady()` o extiende `syncPrefetchUi()`/`refreshUiOnPrefetchReady()` con un render adicional.
4. Mantén el sneak peek fuera de la vista `adjust` (no lo metas dentro de los controles de preguntas).

**Criterio de éxito**
- En transición: placeholder aparece mientras genera; al estar `ready` el texto cambia a un párrafo de ≤4 frases derivado del `explanation`, sin llamadas API adicionales.

criterio de éxito: Sneak peek visible y reactivo al ready sin llamadas extra. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T16 — Tests + quickstart para SC-007

Añade tests y documentación para validar SC-007 (sneak peek) y que no se rompa la suite.

**Contexto**
- Spec: `specs/20260527-zero-latency-blocks/spec.md` (SC-007)
- Quickstart: `specs/20260527-zero-latency-blocks/quickstart.md`

**Archivos**
- `cursor-tests/20260527_t16-sneak-peek-ui.mjs` (nuevo)
- `specs/20260527-zero-latency-blocks/quickstart.md` (añadir sección/manual §9)

**Tareas**
1. Implementa un test de integración “UI logic”:
   - Con `prefetch` en `generating`: placeholder visible.
   - Con `prefetch` `ready`: texto derivado del `explanation` y ≤4 frases.
2. Actualiza `quickstart.md` con un paso manual para SC-007 (cómo comprobar visualmente sneak peek y placeholder).

**Criterio de éxito**
- Suite `node --import ./cursor-tests/register.mjs cursor-tests/20260527_t*.mjs` pasa, y quickstart documenta SC-007 claramente.

criterio de éxito: Tests+docs SC-007 completados sin romper suite. Ejecuta /validate antes de cerrar este mensaje


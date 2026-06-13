# Deep Dive — Block split, initial assessment y service worker

**Fecha:** 2026-05-23  
**Módulo:** `api.js` / `study.js` / `session.js` / `sw.js`

---

## 1. Qué construimos

Flujo completo entre “subir material” y “empezar a estudiar”, con tres piezas encadenadas:

1. **Split de bloques (DeepSeek)** — El modelo devuelve un array JSON de bloques (`id`, `title`, `summary`, `signature`, `chunk`). La app lo parsea, normaliza, ajusta al número N pedido y rellena `chunk` si falta.
2. **Initial assessment (opcional)** — Tras confirmar bloques, pantalla para saltar o hacer un test rápido que personaliza `n_test` / `n_socratic` por bloque según resultados.
3. **Service worker** — PWA offline que antes servía JS en *cache-first* y podía dejar al usuario con código viejo tras un deploy; ahora JS e `index.html` van *network-first*.

Problema resuelto: errores opacos tipo “unexpected blocks JSON” por (a) prompt sin N bloques, (b) parseo frágil, (c) caché del SW que ignoraba fixes ya pusheados.

---

## 2. Decisiones de diseño

### Parseo en `api.js` (`parseBlockIndexFromModelResponse`) vs `safeParseJson` en `session.js`

- **Elegido:** Parser dedicado con extracción de array `[...]`, objeto `{ blocks: [...] }`, fences markdown y reparación de backslashes LaTeX.
- **Alternativas:** Solo `JSON.parse` en el string crudo; pedir al modelo “solo JSON” y confiar.
- **Trade-off:** Más código de mantenimiento, pero los LLM casi siempre añaden preámbulo o rompen escapes; un solo `JSON.parse` falla en producción de forma intermitente.

### Prompt con `exactly ${n} blocks` en lugar de `.split("{N}")`

- **Elegido:** Interpolar `n` y `lang` directamente en el template string.
- **Alternativas:** Placeholder `{N}` en el texto (había un `.split("{N}")` que **no hacía nada** porque `{N}` no estaba en el prompt).
- **Trade-off:** El modelo aún puede equivocarse de conteo; por eso existe `coerceBlockIndexToTargetCount` (recorta si sobran, falla si faltan).

### `requireChunk: false` + `splitMaterialIntoBlockChunks` como fallback

- **Elegido:** No rechazar todo el split si un bloque viene sin `chunk`; rellenar con trozos proporcionales del material limpio.
- **Alternativas:** Reintentar la llamada API; exigir `chunk` siempre.
- **Trade-off:** Los chunks de fallback no son “verbatim del concepto” sino división mecánica por palabras; mejor que bloquear toda la sesión.

### Initial assessment → `goToSessionReady` al saltar (no `startStudyingNow` directo)

- **Elegido:** Skip lleva a “Session ready” (generar full pack o estudiar).
- **Alternativas:** Ir directo al estudio (comportamiento anterior del handler).
- **Trade-off:** Un paso más en UI; coherente con el flujo post-confirm que ya pasaba por “ready”.

### SW: network-first solo para `/src/js/*.js` e `index.html`

- **Elegido:** CSS/manifest/MathJax siguen cache-first para offline rápido.
- **Alternativas:** No cachear JS; bump agresivo de `CACHE_NAME` sin cambiar estrategia; desregistrar SW en dev.
- **Trade-off:** Primera carga de JS requiere red; offline sigue pudiendo usar última versión cacheada tras una visita online.

### Bump `?v=20260523_2` en imports

- **Elegido:** Query string en módulos ES + bump de cache del SW.
- **Alternativas:** Solo confiar en network-first del SW.
- **Trade-off:** Tocar muchos archivos al bump; el SW ignora query en `pathname` — el network-first es lo que realmente arregla el bug.

---

## 3. Conceptos aplicados

| Concepto | Qué es | Dónde en nuestro código |
|----------|--------|-------------------------|
| **Parser tolerante a LLM** | Extraer JSON válido de texto ruidoso | `extractBalancedJsonText`, `parseModelJsonValue`, `unwrapBlockIndexArray` en `api.js` |
| **Normalización de dominio** | Mapear respuesta externa a estructura interna fija | `normalizeBlockIndexArray`, `coerceBlockIndexToTargetCount` en `session.js` |
| **Máquina de estados UI** | Pantallas mutuamente excluyentes vía `aria-hidden` | `showScreen(which)` en `ui.js`; `goToInitialAssessment` / `goToSessionReady` en `study.js` |
| **Service Worker lifecycle** | `install` → cache, `activate` → limpiar caches viejos, `fetch` → estrategia | `sw.js`: `CACHE_NAME`, `networkFirst`, `isNetworkFirstAsset` |
| **Cache-first vs network-first** | Quién gana si hay copia en Cache Storage | Antes: `caches.match` primero en estáticos; ahora: `fetch` primero para JS/HTML |
| **Separación API / UI** | Llamadas HTTP y prompts en un módulo; wiring de eventos en otro | `deepSeekSplitIntoBlocks` en `api.js`; handler de generate en `study.js` |
| **Defensive defaults** | Fallback cuando el modelo omite campos | `summary \|\| title`; chunks por `splitMaterialIntoBlockChunks` |
| **Overlay fullscreen efímero** | UI de assessment fuera del `<main>` | `ensureAssessmentRunnerEls`, `body.assessment-active` en `study.js` + CSS |

---

## 4. Deuda técnica y mejoras

**Bien hecho**

- Mensajes de error diferenciados (parse vs conteo de bloques).
- Parser reutilizable (`parseModelJsonValue`) alineado con assessment y otros endpoints.
- SW acota el daño de deploys sin pedir al usuario “borrar caché” cada vez.

**Chapuza / frágil**

- `coerceBlockIndexToTargetCount` **recorta** bloques si el modelo devuelve de más (pérdida de contenido silenciosa).
- Si devuelve **menos** de N, solo error — no hay reintento automático ni “relleno” de bloques.
- `window.assessmentConfig` / `window.assessmentResults` como estado global; portable a Flutter será incómodo.
- Regiones `#region agent log` con `fetch` a `127.0.0.1:7501` en `study.js` / `ui.js` — ruido y posibles fallos en producción.
- El bump `?v=` en todos los imports es manual y fácil de olvidar.

**No escalaría**

- Un solo `deepSeekSplitIntoBlocks` con material largo en un mensaje user (límites de contexto/tokens).
- Generar assessment + split + audit sin cola ni idempotencia si el usuario hace doble clic.
- Cache del SW sin versión ligada al commit/git SHA — solo nombre `pith-v5`.

**Mejoras obvias**

1. Reintento 1× si `coerced === null` o parse falla.
2. Versión de build en `config.js` exportada y usada en SW + imports automáticamente.
3. Quitar agent logs o guardarlos detrás de `DEBUG`.

---

## 5. Preguntas de consolidación

1. Si el usuario ve el mensaje **antiguo** “unexpected blocks JSON” pero el repo ya no lo contiene, ¿qué tres capas de caché revisarías (SW, HTTP, módulo ES) y en qué orden?

2. ¿Por qué `normalizeBlockIndexArray` puede devolver `null` para un array con 20 objetos válidos si `requireChunk: true`, y qué garantiza nuestro flujo actual con `requireChunk: false` + `splitMaterialIntoBlockChunks`?

3. ¿Qué pasaría si el modelo devolviera exactamente N bloques pero con `id` duplicados o desordenados (p. ej. 1,3,3,5…)? ¿Qué hace `coerceBlockIndexToTargetCount` y qué no arregla?

---

## 6. Actualización sugerida para `.cursorrules`

```markdown
- **Service worker:** Never cache-first `/src/js/*.js` or `index.html`. Bump `CACHE_NAME` on any JS behavior change.
- **LLM JSON responses:** Always use `parseModelJsonValue` / `parseBlockIndexFromModelResponse` (or equivalent), never raw `JSON.parse` on model text. Unwrap `{ blocks: [...] }` when applicable.
- **Block split:** Prompt must state exact block count N; validate with `coerceBlockIndexToTargetCount` and distinct error messages for parse vs count mismatch.
```

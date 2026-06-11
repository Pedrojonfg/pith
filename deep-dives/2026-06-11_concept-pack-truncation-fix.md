# Deep Dive — Concept pack truncation fix (RSVP)

## 1. Qué construimos

Arreglamos el fallo *"Model returned concept pack JSON we could not parse"* en el modo RSVP durante la fase 2 del split (empaquetar inventario de conceptos en bloques). El modelo devolvía JSON válido al inicio pero **cortado a mitad** por límite de tokens de salida. Añadimos `max_tokens` explícito, detección de truncado con mensaje claro, un reintento más compacto, y fallback al split mono-fase cuando el pack falla.

## 2. Decisiones de diseño

### `max_tokens: 16384` solo en concept pack

**Elegido:** constante `CONCEPT_PACK_MAX_TOKENS` aplicada únicamente en `deepSeekPackConceptsToBlocks`.

**Alternativas descartadas:**
- Subir `max_tokens` en todas las llamadas `callLlmSplit` → inflaría coste/latencia en inventario y split clásico, que suelen devolver JSON más pequeño.
- Reparar JSON truncado heurísticamente → frágil; mejor pedir más tokens o reintentar con prompt terse.

**Trade-off:** 16k tokens de salida pueden ser caros en modelos facturados por token; el pack es la única fase que genera decenas de bloques con summaries largos.

### `looksLikeTruncatedModelJson` en lugar de solo `JSON.parse`

**Elegido:** helper que distingue JSON inválido corto (ruido) de JSON largo incompleto (truncado).

**Alternativas:** asumir que todo parse failure es truncado → mensajes falsos si el modelo devuelve schema inválido (p.ej. `concept_id` duplicado con JSON completo).

**Trade-off:** heurística `length > 200` puede fallar en errores de sintaxis tempranos en payloads enormes; aceptable para UX del error.

### Fallback mono-fase en `packInventoryToBlocks`

**Elegido:** si `deepSeekPackConceptsToBlocks` lanza, llamar `deepSeekSplitIntoBlocks` y devolver `pipeline: "fallback_mono"` con `pack_fallback_reason`.

**Alternativas:**
- Solo confiar en reintentos → el usuario seguía bloqueado tras 4 intentos.
- Duplicar fallback solo en `study.js` → la ruta con caché de inventario no pasaba por `twoPhaseConceptSplit` y no tenía red de seguridad.

**Trade-off:** el fallback pierde mapeo `concept_ids` por bloque; los bloques siguen siendo usables para RSVP.

### Cuarto reintento `terse: true`

**Elegido:** instrucción explícita de summaries de 1 frase y signatures ≤5 términos.

**Alternativa:** reducir N automáticamente → sorprendería al usuario que ya eligió bloques.

## 3. Conceptos aplicados

| Concepto | Dónde aparece |
|----------|----------------|
| **Pipeline de dos fases** | Inventario (`deepSeekConceptInventory`) → pack (`deepSeekPackConceptsToBlocks`) → normalización en `session.js` |
| **Validación post-LLM** | `parseConceptPackFromModelResponse` exige overview + `concept_ids` únicos; truncado falla antes en `JSON.parse` |
| **Token budget (max_tokens)** | `llmChatCompletions` en `llm.js`; pack ahora pasa `max_tokens` vía `callLlmSplit` |
| **Retry con degradación** | 4 intentos: full → compact → terse+json → terse sin json_object |
| **Graceful degradation** | `packInventoryToBlocks` catch → `deepSeekSplitIntoBlocks` |
| **Heurística de error** | `looksLikeTruncatedModelJson` para mensajes accionables |
| **Contract testing** | Tests leen `api.js`/`session.js` para verificar wiring sin mock de red |

## 4. Deuda técnica y mejoras

**Bien hecho:**
- Fix mínimo en el cuello de botella real (salida del pack).
- Tests reproducen el patrón exacto de los logs del usuario.
- Fallback centralizado en `packInventoryToBlocks`.

**Chapuza funcional:**
- `looksLikeTruncatedModelJson` no distingue truncado de JSON mal formado largo.
- El inventario sigue sin `max_tokens` elevado; PDFs enormes podrían truncar en fase 1 con el mismo síntoma.
- `callLlmSplit` para split clásico e inventario sigue sin `max_tokens` por defecto.

**No escalaría:**
- Meter el inventario completo en el system prompt del pack crece O(conceptos); con 100+ conceptos hará falta chunking o pack por módulos.
- Cuatro reintentos secuenciales al LLM son lentos y caros en producción.

## 5. Preguntas de consolidación

1. ¿Por qué el inventario pudo pasar y el pack fallar si usan el mismo `callLlmSplit`?
2. ¿Qué condiciones exactas hacen que `parseConceptPackFromModelResponse` devuelva `null` con JSON sintácticamente válido?
3. ¿Qué pierde el usuario cuando se activa `pipeline: "fallback_mono"` respecto al pack con `concept_ids`?

## 6. Actualización sugerida para .cursorrules

1. Toda llamada LLM que espera JSON estructurado grande debe declarar `max_tokens` explícito; documentar el tamaño estimado de salida en comentario junto a la constante.
2. Los mensajes de error de parse post-LLM deben distinguir truncado, schema inválido y validación de negocio (overview, ids duplicados).
3. Si una fase de pipeline tiene fallback en `twoPhaseConceptSplit`, las rutas alternativas (caché, pre-packing) deben usar el mismo punto de degradación, no duplicar ni omitirlo.

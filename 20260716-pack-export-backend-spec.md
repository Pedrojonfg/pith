# Spec: Pack Export Backend

**Fecha:** 2026-07-16
**Depende de:** `session-store.js`, `session-types.js`, `document-preparation.js` (DPP phases T1.2/T1.3/T1.6), `api.js`, `recall-api.js`, `llm.js`, `config/supabase.js`
**Bloquea:** `20260716-pack-concept-graph-editor-spec.md`, `20260716-pack-import-flow-spec.md`

---

## 1. Objetivo

Construir la capa de datos y funciones puras necesarias para:
1. Crear un **snapshot editable** ("pack draft") a partir de una `DocumentSession` existente, sin tocar la sesión original.
2. Producir, a partir de ese draft, un **payload de exportación final** ("pack publicado") que respete la política de copyright acordada, condicionada a un flag `includeSourceDocument: boolean`.
3. Reescribir con LLM (Mistral) los campos que no se pueden borrar sin más pero tampoco se pueden compartir literalmente.

Este spec **no** incluye UI. El editor de grafo (spec separado) opera sobre las filas creadas aquí. El flujo de compartir/importar (spec separado) consume la fila `status='published'` creada aquí.

## 2. Non-goals

- No hay selección parcial de contenido (bloques sueltos). Un pack es la `DocumentSession` completa o nada.
- No hay versionado ni sincronización: una vez publicado, el pack es inmutable. Ediciones posteriores del creador no propagan a quien ya importó.
- No hay moderación, revisión manual, ni marketplace/búsqueda pública. Solo publicación por código (ver spec de import).
- No se reescriben explicaciones de bloque, preguntas, ni ningún campo fuera de los tres identificados en la auditoría (`conceptInventory[].source_phrase`/`anchorRange`, `modes.recall.questions[].source_chunks`, definiciones/notas de origen-Vault si están presentes en el snapshot — ver Open Question 3).
- No se gestiona el `Vault` real del creador. El export nunca lee ni escribe `pith_knowledge_vault` / la tabla vault del creador; solo puede tocar copias de texto derivado que ya viven dentro de `shared` del documento, si las hay.

## 3. Modelo de datos

Nueva tabla Supabase `shared_packs`:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `uuid` PK | |
| `code` | `text` UNIQUE | Generado por el spec de import; NULL mientras `status='draft'` |
| `owner_user_id` | `uuid` FK → `auth.users` | Creador |
| `source_doc_id` | `text` | `docId` de la `DocumentSession` origen, para trazabilidad, no para sync |
| `title` | `text` | Copiado de `docMeta.titleInferred` al crear el draft, editable |
| `status` | `text` | `'draft' \| 'published'` |
| `include_source_document` | `boolean` | Toggle decidido al publicar; NULL mientras es draft |
| `snapshot` | `jsonb` | Ver estructura en §4. Mutable mientras `status='draft'`, inmutable tras publicar |
| `created_at` | `timestamptz` | |
| `published_at` | `timestamptz` | NULL mientras es draft |

RLS: `owner_user_id = auth.uid()` para lectura/escritura de drafts propios. Lectura de packs `status='published'` disponible a cualquier usuario autenticado vía función RPC de lookup por `code` (no vía SELECT directo abierto — evita enumeración de la tabla completa).

## 4. Estructura de `snapshot` (jsonb)

Al crear el draft (§5.1), clonar **solo** estos sub-árboles de `shared` de la `DocumentSession` origen — nada más:

```
{
  "docMeta": { ...tal cual... },
  "docHierarchy": { ...tal cual... },
  "conceptInventory": [ ...clon profundo, editable por spec de grafo... ],
  "conceptGraph": { nodes: [...], edges: [...] },  // editable por spec de grafo
  "modeRecommendation": { ...tal cual... },
  "modes": {
    "rsvp": { ...clon de bloques/explicaciones/preguntas... },
    "questions": { ...idem... },
    "cloze": { ...clon completo, se descarta entero si !includeSourceDocument... },
    "recall": { ...clon completo... }
  },
  "images": [ ...clon de shared.images, se descarta entero si !includeSourceDocument... ],
  "rawMarkdown": "...",  // clon completo, se descarta si !includeSourceDocument
  "slowSlice": { ... }   // clon de modes.slow completo, se descarta entero si !includeSourceDocument
}
```

`slowSlice` se nombra aparte (no `modes.slow`) para dejar explícito en el propio dato que es candidato a exclusión total, no a limpieza de campos.

## 5. Funciones

### 5.1 `createPackDraft(docId: string, ownerUserId: string): Promise<PackDraftRow>`

- Lee la `DocumentSession` vía `session-store.js`.
- Clona los sub-árboles de §4 (deep clone, sin referencias compartidas con la sesión origen — verificar que ninguna mutación posterior del draft toque la sesión real).
- Inserta fila en `shared_packs` con `status='draft'`, `code=NULL`.
- Devuelve la fila para que el editor de grafo (spec separado) la use como fuente/destino.

### 5.2 `finalizePack(packDraftId: string, includeSourceDocument: boolean): Promise<PackPublishedRow>`

Lee el draft (con las ediciones de grafo ya aplicadas por el spec de editor) y produce el snapshot final:

**Si `includeSourceDocument === true`:** el snapshot se copia tal cual, sin ninguna limpieza. Se marca `published_at`, `status='published'`.

**Si `includeSourceDocument === false`:**
1. Eliminar del snapshot: `rawMarkdown`, `slowSlice`, `modes.cloze`, `images`.
2. Para cada entrada de `conceptInventory`: eliminar `source_phrase` y `anchorRange`.
3. Para cada pregunta de `modes.recall.questions[]`: sustituir `source_chunks` por la versión reescrita (§6).
4. Si el snapshot contiene campos de origen-Vault (ver Open Question 3): aplicar la misma reescritura.
5. Marcar `published_at`, `status='published'`.

Esta función **no** genera el `code` — eso corresponde al spec de import, que llama a esta función y luego asigna el código.

## 6. Reescritura con Mistral

Nuevo contrato en `api.js` (o archivo nuevo `pack-export.js`, decisión de Cursor según convención del repo): `rewritePackExcerpt(text: string, context: { conceptLabel?: string, kind: 'recall_excerpt' | 'vault_definition' | 'vault_notes' }): Promise<string>`.

- Modelo: Mistral **Medium o Large** (no Small — este es exactamente el caso de "coste irrelevante, calidad importa" de las notas del proyecto: se ejecuta una vez por pack publicado, no por usuario).
- Temperatura: 0.3 (prosa, no JSON estructurado puro, pero se busca fidelidad técnica, no creatividad).
- Prompt: instruir explícitamente "reformula preservando el contenido técnico exacto (cifras, nombres, relaciones causales); no debe ser una paráfrasis superficial que cambie palabras sueltas mientras conserva la estructura de la frase original; el resultado no debe poder buscarse literalmente en el texto original."
- Sin `max_tokens` fijo genérico — calcular en función de la longitud del input (mismo patrón que otras llamadas en `api.js`).
- Manejo de fallo: si la llamada falla o el output está vacío, **no publicar el pack** — devolver error explícito al caller, nunca degradar silenciosamente a dejar el campo tal cual (eso reintroduciría el riesgo de copyright que se intenta evitar).

## 7. Open questions para Cursor (resolver por inspección de repo antes de codificar)

1. **Forma exacta de `conceptGraph`** (`nodes`/`edges` vs. otra estructura) — inspeccionar `graph/build.js` y el tipo real persistido en `shared.conceptGraph` antes de fijar el shape de §4.
2. **`modes.recall.questions[].source_chunks`**: confirmar el shape exacto (¿array de strings, o array de objetos `{text, ...}`?) inspeccionando `recall-slice.js:88-98` (ya referenciado en la auditoría) antes de escribir la función de sustitución.
3. **Campos de origen-Vault dentro del snapshot de sesión**: determinar si `extractVaultCandidates` / `mergeProposals` (o cualquier preview de candidatos a Vault) vive dentro de `shared` de la `DocumentSession`, o si el Vault es exclusivamente una tabla global fuera de cualquier sesión. Si es lo segundo, **no hay nada que reescribir aquí** para Vault — el pack nunca toca el Vault real de nadie, y el punto 4 de §5.2 se convierte en no-op. Si es lo primero, identificar el campo exacto y aplicar §6.
4. Confirmar mecanismo de deep-clone disponible en el repo (¿ya existe un helper, o `structuredClone`/`JSON.parse(JSON.stringify(...))` es aceptable dado que el contenido es JSON-serializable?).

## 8. Orden de implementación (menor a mayor riesgo)

1. Migración Supabase: tabla `shared_packs` + RLS + función RPC de lookup por `code`.
2. `createPackDraft` — función pura de lectura+clonado+insert. Testeable con fixtures de `DocumentSession`.
3. Lógica de limpieza de campos (paso 1-2 de §5.2) — función pura, sin llamadas a red, testeable con fixtures (aserción: campos ausentes tras limpieza).
4. Integración Mistral (§6) — aislada detrás de la función `rewritePackExcerpt`, testeable con mock del proxy `llm.js`.
5. `finalizePack` completo, uniendo 3 y 4.

## 9. Criterios de aceptación

- Fixture de `DocumentSession` con documento copyrighted simulado → `finalizePack(..., false)` produce snapshot sin `rawMarkdown`, sin `modes.cloze`, sin `images`, sin `source_phrase`/`anchorRange` en ningún elemento de `conceptInventory`.
- El `source_chunks` reescrito, comparado con el original vía `jaccardOverlap` (reutilizar de `fidelity-validation.js`), debe tener solapamiento **bajo** (definir umbral en implementación, sugerido <0.3) — uso inverso deliberado de la misma utilidad que hoy detecta *demasiado poco* solapamiento.
- `finalizePack(..., true)` no modifica ningún campo del snapshot respecto al draft.
- Fallo simulado de Mistral → `finalizePack` rechaza la promesa, la fila permanece en `status='draft'`.

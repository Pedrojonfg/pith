# Spec: Pack Concept Graph Editor

**Fecha:** 2026-07-16
**Depende de:** `20260716-pack-export-backend-spec.md` (tabla `shared_packs`, `createPackDraft`), `graph/build.js`, `graph/canvas.js`, `graph/view.js`, `graph/ids.js`, `ui.js`
**Bloquea:** ninguno directamente, pero debe completarse antes de que `finalizePack` reciba snapshots con ediciones reales.

---

## 1. Objetivo

Permitir al creador de un pack, tras generar el draft (`createPackDraft`), editar el **grafo de conceptos** de ese draft antes de publicar:
- Renombrar un nodo (concepto).
- Añadir un nodo nuevo (concepto sin origen en el DPP).
- Eliminar un nodo.
- Añadir una relación (edge) entre dos nodos, con tipo.
- Eliminar una relación.

El editor opera **exclusivamente sobre `snapshot.conceptGraph` y `snapshot.conceptInventory`** de la fila `shared_packs` en `status='draft'`. Nunca lee ni escribe la `DocumentSession` original del creador.

## 2. Non-goals

- No se edita el texto de explicaciones de bloque, preguntas, definiciones largas, ni ningún contenido fuera de: label del nodo (= `conceptInventory[].title` correspondiente) y estructura del grafo (nodos/edges).
- No hay cascada automática hacia contenido dependiente: si se elimina un nodo, **no** se reescriben ni eliminan las preguntas/bloques que lo mencionaban. Referencias colgantes a un `conceptId` eliminado son un riesgo aceptado explícitamente para esta versión (ver §5).
- No hay undo/redo, ni historial de versiones del draft.
- No hay edición colaborativa/tiempo real — un único creador, una sesión de edición a la vez.
- No hay validación semántica del grafo resultante (ciclos, nodos huérfanos tras editar) más allá de lo mínimo descrito en §4.

## 3. Pantalla nueva

`screenPackConceptEditor` (nombre a confirmar contra convención de `ui.js` — seguir el patrón `screenX` / `showScreen(id)` ya existente).

**Entrada:** desde un botón "Editar y publicar" en el flujo de creación de pack (el punto exacto de entrada — `screenDocLibrary`, `screenVaultBranch`, o un nuevo punto — es decisión de Cursor tras inspeccionar dónde tiene sentido colgar la acción "crear pack de esta sesión"; flagear como Open Question 1).

**Salida:** botón "Publicar" → invoca `finalizePack` (del spec de backend) con el `includeSourceDocument` elegido en un toggle en esta misma pantalla o en un paso previo (decisión de UX libre para Cursor, pero el toggle debe existir en algún punto de este flujo antes de publicar).

## 4. Comportamiento del editor

Reutilizar el render existente de `graph/canvas.js` (SVG) montado por `graph/view.js` (`mountMaterialGraphScreen` o equivalente), añadiendo un **modo edición** activado en esta pantalla (no en `screenSlowGraph`, que permanece read-only).

| Acción | Interacción | Efecto en `snapshot` |
|---|---|---|
| Renombrar nodo | Click en nodo → input inline o modal con el `title` actual | Actualiza `conceptInventory[].title` de la entrada correspondiente al `conceptId` del nodo |
| Añadir nodo | Botón "+ Concepto" → modal pidiendo nombre | Crea entrada nueva en `conceptInventory` con `canonicalId` generado localmente (usar el mismo esquema de IDs que `graph/ids.js` para consistencia) y nodo correspondiente en `conceptGraph.nodes` |
| Eliminar nodo | Click en nodo → botón eliminar con confirmación | Elimina la entrada de `conceptInventory`, elimina el nodo de `conceptGraph.nodes`, elimina **todos** los edges de `conceptGraph.edges` que referencien ese nodo (evita edges colgantes — esto es integridad estructural mínima, no cascada semántica) |
| Añadir relación | Selección de dos nodos → picker de tipo (`PREREQUISITE`, `CONTRADICTS`, `EXEMPLIFIES`, `PART_OF`, `ASSOCIATED` — reutilizar `EDGE_TYPES` de `graph/build.js`) | Añade edge a `conceptGraph.edges` |
| Eliminar relación | Click en edge → confirmación | Elimina edge de `conceptGraph.edges` |

**Persistencia:** cada acción actualiza el `snapshot` en memoria; guardar contra Supabase con debounce (no una escritura por click) o al salir de pantalla/publicar — decisión de Cursor según el patrón de guardado ya usado en otras pantallas de edición del repo (Open Question 2).

## 5. Open questions para Cursor

1. **Punto de entrada del flujo "crear pack"** — no existe hoy ningún botón de este tipo en el repo. Decidir la ubicación más natural inspeccionando `screenDocLibrary` / `screenVaultBranch` y el patrón de acciones por sesión ya existente (ej. junto a export/compartir si algo así existe).
2. **Patrón de guardado incremental** — inspeccionar si hay un wrapper de retry-with-backoff ya implementado (mencionado en las notas del proyecto como pendiente) y usarlo si existe; si no, guardar de forma simple con manejo de error básico, sin construir el wrapper aquí (eso es otro spec).
3. **IDs de nodos nuevos** — confirmar el algoritmo exacto de generación de IDs en `graph/ids.js` para no crear colisiones con los IDs ya existentes en `conceptInventory` al añadir un nodo nuevo.
4. **Referencias colgantes tras eliminar un nodo**: confirmar que ningún otro campo del snapshot (ej. `modeRecommendation`, bloques de `modes.rsvp`) rompe en runtime si referencia un `conceptId` que ya no existe en `conceptInventory` — si el riesgo de romper el estudio del pack importado es alto, considerar (solo si es trivial) marcar el nodo como "oculto" en vez de borrarlo físicamente. Decisión de Cursor tras inspección; si no es trivial, dejarlo como limitación conocida y documentarla en el propio código.

## 6. Orden de implementación

1. Pantalla nueva mostrando el grafo del draft en modo **solo lectura**, cargando `snapshot.conceptGraph` (riesgo bajo, valida el pipeline de datos antes de tocar interacción).
2. Renombrar nodo (interacción más simple, sin tocar estructura del grafo).
3. Eliminar nodo (con limpieza de edges asociados).
4. Añadir nodo.
5. Añadir/eliminar relación (interacción más compleja: selección de dos nodos).
6. Conexión con "Publicar" → `finalizePack`.

## 7. Criterios de aceptación

- Editar el draft de un pack no modifica en ningún caso la `DocumentSession` original del creador (verificar con test: snapshot antes/después del editor vs. sesión original sin cambios).
- Eliminar un nodo deja el grafo sin edges huérfanos (ningún edge referencia un `nodeId` inexistente).
- Renombrar un nodo se refleja tanto en el render del grafo como en `conceptInventory[].title` del snapshot persistido.

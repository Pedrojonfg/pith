# Spec: Plan de Pruebas — Pack Sharing (export, editor, import)

**Fecha:** 2026-07-16
**Cubre:** `20260716-pack-export-backend-spec.md`, `20260716-pack-concept-graph-editor-spec.md`, `20260716-pack-import-flow-spec.md`
**Tipo:** verificación post-implementación, no diseño nuevo.

---

## 1. Objetivo

Confirmar que las tres piezas implementadas cumplen exactamente lo especificado, con foco especial en los dos puntos que no admiten fallo silencioso: **aislamiento de la sesión/Vault original del creador** y **ausencia real de contenido de riesgo copyright cuando `includeSourceDocument=false`**. Un fallo en cualquiera de esos dos puntos invalida la premisa legal de todo el feature, así que se tratan como bloqueantes, no como bugs menores.

## 2. Cómo usar este documento

Cada sección es un bloque de tests independiente, ordenado de menor a mayor alcance (fixture puro → integración → end-to-end). Ejecutar en ese orden: si algo falla en fixtures, no tiene sentido gastar tiempo en E2E hasta arreglarlo. Usar `Node.js --test` para fixture/integración (patrón ya establecido en el repo); los E2E pueden ser manuales sobre `screenPackConceptEditor` / `screenCreateSessionStart` si no hay infraestructura de automatización de UI.

---

## 3. Backend de export (`shared_packs`, `createPackDraft`, `finalizePack`)

### 3.1 `createPackDraft`

| # | Test | Assert |
|---|------|--------|
| 3.1.1 | Crear draft desde una `DocumentSession` con documento normal | Fila insertada con `status='draft'`, `code=NULL`, `include_source_document=NULL` |
| 3.1.2 | Snapshot clonado contiene exactamente los campos de §4 del spec de backend, ni uno más | Diff de claves entre `snapshot` y la lista fija — cualquier campo extra es fallo |
| 3.1.3 | Mutar el `snapshot` del draft tras crearlo no afecta a la `DocumentSession` original | Comparar sesión original antes/después byte a byte (deep equal) |
| 3.1.4 | Mutar la `DocumentSession` original tras crear el draft no afecta al `snapshot` ya creado | Mismo test en sentido inverso — confirma que es deep clone, no referencia compartida |
| 3.1.5 | RLS: usuario distinto al `owner_user_id` no puede leer ni escribir el draft | Llamada autenticada con otro usuario → error de permisos, no `null` silencioso |

### 3.2 `finalizePack` — `includeSourceDocument = true`

| # | Test | Assert |
|---|------|--------|
| 3.2.1 | Snapshot publicado es idéntico al draft (sin ninguna limpieza) | Deep equal snapshot draft vs. publicado |
| 3.2.2 | `status` pasa a `'published'`, `published_at` se rellena | |
| 3.2.3 | No se ejecuta ninguna llamada a Mistral durante este camino | Spy/mock del proxy `llm.js` — cero invocaciones |

### 3.3 `finalizePack` — `includeSourceDocument = false`

| # | Test | Assert |
|---|------|--------|
| 3.3.1 | `rawMarkdown` ausente en el snapshot publicado | `snapshot.rawMarkdown === undefined` |
| 3.3.2 | `slowSlice` ausente | |
| 3.3.3 | `modes.cloze` ausente | |
| 3.3.4 | `images` ausente | |
| 3.3.5 | Cada entrada de `conceptInventory` no tiene `source_phrase` ni `anchorRange`, para **todas** las entradas, no solo la primera | Iterar el array completo, no muestrear |
| 3.3.6 | Cada `modes.recall.questions[].source_chunks` está reescrito, no ausente | Campo presente pero con contenido distinto del original |
| 3.3.7 | Solapamiento léxico (`jaccardOverlap`) entre `source_chunks` original y reescrito por debajo del umbral definido en implementación | Test explícito por fixture con texto conocido, no solo "distinto" |
| 3.3.8 | El contenido técnico del `source_chunks` reescrito se mantiene (cifras, nombres propios, relación causal) | Fixture con un excerpt que contenga un dato verificable (ej. una fecha o cifra) → confirmar que sigue presente tras la reescritura |
| 3.3.9 | Si existen campos de origen-Vault en el snapshot (según cómo se resolvió la Open Question 3 del spec de backend): mismo tratamiento que 3.3.6-3.3.8. Si se resolvió que Vault nunca vive en el snapshot de sesión: test explícito que confirme que `finalizePack` no intenta tocar ningún dato de Vault (ni lectura ni escritura) | Spy sobre cualquier función de acceso a Vault — cero invocaciones |
| 3.3.10 | Fallo simulado de Mistral (mock que rechaza la promesa) durante la reescritura | `finalizePack` rechaza, la fila permanece `status='draft'`, ningún campo queda parcialmente reescrito |
| 3.3.11 | `conceptGraph` y el resto de `docHierarchy`/`docMeta`/`modeRecommendation` permanecen intactos (solo se tocan los campos listados explícitamente) | Diff selectivo — nada fuera de la lista cambia |

### 3.4 Código y unicidad (parte compartida con spec de import, verificar aquí el generador)

| # | Test | Assert |
|---|------|--------|
| 3.4.1 | Código generado cumple formato/longitud definidos en implementación | Regex sobre el resultado |
| 3.4.2 | Colisión simulada (mock de la comprobación de unicidad devolviendo "ya existe" una vez) → se reintenta y genera uno distinto | No debe fallar la publicación por una colisión aislada |
| 3.4.3 | Intentar publicar un pack ya `status='published'` por segunda vez | Comportamiento explícito (rechazar o no-op) — no debe generar un segundo código ni duplicar la fila |

---

## 4. Editor de grafo (`screenPackConceptEditor`)

| # | Test | Assert |
|---|------|--------|
| 4.1 | Carga inicial en modo lectura pinta los nodos/edges del `snapshot.conceptGraph` tal cual | Comparar contra fixture conocido |
| 4.2 | Renombrar un nodo actualiza `conceptInventory[].title` de la entrada correspondiente **y** el label mostrado en el render, sin tocar ningún otro campo de esa entrada | |
| 4.3 | Añadir nodo crea entrada nueva en `conceptInventory` con `canonicalId` no colisionante con ninguno existente | Repetir con varios nodos añadidos en la misma sesión de edición para confirmar que no se repiten IDs |
| 4.4 | Eliminar un nodo elimina su entrada de `conceptInventory` y su nodo de `conceptGraph.nodes` | |
| 4.5 | Eliminar un nodo elimina **todos** los edges que lo referencian, sin dejar edges huérfanos | Fixture con un nodo conectado a 3+ edges distintos → confirmar los 3 desaparecen |
| 4.6 | Eliminar un nodo que no tiene ningún edge asociado no rompe nada (caso borde) | |
| 4.7 | Añadir relación entre dos nodos existentes con un tipo válido de `EDGE_TYPES` | Edge persistido con el tipo correcto |
| 4.8 | Intentar añadir relación con un tipo no perteneciente a `EDGE_TYPES` | Rechazado explícitamente, no persistido silenciosamente como string libre |
| 4.9 | Eliminar una relación concreta no afecta a otros edges entre los mismos nodos si hubiera más de uno (caso borde, solo si el modelo de datos permite edges múltiples entre el mismo par) | |
| 4.10 | Ninguna operación del editor toca la `DocumentSession` original del creador | Repetir el test 3.1.3 tras cada tipo de operación del editor (rename/add/delete nodo, add/delete edge) |
| 4.11 | Guardado incremental: cerrar y reabrir el editor sobre el mismo draft recupera el último estado guardado, no el estado inicial del snapshot | |
| 4.12 | Publicar desde el editor invoca `finalizePack` con el snapshot **ya editado**, no con el snapshot original del draft | Test de integración 3+4: crear draft → editar (rename+delete+add edge) → publicar → importar (§5) → confirmar que el grafo importado refleja las ediciones, no el original |

---

## 5. Código e import (`importPackAsSession`, UI en `screenCreateSessionStart`)

### 5.1 Generación y validación de código (UI)

| # | Test | Assert |
|---|------|--------|
| 5.1.1 | Código inválido (no existe) → mensaje de error claro, no crash | |
| 5.1.2 | Código de un pack en `status='draft'` (no publicado) → tratado como inválido | Confirma que la RPC de lookup filtra por `status='published'` |
| 5.1.3 | Código válido → se muestra `title` del pack y nombre del creador antes de confirmar import | |

### 5.2 Clonado (`importPackAsSession`)

| # | Test | Assert |
|---|------|--------|
| 5.2.1 | `docId` generado para la sesión importada es distinto del `source_doc_id` del pack y no colisiona con sesiones existentes del importador | |
| 5.2.2 | Import de un pack **con** documento origen: `rawMarkdown`, `images`, `modes.slow`, `modes.cloze` presentes y funcionales en la sesión resultante | Entrar en Slow Mode y Cloze de la sesión importada sin errores |
| 5.2.3 | Import de un pack **sin** documento origen: los mismos campos están ausentes, y las entradas de menú/UI para Slow/Cloze no aparecen (o aparecen deshabilitadas) en la sesión importada | |
| 5.2.4 | `projectId` de la sesión importada = proyecto activo del importador en el momento de importar, no el proyecto del creador | |
| 5.2.5 | Ninguna llamada a Mistral se dispara durante el import (ni para inventario, ni bloques, ni preguntas) | Spy sobre `llm.js` — cero invocaciones de regeneración de contenido; solo se permite la llamada específica de la fase T1.6 si esta usa LLM (confirmar contra implementación real) |
| 5.2.6 | Importar el mismo código dos veces (mismo usuario) produce dos `DocumentSession` con `docId` distintos | |
| 5.2.7 | Importar el mismo código con dos usuarios distintos produce sesiones independientes; editar/estudiar una no afecta a la otra | |
| 5.2.8 | Sesión importada no contiene ningún dato del Vault del creador (ni entradas, ni `globalConceptId` heredados de un Vault ajeno) | Inspección directa del store de Vault del importador tras el import: debe seguir vacío hasta que el importador estudie |
| 5.2.9 | Tras estudiar la sesión importada (completar al menos un bloque/retrieval), el Vault **propio** del importador empieza a poblarse siguiendo las reglas normales de maduración (gray/yellow/green) | Test funcional end-to-end, no solo de datos |
| 5.2.10 | Atribución (creador del pack) visible en la UI de la sesión importada | |

### 5.3 Regresión sobre el flujo existente

| # | Test | Assert |
|---|------|--------|
| 5.3.1 | Subir un documento nuevo por el camino de siempre (sin código) sigue funcionando exactamente igual que antes de este feature | Test de regresión completo del flujo de creación de sesión por archivo |
| 5.3.2 | La presencia de la nueva opción "usar código" no altera el estado/validación del formulario de subida de archivo | |

---

## 6. End-to-end (los dos caminos completos)

### 6.1 Camino "con documento"

1. Usuario A sube un PDF → sesión normal funcional.
2. Usuario A crea draft de pack desde esa sesión.
3. Usuario A edita el grafo: renombra un nodo, elimina otro, añade uno nuevo, añade una relación.
4. Usuario A publica con `includeSourceDocument=true`.
5. Usuario A recibe un código.
6. Usuario B (cuenta distinta) introduce el código en un proyecto propio.
7. **Assert:** sesión de B tiene Slow Mode y Cloze funcionales, grafo de conceptos de B refleja las ediciones del paso 3 (no el grafo original de A), sesión de A permanece sin cambios.

### 6.2 Camino "sin documento"

Mismo flujo que 6.1 pero con `includeSourceDocument=false`. Además de los asserts anteriores:

- **Assert bloqueante:** ningún campo del snapshot publicado ni de la sesión importada de B contiene el texto original del PDF de A, ni fragmentos literales de más de la longitud mínima de riesgo (definir umbral, ej. >15 palabras consecutivas coincidentes) al compararlo contra el `rawMarkdown` original de A. Esto es una búsqueda de substring/n-gramas entre el documento original de A y **todo** el contenido textual de la sesión de B (bloques, preguntas, definiciones, `source_chunks` reescritos) — no solo comprobar que el campo `rawMarkdown` está vacío, sino que no ha quedado ningún resto reconocible en otros campos.
- **Assert:** B no puede entrar en Slow Mode ni Cloze para esta sesión (opciones ausentes o bloqueadas).

## 7. Seguridad y aislamiento (transversal)

| # | Test | Assert |
|---|------|--------|
| 7.1 | Usuario C, sin relación con A ni B, no puede leer el `snapshot` de un draft ajeno vía API directa | Error de permisos |
| 7.2 | Usuario C no puede enumerar la tabla `shared_packs` para descubrir códigos por fuerza bruta trivial (sin RPC de lookup exacto) | Confirmar que no hay endpoint de listado abierto |
| 7.3 | Tras todo el ciclo (draft → edición → publicación → import por B), la `DocumentSession`, el Vault y el `conceptGraph` originales de A permanecen exactamente iguales a como estaban antes de crear el pack | Snapshot completo de los datos de A al inicio vs. al final del test E2E — deep equal |

## 8. Checklist manual rápida (para verificar antes de grabar cualquier demo)

- [ ] Publicar un pack con documento → código generado → importar en otra cuenta → estudiar un bloque → todo sin errores en consola.
- [ ] Publicar un pack sin documento → confirmar visualmente que Slow/Cloze no están disponibles en la sesión importada.
- [ ] Editar el grafo (los 5 tipos de operación) y publicar → confirmar visualmente que el pack importado refleja las ediciones, no el grafo original.
- [ ] Confirmar que la sesión original del creador sigue intacta tras todo el proceso (recargar su sesión y comparar).

## 9. Criterio de "hecho"

Los tests de §3.3 (limpieza de campos), §5.2.8-5.2.9 (aislamiento de Vault) y §6.2 (búsqueda de fragmentos literales end-to-end) son **bloqueantes**: ningún otro trabajo sobre este feature (incluida cualquier grabación de demo) debería darse por buena hasta que estos pasen, porque son los que sostienen la premisa legal completa del feature, no solo su corrección funcional.

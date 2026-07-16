# Spec: Pack Code & Import Flow

**Fecha:** 2026-07-16
**Depende de:** `20260716-pack-export-backend-spec.md` (tabla `shared_packs`, `finalizePack`), `session-store.js`, `session-types.js`, `document-preparation.js` (fase T1.6), `screenCreateSessionStart`, `project-store.js`
**Bloquea:** ninguno.

---

## 1. Objetivo

1. Generar un **código** único y legible para un pack recién publicado.
2. Añadir un camino alternativo en el flujo de creación de sesión ("usar código de pack" en vez de "subir documento").
3. Al introducir un código válido: clonar el snapshot publicado del pack como una `DocumentSession` nueva, propiedad del usuario que importa, dentro del proyecto activo.
4. Re-ejecutar únicamente la fase de vinculación al Vault propio del importador (DPP T1.6), sin regenerar el resto del pipeline (inventario, grafo, bloques, preguntas ya vienen resueltos en el snapshot).

## 2. Non-goals

- No hay sincronización entre el pack publicado y las sesiones ya importadas. Cambios futuros del creador (no contemplados en este spec: la publicación es inmutable) nunca llegan a los importadores.
- No hay deduplicación de imports: cada vez que un usuario introduce el mismo código, se crea una `DocumentSession` nueva, incluso si ya había importado ese pack antes.
- No hay expiración, revocación, ni control de acceso granular sobre el código más allá de "usuario autenticado + proyecto activo". Cualquiera con el código y una cuenta puede importar.
- No hay analítica de cuántas veces se ha importado un pack, ni notificación al creador.
- No hay pantalla de "explorar packs públicos" — el único mecanismo de descubrimiento es el código compartido fuera de banda (el propio creador lo pasa a sus alumnos).

## 3. Generación del código

Al publicar (`finalizePack` ya ejecutado, fila en `status='published'`):

- Formato: alfanumérico mayúsculas + dígitos, longitud 6-8 caracteres (decisión final de Cursor; suficiente espacio para evitar colisiones a la escala de la fase de testing/demo — no se requiere resistencia a fuerza bruta tipo contraseña).
- Excluir caracteres ambiguos al leer en voz alta o escribir a mano si es sencillo (`0`/`O`, `1`/`I`/`L`) — mejora de UX de bajo coste, no bloqueante si Cursor decide omitirlo por tiempo.
- Verificar unicidad contra `shared_packs.code` antes de asignar (reintentar generación en caso de colisión).
- Persistir en `shared_packs.code` de la fila ya publicada.
- Mostrar el código al creador tras publicar, con opción de copiar.

## 4. UI: entrada de código

En `screenCreateSessionStart` (pantalla existente donde hoy se sube un documento):

- Añadir una opción/tab/toggle "Usar código de pack" junto a la opción de subida de archivo existente.
- Input de texto para el código + botón "Importar".
- Validación: si el código no existe o la fila no está en `status='published'`, mostrar error claro ("código no válido").
- Mostrar, antes de confirmar la importación, el `title` del pack y el nombre del creador (`owner_user_id` → perfil), para que el alumno sepa qué está importando.

## 5. Clonado de sesión

Función `importPackAsSession(packCode: string, importingUserId: string, projectId: string): Promise<DocumentSession>`:

1. Lookup de `shared_packs` por `code` (vía la RPC ya definida en el spec de backend, `status='published'` obligatorio).
2. Generar `docId` nuevo (mismo esquema de hash usado hoy para sesiones — confirmar en `session-types.js`, Open Question 1).
3. Construir `shared` de la nueva `DocumentSession` copiando **directamente** el `snapshot` del pack (`docMeta`, `docHierarchy`, `conceptInventory`, `conceptGraph`, `modeRecommendation`; `rawMarkdown`/`images`/`slowSlice` presentes solo si `include_source_document=true` en el pack origen).
4. Construir `modes` copiando `rsvp`/`questions`/`recall` (y `cloze` si estaba presente) del snapshot **sin regenerar nada vía LLM** — son bloques y preguntas ya resueltos, se copian tal cual.
5. `projectId` = proyecto activo del importador (parámetro de la función, no del pack).
6. `createdAt`/`updatedAt` = ahora.
7. Vault: **no** copiar ningún estado de Vault del creador. La nueva sesión empieza sin relación con el Vault del importador — solo se ejecuta la fase T1.6 (vinculación a Vault) del DPP, apuntando al Vault propio del importador, para que sus conceptos empiecen a poder "ganar" entradas de Vault por retrieval igual que si el documento fuera suyo.
8. Guardar attribution: añadir un campo (nuevo o reutilizando `uploadMeta`, Open Question 2) con `sourcePackId` y nombre del creador, para poder mostrar "Importado del pack de [nombre]" en la UI de la sesión.
9. Persistir vía `session-store.js` como una `DocumentSession` nueva estándar — a partir de aquí, el resto de la app (estudio, modos, etc.) la trata exactamente igual que cualquier otra sesión.

## 6. Open questions para Cursor

1. **Esquema de generación de `docId`** — confirmar en `session-types.js` / `session-store.js` el mecanismo actual (mencionado en el overview como "hash de markdown normalizado") y decidir un esquema equivalente para sesiones importadas que no parten de un `rawMarkdown` propio (podría ser hash del `packCode` + timestamp, o UUID — cualquiera es aceptable siempre que no colisione con el esquema de hash de documentos subidos).
2. **Dónde vive la atribución** — decidir si se reutiliza `uploadMeta` (extendiendo su forma) o se añade un campo nuevo en `shared`, inspeccionando primero cómo se renderiza hoy `uploadMeta` en `screenDocLibrary` para no romper esa UI.
3. **Ejecución de la fase T1.6 aislada** — confirmar en `document-preparation.js` (`PHASE_RUNNERS`) que T1.6 es invocable de forma independiente sobre una sesión ya con `conceptInventory` resuelto, sin depender de que T1.1-T1.5 se acaben de ejecutar en la misma pasada. Si el runner asume ejecución secuencial completa, puede ser necesario extraer la lógica de T1.6 a una función invocable de forma aislada — evaluar coste antes de implementar el resto del spec.
4. **Copia de `modes.cloze`** cuando el pack sí incluye documento: confirmar que el `pipelineStatus` y demás metadatos internos del slice de Cloze no dependen de IDs de sesión que cambiarían al clonar (ej. referencias a `docId` original incrustadas dentro del slice).

## 7. Orden de implementación

1. Generación de código + persistencia en `shared_packs.code` al publicar (extensión pequeña sobre el spec de backend, bajo riesgo).
2. Función `importPackAsSession` sin UI, testeable con fixtures de packs publicados (con y sin documento origen).
3. Integración de la fase T1.6 aislada (el punto de mayor incertidumbre, según Open Question 3 — resolver esa pregunta antes de estimar esta parte).
4. UI de entrada de código en `screenCreateSessionStart` (el camino de subida de archivo existente no debe modificarse, solo añadir una rama nueva).
5. UI de atribución en la sesión importada y en la pantalla de confirmación pre-import.

## 8. Criterios de aceptación

- Importar un código válido crea una `DocumentSession` nueva y completa, funcional en todos los modos presentes en el pack, sin ninguna llamada a Mistral para regenerar contenido ya resuelto.
- Importar el mismo código dos veces produce dos `DocumentSession` distintas e independientes.
- La sesión importada no contiene ninguna referencia al Vault del creador del pack.
- Tras importar, el flujo normal de estudio (RSVP/Cloze/Recall/Slow según corresponda) hace que los conceptos empiecen a poder aparecer en el Vault del importador, exactamente igual que en una sesión subida por él mismo.
- El flujo de subida de documento existente en `screenCreateSessionStart` no sufre ninguna regresión.

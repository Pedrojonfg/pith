# SPEC: `20260609-unified-session`

**Feature**: Sesión unificada cross-mode  
**Estado**: Draft  
**Prioridad**: Alta — desbloquea integración Slow→Cloze, agenda SM-2, y la mayoría de mejoras pedagógicas futuras  
**Rompe**: el schema actual de `sessionsByMode` en localStorage (requiere migración)  
**No toca**: la lógica interna de cada modo (sus pipelines, prompts, UI). Solo la capa de datos.

---

## El problema en una frase

Un documento es una unidad de estudio, pero la app lo trata como cuatro objetos independientes. Cuando cambias de modo, pierdes todo el contexto que construiste en el otro.

---

## Decisión de diseño central: un documento = una `DocumentSession`

Cada documento que subes genera una `DocumentSession` identificada por el hash de su markdown normalizado. Esta sesión tiene dos capas:

- **`shared`**: datos que cualquier modo puede leer y escribir — el texto, la jerarquía, los conceptos detectados, las anotaciones, los ítems SM-2.
- **`modes`**: slices privados de cada modo — `modes.rsvp`, `modes.slow`, `modes.cloze`, `modes.questions`. Cada slice contiene exactamente lo que contenía antes en `sessionsByMode[mode]`.

Los modos no se tocan entre sí directamente. Se comunican a través de `shared`. Esto es importante — no es que Cloze llame a funciones de Slow Mode, sino que Cloze lee `session.shared.annotations` y `session.shared.conceptInventory` que Slow Mode escribió.

### ¿Por qué no un único grafo compartido?

Los grafos de RSVP y Cloze tienen schemas incompatibles (nodos `block:` vs nodos epistémicos puros). Forzarlos al mismo schema sería un refactor enorme con beneficio marginal. En cambio, lo que sí tiene sentido compartir son los **inputs** que alimentan esos grafos: el inventario de conceptos y las anotaciones del usuario. Cada modo construye su grafo, pero lo hace con más contexto.

---

## Schema completo

### `DocumentSession`

```js
{
  docId: string,            // hash del rawMarkdown normalizado (SHA-1 truncado a 12 chars)
  schemaVersion: 2,         // para detectar sesiones antiguas
  createdAt: number,        // timestamp ms
  updatedAt: number,

  shared: SharedLayer,
  modes: {
    rsvp:      RsvpSession      | null,
    slow:      SlowSession      | null,
    cloze:     ClozeSession     | null,
    questions: QuestionsSession | null,
  }
}
```

### `SharedLayer`

```js
{
  rawMarkdown: string,           // texto normalizado canónico (única copia)

  docMeta: {
    titleInferred: string,       // inferido del contenido en normalización
    charCount: number,
    language: 'es' | 'en' | 'other',
    estimatedGenre: 'philosophical' | 'scientific' | 'essay' | 'notes' | 'unknown',
  },

  docHierarchy: HierarchyNode[] | null,   // del spec 20260609-doc-hierarchy-index

  conceptInventory: ConceptEntry[],
  // Conceptos detectados por cualquier modo. Se deduplican por `canonicalId`.
  // Formato:
  // { canonicalId, label, definition, detectedBy: 'rsvp'|'slow'|'cloze', importance }

  annotations: Annotation[],
  // Anotaciones del usuario en Slow Mode.
  // { id, type: '★'|'⊘'|'↯'|'⚠'|'⇑'|'⟷', text, offset, sectionTitle, createdAt }

  smItems: SmItem[],
  // Todos los ítems SM-2 de todos los modos, en un solo pool.
  // { id, sourceMode: 'cloze'|'rsvp', question, answer, distractors,
  //   easeFactor, interval, nextReview, reviewCount }
}
```

### Slices por modo

Los slices son exactamente los objetos que antes vivían en `sessionsByMode[mode]`. **No se cambia su estructura interna.** Solo se mueven de lugar:

```
ANTES: localStorage['sessionsByMode'].rsvp     → AHORA: DocumentSession.modes.rsvp
ANTES: localStorage['sessionsByMode'].slow     → AHORA: DocumentSession.modes.slow
ANTES: localStorage['sessionsByMode'].cloze    → AHORA: DocumentSession.modes.cloze
ANTES: localStorage['sessionsByMode'].questions → AHORA: DocumentSession.modes.questions
```

Excepción: los campos que ahora viven en `shared` se eliminan de los slices para no duplicarlos:
- `modes.cloze.epistemicGraph` ya no incluye `conceptInventory` — ese dato vive en `shared.conceptInventory`
- `modes.slow.annotations` se mueve a `shared.annotations`
- `modes.rsvp.rawText` / `modes.slow.rawText` se elimina — vive en `shared.rawMarkdown`

### Almacenamiento en localStorage

```
localStorage['mylearning_doc_sessions'] = DocumentSession[]   // array de todas las sesiones
localStorage['mylearning_active_doc_id'] = string | null      // docId del documento activo
```

Tamaño: una sesión típica (paper de 40 páginas) ocupa ~150-400KB. Con 20 documentos, ~4-8MB — cerca del límite de localStorage. Esto es deuda conocida; la solución futura es IndexedDB, pero no está en este spec.

Mitigación temporal: si la sesión supera 400KB, no guardar `rawMarkdown` en `shared` — guardarlo en una clave separada `mylearning_doc_text_{docId}` y referenciarlo. El documento en sí es la parte más pesada.

---

## Comportamiento nuevo que esto desbloquea

### A — Cloze importa el trabajo de Slow Mode

Cuando el usuario entra a Cloze en un documento donde ya hizo Slow Mode:

```
SI session.modes.slow existe Y session.modes.slow.graphEnrichedUnlocked == true:
  → pipeline cloze salta la fase 0 (grafo epistémico)
  → usa session.shared.conceptInventory como base de nodos
  → usa session.shared.annotations como contexto adicional para los ítems
  → solo ejecuta fases 2-4 (ítems NODE/EDGE, distractores, QA)
  → ahorra ~2 llamadas LLM, mejora calidad porque los conceptos ya están validados por el usuario
```

Si no hay Slow Mode previo, el pipeline cloze funciona exactamente igual que ahora.

### B — Pool SM-2 unificado

Los ítems cloze, los ítems de RSVP, y cualquier flashcard futura van todos a `shared.smItems`. La pantalla de revisión (spec pendiente) puede hacer una query simple sobre este array para encontrar los ítems con `nextReview <= Date.now()`, sin importar de qué modo vinieron.

### C — Pantalla de documentos estudiados

Con `DocumentSession[]` en un solo lugar, trivial mostrar una lista de documentos con:
- Título inferido
- Modos completados (iconos)
- Última actividad
- Ítems SM-2 pendientes hoy

Esto no existe ahora. Es el MVP de "memoria del estudiante".

---

## Módulos nuevos

### `src/js/session-store.js`

Capa de acceso a datos. Todos los módulos usan esto en lugar de llamar a `localStorage` directamente.

```js
// Leer/escribir sesión activa
export function getActiveSession()                    // → DocumentSession | null
export function setActiveSession(docId)               // activa una sesión por docId
export function saveActiveSession(session)            // persiste en localStorage

// CRUD de sesiones
export function createSession(rawMarkdown)            // → DocumentSession nueva
export function getSession(docId)                     // → DocumentSession | null
export function getAllSessions()                       // → DocumentSession[] ordenadas por updatedAt
export function deleteSession(docId)                  // borra todo — anotaciones, ítems SM-2, todo

// Helpers de shared layer
export function addConceptsToShared(docId, concepts)  // merge con deduplicación
export function addAnnotationToShared(docId, ann)
export function upsertSmItem(docId, item)             // crea o actualiza por item.id
export function getSmItemsDueToday(docId?)            // sin docId → todos los documentos
```

### `src/js/session-migration.js`

Corre una vez al boot si detecta el formato V1.

```js
export function detectAndMigrateV1()
// Detecta: ¿existe localStorage['sessionsByMode']?
// Si sí:
//   1. Leer los 4 slots (rsvp, slow, cloze, questions)
//   2. Inferir rawMarkdown: buscar en los slots en orden slow > rsvp > cloze > questions
//   3. Calcular docId desde rawMarkdown (o generar uno temporal si no hay texto)
//   4. Construir DocumentSession con schemaVersion: 2
//   5. Mover annotations de slow → shared.annotations
//   6. Mover conceptos detectados → shared.conceptInventory (best effort)
//   7. Guardar en 'mylearning_doc_sessions'
//   8. Guardar backup de los datos originales en 'mylearning_v1_backup' (no borrar todavía)
//   9. Borrar 'sessionsByMode' solo después de verificar que la migración fue limpia
```

La migración es **no destructiva hasta el paso 9**. Si algo falla, los datos V1 siguen intactos en `mylearning_v1_backup`. El backup se borra solo cuando el usuario lleva 7 días sin problemas (o manualmente desde settings).

---

## Módulos modificados

### `src/js/session.js` → deprecado

`session.js` pasa a ser un wrapper thin que delega en `session-store.js`. Internamente sus consumidores no notan diferencia en la primera iteración — siguen llamando `getSession()`, `saveSession()` — pero ahora esas funciones usan el nuevo schema.

Esto permite migrar los modos de forma incremental (T05-T08) sin romper todo a la vez.

### `src/js/study.js`

Cambio principal: al cargar un documento, en lugar de leer `sessionsByMode[currentMode]`, llama a `getActiveSession()` y pasa el slice correcto al modo activo.

Cambio secundario: al cambiar de modo, no "limpiar" la sesión actual — solo cambiar qué slice se activa.

### `src/js/graph/adapters.js`

`buildSessionGraph()` recibe ahora `session.shared` además del slice de modo. Los builders pueden usar `session.shared.annotations` y `session.shared.conceptInventory` como inputs adicionales.

Concreto: `buildClozeEpistemicGraph` puede inicializar sus nodos desde `shared.conceptInventory` si existe, en lugar de empezar desde cero.

### `src/js/cloze/pipeline.js`

Añadir fase 0 condicional:

```js
// Al inicio del pipeline:
if (session.modes.slow?.graphEnrichedUnlocked) {
  // Importar conceptos y anotaciones de shared, saltar fase 0 LLM
  phase = 1
} else {
  // Flujo actual completo desde fase 0
  phase = 0
}
```

### `src/js/slow/phase1.js` (o donde se guardan anotaciones)

Al guardar una anotación, escribirla en dos sitios:
- `session.modes.slow.annotations` (para compatibilidad interna del Slow Mode)
- `session.shared.annotations` (para que otros modos la lean)

En la próxima iteración se puede eliminar la copia en `modes.slow` y leer siempre de `shared`.

---

## ROADMAP

### T01 — Schema y tipos (`session-store.js` esqueleto)

Definir los tipos `DocumentSession`, `SharedLayer`, `ConceptEntry`, `Annotation`, `SmItem` en un fichero de tipos o JSDoc.

Implementar las funciones de CRUD básicas: `createSession`, `getSession`, `saveActiveSession`, `getAllSessions`.

Incluir `validateDocumentSession(session)` — comprueba que el schema es correcto antes de guardar. Invaluable para detectar bugs de migración.

**Criterio de done**: tests unitarios de CRUD pasando. `createSession(text)` devuelve una `DocumentSession` válida. `getSession(docId)` devuelve null para docId inexistente, la sesión correcta si existe.

---

### T02 — Migración V1→V2 (`session-migration.js`)

Implementar `detectAndMigrateV1()`. Casos a cubrir:
- Solo hay sesión `slow` → migrar a `modes.slow`, `shared.rawMarkdown`, `shared.annotations`
- Solo hay sesión `cloze` → migrar a `modes.cloze`, `shared.conceptInventory`
- Hay varias sesiones de modos distintos → ¿son del mismo documento? Asumir que sí (en V1 solo había un documento activo a la vez)
- `sessionsByMode` existe pero está vacío o corrupto → crear sesión vacía, no fallar

**Criterio de done**: dado un `localStorage` V1 con sesión slow completa, `detectAndMigrateV1()` produce una `DocumentSession` V2 válida con `shared.annotations` correctas y `modes.slow` intacto.

---

### T03 — `session.js` como wrapper thin

Modificar `session.js` para que sus funciones públicas deleguen en `session-store.js`. La interfaz externa no cambia — los modos siguen llamando `getSession()`, `saveSession()`.

Añadir `detectAndMigrateV1()` en el boot de `main.js`, antes de cualquier otra inicialización.

**Criterio de done**: la app arranca sin errores con datos V1. La migración corre una vez y no vuelve a correr.

---

### T04 — `study.js` usa DocumentSession

Modificar el orquestador para:
1. Al subir documento: `createSession(rawMarkdown)`, establecer como sesión activa
2. Al cambiar de modo: no borrar sesión, solo cambiar slice activo
3. Al cargar documento ya estudiado (mismo hash): recuperar `DocumentSession` existente

**Criterio de done**: subir un paper, estudiar en RSVP, cambiar a Slow Mode — los datos de RSVP siguen ahí al volver.

---

### T05 — Slow Mode escribe en `shared`

Modificar el guardado de anotaciones para escribir también en `shared.annotations`.  
Modificar la Fase 0 para escribir `conceptsFound` en `shared.conceptInventory`.

**Criterio de done**: después de terminar Fase 0 de Slow Mode, `session.shared.conceptInventory` tiene los conceptos detectados.

---

### T06 — Cloze lee de `shared`

Modificar `pipeline.js`:
- Si `shared.conceptInventory` tiene ≥ 5 conceptos (indica que Slow Mode ya procesó el documento): saltar fase 0, importar conceptos
- Si `shared.annotations` tiene anotaciones: incluirlas como contexto en el prompt de generación de ítems
- Escribir ítems generados en `shared.smItems` además de en `modes.cloze`

**Criterio de done**: dado un documento con Slow Mode completado, el pipeline cloze no hace la llamada LLM de fase 0 y los ítems generados referencian conceptos del inventario compartido.

---

### T07 — `adapters.js` recibe `shared`

Modificar `buildSessionGraph()` para aceptar `shared` como parámetro opcional. Actualizar `buildClozeEpistemicGraph` para inicializar nodos desde `shared.conceptInventory` si existe.

**Criterio de done**: grafo cloze generado tras Slow Mode tiene nodos de concepto que coinciden con los del inventario compartido (mismo `canonicalId`).

---

### T08 — Pantalla de documentos estudiados (opcional en este ciclo)

Lista simple de `getAllSessions()` con título inferido, modos completados, y conteo de ítems SM-2 pendientes. Enlace para reabrir cada documento.

No es obligatoria para que el resto funcione, pero da visibilidad inmediata al valor del refactor.

**Criterio de done**: la pantalla lista correctamente 3 documentos de prueba con sus metadatos.

---

### T09 — Tests de integración

- Flujo completo: subir doc → Slow Mode hasta Fase 3 → abrir Cloze → pipeline salta fase 0
- Migración V1: localStorage con datos V1 → V2 correcta → app funciona sin diferencia visible
- Deduplicación: mismos conceptos detectados por RSVP y Cloze → una sola entrada en `shared.conceptInventory`
- SM-2 pool: ítems de RSVP y Cloze del mismo documento → aparecen en `getSmItemsDueToday()`
- Tamaño: sesión de documento de 50k chars → comprueba que no supera límite de 400KB (si supera, aplicar la mitigación de clave separada para rawMarkdown)

---

## Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Migración corrompe datos V1 | Media | Alto | Backup en `mylearning_v1_backup` antes de borrar nada |
| localStorage se llena con rawMarkdown × N documentos | Alta | Medio | Guardar rawMarkdown en clave separada, referenciarlo por docId |
| `conceptInventory` duplicado (mismo concepto, label distinto) | Alta | Bajo | Deduplicar por `canonicalId` calculado como hash del label normalizado (lowercase, sin stopwords) |
| Slow Mode y Cloze escriben en `shared.annotations` concurrentemente | Baja | Bajo | No hay concurrencia real (una pestaña, un modo activo a la vez) |
| Modos asumen que su slice es la única fuente de verdad | Alta | Medio | Refactor incremental (T05-T07): primero escribir en shared sin leer de él, luego leer |

---

## Lo que NO cambia en este spec

- El schema interno de cada slice de modo (`RsvpSession`, `SlowSession`, etc.)
- Los prompts LLM de ningún modo
- La UI de ningún modo
- El sistema de grafos (solo los adapters)
- El Service Worker / offline

---

## Orden de implementación recomendado si el tiempo es limitado

**MVP mínimo útil** (T01 + T02 + T03 + T04): la app no pierde datos al cambiar de modo. No hay integración todavía, pero ya no hay silos destructivos.

**Integración real** (+ T05 + T06): el pipeline Slow→Cloze funciona. Esto es donde el usuario nota la diferencia pedagógica.

**Pulido** (T07 + T08 + T09): grafos coherentes, pantalla de documentos, tests.

---

## Criterio global de done

Dado el mismo paper filosófico, estudiado en secuencia:
1. Slow Mode hasta Fase 3 → `shared.annotations` y `shared.conceptInventory` tienen datos
2. Abrir Cloze en el mismo documento → el pipeline no llama al LLM en fase 0, los ítems generados son más precisos y referencian conceptos del Slow Mode
3. Los ítems cloze aparecen en `shared.smItems`
4. Abrir RSVP en el mismo documento → los datos de Slow y Cloze siguen intactos
5. Cerrar navegador, reabrir → todo persiste correctamente
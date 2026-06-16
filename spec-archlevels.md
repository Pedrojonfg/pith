# Study Projects — Organizational Hierarchy

**Spec:** `20260614-study-projects`
**Estado:** Ready to implement
**Dependencias:** `20260609-unified-session`, `20260613-knowledge-vault-a-plus`, `20260612-mode-continuity`

---

## 1. Qué es y por qué

Hoy la app tiene dos niveles: **documento** (una `DocumentSession` con sus 5 modos) y **vault** (conocimiento cross-documento, sin estructura interna salvo `docTopics` difusos generados por LLM).

Esto se queda corto en tres frentes:

1. **Orden temporal**: si estudias "Tema 1" de una asignatura en mayo y "Tema 3" en septiembre, no hay nada que los agrupe salvo buscarlos en una lista plana de documentos.
2. **Filtrado de review**: no se puede repasar "solo lo de Álgebra" — el review opera sobre todo el vault o nada.
3. **Scaffolding (GKV)**: al generar bloques en RSVP, el contexto del vault se inyecta sin priorización — todo pesa igual, cuando en la práctica lo más relevante es lo que pertenece al mismo tema que se está estudiando ahora.

Este spec introduce **`Project`**: una entidad jerárquica, definida por el usuario, que agrupa `DocumentSession`s. Toda sesión pertenece a exactamente un proyecto (por defecto, `misc`).

**Lo que NO es este spec**: no toca `docTopics` (sigue existiendo igual, sirve para otra cosa — ver §2.4), no reemplaza el modelo de mastery del GKV, no introduce membresía múltiple (un documento = un proyecto, no tags).

---

## 2. Data model

### 2.1 `Project`

```typescript
interface Project {
  id: string;            // UUID, o 'misc' para el especial
  name: string;
  parentId: string | null;  // null = nivel raíz
  color?: string;            // opcional, swatch para UI
  createdAt: number;
  updatedAt: number;
}
```

Árbol simple: cada `Project` tiene como máximo un padre. Sin profundidad máxima impuesta por el data model.

### 2.2 `ProjectStore`

```typescript
interface ProjectStore {
  schemaVersion: 1;
  projects: Project[];
}
```

Persistencia: `localStorage['mylearning_projects']`.

**Proyecto especial `misc`**: se crea en el boot si no existe.

```typescript
const MISC_PROJECT: Project = {
  id: 'misc',
  name: 'Misc',
  parentId: null,
  createdAt: <boot time>,
  updatedAt: <boot time>,
};
```

`misc` se puede renombrar, pero no eliminar ni reparentar (ver §3.3).

### 2.3 Cambio en `DocumentSession`

Nuevo campo **a nivel raíz** (no en `shared`, porque no es contenido pedagógico del documento sino metadato de organización — igual que `docId`):

```typescript
interface DocumentSession {
  schemaVersion: 2;
  docId: string;
  projectId: string;   // NUEVO. Siempre presente, default 'misc'.
  shared: { ... };
  modes: { ... };
}
```

No requiere bump de `schemaVersion` (sigue siendo 2): es un campo adicional con migración de backfill, igual que se hizo con `docTopics`.

### 2.4 Relación con `docTopics`

`shared.docTopics` (LLM, 2–5 tags, fuzzy) **no cambia**. Sigue usándose para acotar el espacio de búsqueda en `normalizeConceptsToVault()`.

`projectId` es ortogonal: definido por el usuario, jerárquico, 1:1 por documento. Se usa para:
- Organización en Library (§7)
- Filtrado de Review (§6)
- Priorización (no exclusión) de contexto del vault en GKV (§5)

Las dos señales no se fusionan. Un documento puede tener `projectId: 'algebra-2'` y `docTopics: ['Calculus', 'Linear Algebra']` simultáneamente, y ambas se usan para cosas distintas.

---

## 3. `project-store.js` — helpers de jerarquía

Módulo nuevo. Todas las funciones son puras sobre `ProjectStore` + lista de `DocumentSession` (sin LLM).

### 3.1 Lectura

```javascript
getProject(id: string): Project | null

// [self, parent, grandparent, ..., root]. self siempre incluido.
getAncestorChain(id: string): Project[]

// IDs de todos los descendientes (recursivo). includeSelf opcional.
getDescendantIds(id: string, opts?: { includeSelf?: boolean }): string[]

// Hijos directos
getChildren(id: string): Project[]

// Para Library: árbol completo o subárbol desde una raíz
getProjectTree(rootId?: string | null): ProjectTreeNode[]

getSessionsByProject(projectId: string, opts?: { includeDescendants?: boolean }): DocumentSession[]
```

### 3.2 Mutaciones

```javascript
createProject(name: string, parentId: string | null): Project
renameProject(id: string, newName: string): void
moveProject(id: string, newParentId: string | null): void  // reparent
deleteProject(id: string): void
assignSessionToProject(docId: string, projectId: string): void
```

### 3.3 Casos límite

- **`misc` es intocable**: `deleteProject('misc')` y `moveProject('misc', ...)` son no-ops (o lanzan error silencioso). Sí se puede `renameProject('misc', ...)`.
- **Ciclos en `moveProject`**: antes de reparentar, comprobar que `newParentId` no esté en `getDescendantIds(id)`. Si lo está, rechazar (UI muestra error "Cannot move a project into its own subproject").
- **`deleteProject` con contenido**: se bloquea si `getDescendantIds(id, {includeSelf:false}).length > 0` o si tiene sesiones asignadas. El usuario debe mover sesiones/subproyectos antes de borrar. (Más simple que reasignación en cascada, y evita sorpresas — para uso personal con pocos proyectos esto no es fricción real.)

---

## 4. Migración

Paso nuevo en `session-migration.js`, ejecutado en el boot junto a la migración V1→V2 existente:

```javascript
function migrateProjects(store) {
  if (!projectStoreExists()) {
    saveProjectStore({ schemaVersion: 1, projects: [MISC_PROJECT] });
  }
  for (const session of store.sessions) {
    if (!session.projectId) {
      session.projectId = 'misc';
    }
  }
}
```

Idempotente: si se ejecuta sobre datos ya migrados, no hace nada.

---

## 5. Integración con GKV (scaffolding)

### 5.1 Prioridad por cadena de ancestros (no MRO completo)

`Project` es un árbol (un padre por nodo), no hay herencia múltiple — así que basta con la cadena de ancestros, sin necesidad de linearización tipo MRO.

```javascript
// 0 = mismo proyecto, 1 = proyecto padre, ..., Infinity = sin relación
function getProjectScopeDepth(entry, ancestorIds) {
  const entryProjectIds = new Set(
    entry.sources
      .map(s => getSession(s.docId)?.projectId)
      .filter(Boolean)
  );
  for (let depth = 0; depth < ancestorIds.length; depth++) {
    if (entryProjectIds.has(ancestorIds[depth])) return depth;
  }
  return Infinity;
}
```

### 5.2 `getVaultContextForDoc` actualizado

Antes: `getVaultContextForDoc(docTopics): VaultEntry[]`
Ahora: recibe la sesión completa (necesita `projectId` además de `docTopics`).

```javascript
function getVaultContextForDoc(session) {
  const ancestorChain = getAncestorChain(session.projectId);
  const ancestorIds = ancestorChain.map(p => p.id);

  // El matching por topic NO cambia respecto a A+
  const topicMatches = getExistingEntriesByTopic(session.shared.docTopics);

  return topicMatches
    .map(entry => ({ entry, scopeDepth: getProjectScopeDepth(entry, ancestorIds) }))
    .sort((a, b) => a.scopeDepth - b.scopeDepth);
}
```

Esto **no excluye nada** — un concepto de economía sigue apareciendo aunque estés en el proyecto "Álgebra". Solo cambia el orden y, opcionalmente, la etiqueta.

### 5.3 `buildVaultContextBlock` actualizado

Se agrupa por `scopeDepth` en tres bandas para el prompt. La clasificación interna (mastered/partial/unstable) sigue exactamente igual que en A+; lo único nuevo es el agrupado por relevancia de proyecto.

```javascript
function buildVaultContextBlock(scoredEntries) {
  const sameSubject    = scoredEntries.filter(e => e.scopeDepth === 0);
  const relatedSubject = scoredEntries.filter(e => e.scopeDepth > 0 && e.scopeDepth < Infinity);
  const general        = scoredEntries.filter(e => e.scopeDepth === Infinity);

  const fmt = list => list.map(({ entry }) => describeEntry(entry)).join(', ') || 'none';

  return `
GLOBAL KNOWLEDGE CONTEXT (from user's cross-document study history):

Same-subject mastery (calibrate depth on these first):
${fmt(sameSubject)}

Related-subject mastery (background, lower priority):
${fmt(relatedSubject)}

General mastery (other subjects, awareness only):
${fmt(general)}
  `.trim();
}
```

`describeEntry()` reutiliza tal cual la lógica de A+ (mastered/partial/unstable prereqs).

**Truncado por presupuesto de tokens**: si hace falta recortar, se descarta primero `general`, luego `relatedSubject`. `sameSubject` nunca se recorta.

### 5.4 (Opcional, P2) Ampliar el search space de normalización

`getExistingEntriesByTopic()` (usado en `normalizeConceptsToVault()`) puede ampliarse para incluir también entradas cuyas `sources` pertenezcan a la cadena de ancestros, aunque `docTopics` no haga match:

```javascript
function getExistingEntriesForNormalization(docTopics, ancestorIds) {
  return vault.entries.filter(entry =>
    topicMatches(entry.topic, docTopics) ||
    entry.sources.some(s => ancestorIds.includes(getSession(s.docId)?.projectId))
  );
}
```

No es necesario para v1 (el matching por topic ya funciona razonablemente según A+), pero es una mejora barata si en la práctica se detectan duplicados que `docTopics` no cazó dentro del mismo proyecto.

---

## 6. Review — filtrado por proyecto

```javascript
function getReviewableItemsForProject(projectId, opts = { includeDescendants: true }) {
  const scopeIds = opts.includeDescendants
    ? new Set([projectId, ...getDescendantIds(projectId)])
    : new Set([projectId]);

  return getAllSessions()
    .filter(session => scopeIds.has(session.projectId))
    .flatMap(session => session.shared.smItems || []);
}
```

`projectId === 'all'` (valor especial de UI, no un proyecto real) → se omite el filtro y se devuelve el pool unificado completo, comportamiento actual.

Una `KnowledgeVaultEntry` puede tener `sources` en proyectos distintos (p.ej. "regla de la cadena" en Álgebra y en Economía) — esto es correcto y no requiere cambios en el schema del vault: el filtrado es un join en tiempo de consulta a través de `sources[].docId → DocumentSession.projectId`, no una propiedad fija de la entrada.

---

## 7. UI

### 7.1 Library → project browser

`screenDocLibrary` se extiende a navegador de proyectos:

- Nivel raíz: lista de proyectos top-level (`parentId: null`, incluyendo `Misc`)
- Entrar en un proyecto: muestra sus subproyectos + documentos directamente asignados
- Acciones: "New Project" (en raíz), "New Subproject" (dentro de un proyecto), "Move to project…" (en cada documento)
- Click en documento → continuidad existente hacia `screenModeSelect` (mode hub), ahora con contexto de breadcrumb

### 7.2 Breadcrumb (componente nuevo en `ui.js`)

```javascript
renderBreadcrumb(path: BreadcrumbSegment[]): HTMLElement
// BreadcrumbSegment = { label: string, onClick?: () => void }
```

Genérico y recursivo — soporta cualquier profundidad de proyectos sin límite duro. Se monta en:
- `screenProjectLibrary`: `Library › [Project] › [Subproject...]`
- `screenModeSelect` y pantallas de modo: `[Project path] › [Document name] › [Mode]`
- `screenReviewConfig` / `screenReview*`: `Review › [scope label]`

### 7.3 `screenModeSelect` → home hub

Pasa a ser punto de entrada con tres acciones claras:
1. **Continue** — documento activo (comportamiento actual)
2. **Library** — abre el navegador de proyectos
3. **Review** — abre `screenReviewConfig` con scope picker

Cuando se entra a `screenModeSelect` *desde* Library (con un documento concreto), funciona como hoy: hub de los 5 modos para ese documento, con breadcrumb mostrando su proyecto.

### 7.4 Asignación de proyecto al subir (`screenPlaceholder`)

- Selector "Project" (árbol aplanado con indentación), pre-rellenado:
  - Si se llega desde dentro de un proyecto en Library → ese proyecto
  - Si se llega desde el home/hub general → `Misc`
- Nunca bloquea la subida; siempre hay un valor por defecto válido.

### 7.5 Reasignar proyecto de un documento existente

Acción "Move to project…" en la tarjeta/detalle del documento en Library → abre el mismo selector de árbol, llama a `assignSessionToProject(docId, newProjectId)`.

### 7.6 Review scope picker (`screenReviewConfig`)

Nuevo control "Scope":
- **"All subjects"** (default, = comportamiento actual)
- **Project picker** + checkbox **"Include subprojects"** (default: checked)

### 7.7 Strings UI (inglés) — referencia rápida

| Contexto | String |
|---|---|
| Entrada a Library | `Library` |
| Crear proyecto raíz | `New Project` |
| Crear subproyecto | `New Subproject` |
| Proyecto por defecto | `Misc` |
| Reasignar | `Move to project…` |
| Error de ciclo | `Cannot move a project into its own subproject` |
| Bloqueo de borrado | `Move subprojects and documents out before deleting` |
| Scope review — global | `All subjects` |
| Scope review — proyecto | `This subject` con toggle `Include subprojects` |
| Etiquetas de contexto GKV (prompt, no UI) | `Same-subject mastery`, `Related-subject mastery`, `General mastery` |

---

## 8. Fuera de alcance

- Membresía múltiple / tags (un documento = un proyecto, punto)
- Reordenación drag & drop (v1 usa selects/acciones simples)
- Sugerencia automática de proyecto a partir de `docTopics` (post-v1: "this looks like it belongs to Álgebra II, move it?")
- Reasignación en cascada al borrar un proyecto con contenido (se bloquea en su lugar)
- Resolución de relaciones de prerrequisito cross-proyecto más allá de lo que GKV A+ ya hace

---

## 9. Mapa de archivos

| Archivo | Cambio |
|---|---|
| `session-types.js` | Tipos `Project`, `ProjectStore`, campo `projectId` en `DocumentSession`, constante `MISC_PROJECT_ID` |
| `project-store.js` (nuevo) | CRUD + helpers de árbol (§3) |
| `session-migration.js` | Paso `migrateProjects()` (§4) |
| `session-store.js` | Persistencia de `mylearning_projects`, exposición de `getSessionsByProject` |
| Módulo del vault (A+) | `getVaultContextForDoc`, `buildVaultContextBlock`, opcionalmente `getExistingEntriesByTopic` (§5) |
| `review.js` | `getReviewableItemsForProject` (§6) |
| `index.html` | Renombrar/extender `screenDocLibrary` → project browser; contenedor de breadcrumb en pantallas relevantes; controles nuevos en `screenPlaceholder` y `screenReviewConfig` |
| `ui.js` | `renderBreadcrumb`, render de árbol de proyectos, selector de proyecto |
| `study.js` | Wiring: asignación de proyecto al subir, breadcrumb en `enterModeWithContinuity` |
| `sw.js` | Bump `SW_VERSION` |

---

## 10. Decisiones tomadas (a revisar si no convencen)

- **Borrado bloqueado, no en cascada**: simplifica mucho y para uso personal con pocos proyectos no es fricción real.
- **Sin límite de profundidad en UI**: el breadcrumb es genérico/recursivo; en la práctica se espera ~2 niveles, pero no hay nada que lo impida ni lo fuerce.
- **`projectId` a nivel raíz de `DocumentSession`**, no dentro de `shared` — es metadato de organización, no contenido pedagógico.
- **`docTopics` intacto** — las dos señales (topic LLM vs. project del usuario) son complementarias, no se fusionan.
- **Prioridad GKV es agrupado + orden, nunca exclusión** — el principio "todo el vault se chequea, pero lo del mismo proyecto va primero" se preserva literalmente.

# Data Model: Grafo Académico — Género Textual y Tipado Filosófico

**Feature**: `20260530-graph-academic-genre` | **Extends**: `specs/20260528-slow-mode/data-model.md`

## Phase0Orientation (extended)

| Field | Type | Notes |
|-------|------|-------|
| `textGenre` | `TextGenre` | **NEW** — default `ARGUMENTO_LINEAL` si ausente |
| `thesis` | `string` | Sin cambio |
| `argumentMap` | `ArgumentMapNode[]` | Nodos con campos opcionales por género |
| `conceptsToFind` | `ConceptToFind[]` | 3–5; con `nodeType` y `includes` opcional |
| `guideQuestion` | `string` | Sin cambio |
| `criticalExaminePoints` | `string[]` | Sin cambio |
| `fillableBlanks` | `FillableMapEntry[]` | Sin cambio |

## TextGenre

```ts
type TextGenre =
  | "ARGUMENTO_LINEAL"
  | "GENEALOGÍA"
  | "DEBATE"
  | "DEFINICIÓN"
  | "ANÁLISIS_DE_CASO";
```

**Validation**: Si valor desconocido → coerce a `ARGUMENTO_LINEAL` + `console.warn`.

## TextNodeSubtype

```ts
type TextNodeSubtype =
  | "CONCEPTO"
  | "PERSONA"
  | "OBRA"
  | "MOVIMIENTO"
  | "EVENTO";
```

**Default**: `CONCEPTO` si ausente.

## ConceptToFind (extended)

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `term` | `string` | yes | Etiqueta visible; puede incluir prefijo `[TIPO]` del prompt |
| `authorUsage` | `string` | yes | Cómo el autor usa el término |
| `nodeType` | `TextNodeSubtype` | no | Normalizado desde prompt |
| `includes` | `string[]` | no | Elementos agrupados en cluster deduplicado |
| `graphTermId` | `string` | no | Slug estable para grafo |

**Prompt rule**: Nunca `nodeType: PERSONA` para el autor del texto analizado.

## ArgumentMapNode (extended)

| Field | Type | When | Notes |
|-------|------|------|-------|
| `id` | `string` | always | P1, P2, C, G1, D1, etc. |
| `text` | `string` | always | Contenido del nodo |
| `status` | `string` | optional | argued / taken for granted |
| `period` | `string` | GENEALOGÍA | ej. "siglo XVIII", "post-IIGM" |
| `author` | `string` | DEBATE | Autor de la posición |
| `linkType` | `string` | optional | nexo sugerido entre nodos |

## GraphNode (canvas, extended metadata)

Capa `text` nodes gain optional fields:

| Field | Type | Notes |
|-------|------|-------|
| `nodeSubtype` | `TextNodeSubtype` | Copiado de `conceptsToFind` |
| `includes` | `string[]` | Para tooltip/lista |

**Label format**: `[CONCEPTO] Bildung` o derivado de `term` si ya incluye corchetes.

## GraphEdge.type (extended)

**Existing**: `requires`, `covers`, `mentions`, `sequence`, `relates`, `supports`, `contradicts`, `refuta`, `cuestiona`, `instantiates`

**New**:

| Type | From → To (preferred) | Family |
|------|----------------------|--------|
| `historically_precedes` | arg/map node → arg/map node | didactic |
| `reinterprets` | PERSONA/MOVIMIENTO → CONCEPTO | semantic |
| `constitutes` | any → CONCEPTO central | semantic |
| `contrasts_with` | CONCEPTO ↔ CONCEPTO | argumentative |
| `influences` | any → any | semantic |

## Edge directionality rules (build-time)

```text
reinterprets:  allowed if from.nodeSubtype ∈ {PERSONA, MOVIMIENTO} AND to.nodeSubtype === CONCEPTO
defines:       NOT emitted from CONCEPTO → PERSONA (blocked)
instantiates:  OBRA/EVENTO → CONCEPTO or arg node
```

Invalid edges: log `console.warn`, skip edge (no throw).

## pruneOrphanNodes contract

```js
function pruneOrphanNodes(graph) → graph
```

- `connectedIds` = all `from`/`to` in edges
- Keep node if `connectedIds.has(id)` OR `layer === 'user'`
- Warn if `pruned.length < graph.nodes.length`

## State transitions

Sin cambio en fases Slow. `textGenre` se fija en Phase 0 generation y persiste en sesión.

## Migration

| Legacy field | Default |
|--------------|---------|
| missing `textGenre` | `ARGUMENTO_LINEAL` |
| missing `nodeType` | `CONCEPTO` |
| missing `includes` | `undefined` |
| missing `period`/`author` | `undefined` |

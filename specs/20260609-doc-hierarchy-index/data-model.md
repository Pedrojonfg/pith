# Data Model: Document Hierarchy Pre-Index

**Feature**: `20260609-doc-hierarchy-index`

## HierarchyNode

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | `string` | yes | Título de sección (inferido o de heading) |
| `level` | `1..3` | yes | Profundidad (1=sección principal) |
| `startOffset` | `number` | yes | Inclusive, char index en markdown canónico |
| `endOffset` | `number` | yes | Exclusive, char index |
| `summary` | `string` | no | 1 frase ≤15 palabras; solo si doc ≥8000 chars |
| `children` | `HierarchyNode[]` | yes | Subsecciones (puede ser `[]`) |

**Invariants**:
- `0 <= startOffset < endOffset <= textLength`
- Hermanos: rangos contiguos sin solapamiento (`endOffset[i] === startOffset[i+1]`)
- Primer raíz: `startOffset === 0`
- Último raíz: `endOffset === textLength` (±1 tolerancia trim)

**Derived**: `text = markdown.slice(startOffset, endOffset)`

## DocHierarchy

Persistido en `session.docHierarchy` (nullable).

| Field | Type | Description |
|-------|------|-------------|
| `generatedAt` | `number` | `Date.now()` al generar |
| `method` | `'llm' \| 'deterministic' \| 'trivial'` | Modo usado |
| `textHash` | `string` | Hash del markdown fuente |
| `tree` | `HierarchyNode[]` | Raíces del árbol |

**Default**: `null` (sesiones legacy o sin API key)

## HierarchyChunk

Salida de `getChunksFromHierarchy(tree, maxChunkSize)`.

| Field | Type | Description |
|-------|------|-------------|
| `title` | `string` | Título o fusión de títulos |
| `text` | `string` | Substring del markdown |
| `startOffset` | `number` | Inicio en markdown completo |
| `endOffset` | `number` | Fin en markdown completo |

**Validation**: Chunks contiguos, sin solapamiento, cubren `[0, textLength)`

## HierarchyCacheEntry

En `localStorage['mylearning_hierarchy_{textHash}']`.

| Field | Type | Description |
|-------|------|-------------|
| `tree` | `HierarchyNode[]` | Árbol cacheado |
| `method` | `string` | Método original |
| `cachedAt` | `number` | Timestamp para TTL 7 días |

**Eviction**: LRU, máximo 20 entradas; índice en `mylearning_hierarchy_index`

## Session extension

```js
// session.js — default null
docHierarchy: null
```

## Mode selection state machine

```text
normalize → markdown
  ├─ has #/## headings → deterministic (sync)
  ├─ length < 3000 → trivial (sync)
  ├─ length ≥ 3000, no headings, no API key → null (fallbacks)
  └─ length ≥ 3000, no headings, API key
       ├─ cache hit → llm (from cache, no network)
       └─ cache miss → llm call → validate → ok | fallback deterministic
```

## Relationships

```text
normalizedTextFull (markdown)
    └── docHierarchy.tree (offsets reference this string)
            ├── flattenHierarchy → ScopeOption[] (headings.js)
            ├── sectionBoundaries → pagination snap (pagination.js)
            └── getChunksFromHierarchy → Phase 0 chunks (phase0.js)
```

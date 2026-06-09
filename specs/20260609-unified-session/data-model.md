# Data Model: Unified Cross-Mode Session

**Feature**: `20260609-unified-session`

## DocumentSession

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `docId` | `string` | yes | SHA-1 truncado (12 hex) del markdown normalizado |
| `schemaVersion` | `2` | yes | Detecta sesiones legacy |
| `createdAt` | `number` | yes | ms timestamp |
| `updatedAt` | `number` | yes | ms timestamp |
| `shared` | `SharedLayer` | yes | Capa cross-mode |
| `modes` | `ModeSlices` | yes | Slices por modo (nullable cada uno) |

**Storage**: `localStorage['mylearning_doc_sessions']` — array ordenado por `updatedAt` desc en `getAllSessions()`.

**Active pointer**: `localStorage['mylearning_active_doc_id']` → `docId`.

## SharedLayer

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rawMarkdown` | `string` | cond | Texto canónico único (omitido si externalizado) |
| `rawMarkdownRef` | `{ storageKey, charCount }` | cond | Si texto > umbral en clave separada |
| `docMeta` | `DocMeta` | yes | Metadatos inferidos |
| `docHierarchy` | `DocHierarchy \| null` | yes | De feature doc-hierarchy-index |
| `conceptInventory` | `ConceptEntry[]` | yes | Default `[]` |
| `annotations` | `Annotation[]` | yes | Default `[]` |
| `smItems` | `SmItem[]` | yes | Default `[]` |

### DocMeta

| Field | Type | Values |
|-------|------|--------|
| `titleInferred` | `string` | Primer `#` heading o truncado primeras palabras |
| `charCount` | `number` | `rawMarkdown.length` |
| `language` | `string` | `'es' \| 'en' \| 'other'` |
| `estimatedGenre` | `string` | `'philosophical' \| 'scientific' \| 'essay' \| 'notes' \| 'unknown'` |

## ConceptEntry

| Field | Type | Description |
|-------|------|-------------|
| `canonicalId` | `string` | Hash del label normalizado |
| `label` | `string` | Etiqueta display |
| `definition` | `string` | Definición opcional |
| `detectedBy` | `string \| string[]` | `'rsvp' \| 'slow' \| 'cloze'` |
| `importance` | `number` | 0–1 opcional |

**Invariant**: `canonicalId` único en el array.

## Annotation

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID o estable |
| `type` | `string` | `'★' \| '⊘' \| '↯' \| '⚠' \| '⇑' \| '⟷'` |
| `text` | `string` | Texto seleccionado |
| `offset` | `number` | Offset en rawMarkdown |
| `sectionTitle` | `string` | Opcional |
| `createdAt` | `number` | ms |

## SmItem

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Globalmente único en el doc |
| `sourceMode` | `string` | `'cloze' \| 'rsvp' \| ...` |
| `question` | `string` | |
| `answer` | `string` | |
| `distractors` | `string[]` | Opcional |
| `easeFactor` | `number` | SM-2 |
| `interval` | `number` | días |
| `nextReview` | `number` | ms timestamp |
| `reviewCount` | `number` | |

## ModeSlices

```js
{
  rsvp: RsvpSession | null,
  slow: SlowSession | null,
  cloze: ClozeSession | null,
  questions: QuestionsSession | null,
}
```

**Rule**: Schema interno de cada slice **sin cambios** respecto a V1. Campos promovidos a `shared` se eliminan del slice en escritura nueva (no duplicar):

- `rawText` / `rawMarkdown` en slices → solo `shared.rawMarkdown`
- `slow.annotations` → `shared.annotations` (dual-write en T05)
- `conceptInventory` en cloze graph meta → `shared.conceptInventory`

## V1 backup (`mylearning_v1_backup`)

| Field | Type | Description |
|-------|------|-------------|
| `migratedAt` | `number` | Timestamp migración |
| `sessionsByMode` | `object` | Copia exacta de `sessions_by_mode` |
| `activeSession` | `object \| null` | Copia `active_session` si existía |

## State transitions

```text
Boot
  ├─ mylearning_doc_sessions exists (v2) → skip migration
  └─ sessions_by_mode exists
       ├─ detectAndMigrateV1 → backup → validate → store v2 → remove v1 key
       └─ fail → keep v1, log error

Upload new doc
  ├─ docId = hash(markdown)
  ├─ getSession(docId) hit → setActiveSession(docId)
  └─ miss → createSession(markdown) → setActiveSession

Mode switch
  └─ setActiveSession(same docId); read modes[mode] slice only
```

## Validation (`validateDocumentSession`)

- `schemaVersion === 2`
- `docId` non-empty string
- `shared` object; arrays son arrays
- `modes` tiene las 4 claves
- Si `rawMarkdownRef`, `storageKey` debe existir en localStorage o error recoverable

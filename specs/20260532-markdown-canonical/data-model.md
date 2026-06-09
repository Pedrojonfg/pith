# Data Model: Markdown Canonical Normalization

**Feature**: `20260532-markdown-canonical`

## NormalizationResult (v3)

Reemplaza bifurcación v1/v2.

| Field | Type | Description |
|-------|------|-------------|
| `normalized_format` | `"markdown"` | **Siempre** markdown en v3 |
| `normalized_content` | `string` | Markdown GFM-lite (headings, párrafos, listas) |
| `warnings` | `string[]` | Incluye códigos structure-inference + `html_structure_simplified` |
| `structure` | `object?` | Igual que v2 (`heading_count`, `confidence`, `artifacts_removed`) |

**Validation**:
- `normalized_format` MUST be `"markdown"` for new normalizations
- `normalized_content` MUST NOT match `/</` for HTML uploads (no tags residuales)

## Warning codes (añadidos)

| Code | When |
|------|------|
| `html_structure_simplified` | Tabla/lista/enlace no convertido fielmente a MD |

## LegacySessionCompat

Metadatos en sesión Slow/Cloze para migración.

| Field | Type | Description |
|-------|------|-------------|
| `normalizedFormat` | `"html_min" \| "markdown"` | Legacy puede ser `html_min` |
| `normalizedTextFull` | `string` | Contenido canónico del documento |
| `_migratedFromHtmlMin` | `boolean?` | true si se convirtió lazy al cargar |

## Pipeline state (sin cambio de TextBlock)

```text
extract*Blocks() → TextBlock[]
stripArtifacts()
inferHeadings()
emitMarkdown()          ← único emisor activo
→ NormalizationResult v3
```

## Relaciones

```text
normalizeStudyMaterial()
  → normalizeDocumentStructure({ format })
  → emitMarkdown(blocks, headings)   // también para format === "html"
  → { normalized_format: "markdown", ... }

loadSession / createSlowSession
  → migrateLegacyFormatIfNeeded(session)
  → parseHeadings(text, "markdown")
```

## State transitions (session format)

```text
legacy html_min (stored) → open session → migrate lazy → markdown in memory → save → markdown persisted
new upload (any v1 format) → markdown immediately
```

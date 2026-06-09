# Data Model: Structure Inference

**Feature**: `20260531-structure-inference`

## TextBlock

Unidad atómica tras extracción, antes de emisión.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identificador estable dentro del documento |
| `text` | `string` | Contenido del bloque (puede ser multilínea) |
| `fontSize` | `number` | Altura de fuente en unidades PDF/CSS (0 si desconocido) |
| `fontWeight` | `number \| "bold" \| "normal"` | Peso tipográfico |
| `bbox` | `{ x, y, width, height }?` | Caja en coordenadas de página (PDF/HTML) |
| `pageIndex` | `number` | 0-based; 0 para TXT/MD/HTML single-page |
| `lineIndex` | `number` | Orden dentro de la página |
| `source` | `"pdf" \| "html" \| "txt" \| "md"` | Formato de origen |
| `kind` | `"paragraph" \| "heading" \| "list-item" \| "artifact" \| "unknown"` | Clasificación intermedia |

**Validation**:
- `text` trim no vacío salvo artefactos marcados para eliminación
- `fontSize >= 0`

## HeadingCandidate

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Texto del encabezado sin markup |
| `level` | `1..6` | Nivel jerárquico |
| `score` | `number` | Confianza heurística 0–100 |
| `source` | `"outline" \| "font-size" \| "pattern" \| "html-tag" \| "html-inferred"` | Origen de la decisión |
| `blockId` | `string` | Referencia a `TextBlock.id` |
| `charStart` | `number` | Offset en salida normalizada |
| `charEnd` | `number` | Offset fin en salida normalizada |

**Validation**:
- `level` entero 1–6
- `label` longitud 1–200 chars
- Candidatos con mismo `charStart` se deduplican (gana mayor `score`; empate gana `outline`)

## ArtifactPattern

| Field | Type | Description |
|-------|------|-------------|
| `code` | `string` | Ej. `page_number`, `running_header`, `doi_footer` |
| `match` | `string` | Texto o regex que disparó |
| `pageIndex` | `number?` | Página donde se detectó |
| `reason` | `"zone" \| "repetition" \| "regex"` | Método de detección |

## StructureReport

Adjunto al resultado de `normalizeStudyMaterial` (vía `warnings` + metadatos internos opcionales).

| Field | Type | Description |
|-------|------|-------------|
| `headingCount` | `number` | Headings emitidos en salida |
| `bodyFontSize` | `number?` | Moda PDF/HTML |
| `confidence` | `"high" \| "medium" \| "low"` | Agregado |
| `artifactsRemoved` | `number` | Conteo de bloques/líneas eliminados |
| `warnings` | `string[]` | Códigos machine-readable |

**Confidence rules**:
- `high`: outline presente O ≥3 headings con score ≥50
- `medium`: 1–2 headings o todos score 35–49
- `low`: 0 headings en doc >5000 chars O solo patrones débiles

## NormalizationResult (extensión)

Compatible con contrato existente; campos adicionales opcionales:

```json
{
  "normalized_format": "html_min|markdown",
  "normalized_content": "...",
  "warnings": ["low_heading_confidence"],
  "structure": {
    "heading_count": 12,
    "confidence": "high",
    "artifacts_removed": 45
  }
}
```

`structure` es opcional en v1 para no romper consumidores; `warnings` es obligatorio (array, puede estar vacío).

## Relaciones

```text
normalizeStudyMaterial()
  → extract*Blocks() → TextBlock[]
  → stripArtifacts(blocks) → TextBlock[] (filtered)
  → inferHeadings(blocks) → HeadingCandidate[]
  → emitMarkdown|emitHtmlMin(blocks, headings) → string
  → StructureReport
```

## State transitions (HeadingCandidate)

```text
raw block → scored → accepted (score ≥ threshold)
                  → rejected
accepted → level assigned → hierarchy validated → emitted
                         → demoted (stacking fix)
                         → merged (multiline heading)
```

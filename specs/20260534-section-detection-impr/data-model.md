# Data Model: Section Detection Improvements

**Feature**: `20260534-section-detection-impr`

Extiende entidades de `20260531-structure-inference/data-model.md`.

## TextBlock (extensión)

| Field | Type | Description |
|-------|------|-------------|
| `isFrontMatter` | `boolean?` | `true` si `pageIndex <= frontMatterEnd` |
| `kind` | + `"artifact"` | FIX-05: ornamentos, all-caps aislados |

## FrontMatterRange

| Field | Type | Description |
|-------|------|-------------|
| `skipThroughPageIndex` | `number` | Inclusive 0-based; bloques con `pageIndex <=` valor se excluyen de inferencia |
| `source` | `"outline" \| "density-heuristic"` | Método de detección |
| `firstContentPage` | `number?` | Solo outline strategy |

**Validation**: `skipThroughPageIndex >= -1`; `-1` = sin front matter

## OutlineMatch (extensión HeadingCandidate)

| Field | Type | Description |
|-------|------|-------------|
| `source` | `"outline"` | Siempre cuando viene de bookmark |
| `outlineLevel` | `1..6` | Depth en árbol PDF outline |
| `matchScore` | `number` | 0–100 post-normalización |
| `matchMethod` | `"similarity" \| "prefix-fallback"` | Trazabilidad |

## OutlineCoverageReport

| Field | Type | Description |
|-------|------|-------------|
| `totalEntries` | `number` | Entradas en outline |
| `matchedEntries` | `number` | Matches aceptados |
| `coverage` | `number` | `matched / total` 0–1 |
| `shortCircuited` | `boolean` | `true` si coverage ≥ 0.8 y heurística omitida |

## ScopeOption (extensión)

| Field | Type | Description |
|-------|------|-------------|
| `label` | `string` | Título mostrado |
| `level` | `1..6` | Nivel heading |
| `parentLabel` | `string \| null` | FIX-08: L1 padre más cercano |
| `start` | `number` | charStart en normalizedTextFull |
| `end` | `number` | charEnd |
| `charCount` | `number` | `end - start` |
| `displaySize` | `string` | Ej. `~420k`, `~65 págs` |
| `hidden` | `boolean?` | FIX-09: remove override |

**Validation**: Opciones con `charCount < MIN_SCOPE_CHARS` no se emiten (excepto Full document)

## HeadingOverride

Persistido en `session.slow.headingOverrides`.

| Field | Type | Description |
|-------|------|-------------|
| `originalCharStart` | `number` | Clave estable del heading |
| `action` | `"rename" \| "remove" \| "split" \| "merge"` | Tipo de override |
| `newLabel` | `string?` | Para rename |
| `splitAt` | `number?` | Offset relativo a charStart para split |
| `mergeWithCharStart` | `number?` | Para merge con siguiente |

**Validation**: `splitAt > 0`; merge solo entre headings consecutivos en orden

## StructureReport (extensión)

| Field | Type | Description |
|-------|------|-------------|
| `warnings` | `string[]` | Incluye `low_heading_confidence` |
| `fallbackSections` | `ScopeOption[]?` | FIX-10: chunks ~5k cuando low confidence |
| `frontMatterEnd` | `number?` | Página inclusive skip |
| `outlineCoverage` | `OutlineCoverageReport?` | Metadatos post-match |

## Session.slow (campos nuevos)

```json
{
  "normalizedTextFull": "...",
  "headingOverrides": [],
  "scopePickerExpanded": { "Primera Parte": true }
}
```

## State transitions

```text
upload PDF
  → extract blocks
  → detectFrontMatter
  → stripArtifacts(frontMatterEnd)
  → matchOutlineToBlocks (normalized)
  → if coverage >= 0.8: outline-only headings
    else: scoreAllBlocks
  → emitMarkdown + dehyphenate
  → parseHeadings + applyOverrides
  → buildScopeOptions (MIN_SCOPE_CHARS, parentLabel)
  → renderSlowScopeScreen
```

## MIN_SCOPE_CHARS resolution

| Condition | Value |
|-----------|-------|
| Default (paper) | 200 |
| Book heuristic | 500 |
| User override (future) | `session.slow.minScopeChars` |

Book heuristic: `headings.length >= 10` OR `text.length > 200_000` OR outline tiene entradas level 2+.

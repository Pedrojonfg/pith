# Contract: Input Normalization v3 (Markdown Canonical)

## Purpose

Sustituir la bifurcación `html → html_min` / `otros → markdown` de v1 por **markdown único** para todos los formatos v1, manteniendo campos `warnings` y `structure` de v2.

## Breaking change (v1 → v3)

| v1 | v3 |
|----|-----|
| `html` → `normalized_format: "html_min"` | `html` → `normalized_format: "markdown"` |
| `pdf/txt/md` → `markdown` | sin cambio |

Consumidores que solo leen `normalized_content` como texto: **sin cambio funcional** (mejor legibilidad para HTML).

Consumidores que ramifican por `normalized_format === "html_min"`: **deben actualizar**.

## Response

```json
{
  "normalized_format": "markdown",
  "normalized_content": "# Capítulo 1\n\nPárrafo...",
  "warnings": [],
  "structure": {
    "heading_count": 3,
    "confidence": "high",
    "artifacts_removed": 12
  }
}
```

## Rules

1. `pdf`, `html`, `txt`, `md` → `normalized_format = "markdown"`.
2. HTML: extracción rica (`extract-html-blocks`) **antes** de emisión markdown.
3. `normalized_content` MUST NOT contain HTML tags for `detected_format === "html"` (salvo MD embebido en archivos `.md`).
4. Headings emitidos como `#`–`######` según `heading-detection.md`.
5. Warnings v2 se mantienen; añadir `html_structure_simplified` cuando aplique.
6. Sin LLM en normalización.
7. Formato no v1 → `unsupported_format` (sin cambio).

## Legacy compatibility (read path)

- Sesiones con `normalizedFormat: "html_min"` MUST seguir cargando hasta migración lazy.
- `parseHeadings(text, "html_min")` permanece para legacy; nuevas sesiones usan `"markdown"`.

## Acceptance mapping

- FR-001, FR-002, FR-009

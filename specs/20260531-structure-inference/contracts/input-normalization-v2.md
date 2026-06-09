# Contract: Input Normalization v2 (extends v1)

## Purpose

Extender `specs/20260527-zero-latency-blocks/contracts/input-normalization.md` con inferencia de estructura sin romper consumidores.

## Backward compatibility

- `normalized_format`, `normalized_content`, `warnings` siguen siendo el contrato público
- Consumidores que ignoran `warnings` siguen funcionando
- Campo `structure` opcional en respuesta

## Extended response

```json
{
  "normalized_format": "html_min|markdown",
  "normalized_content": "...",
  "warnings": ["low_heading_confidence"],
  "structure": {
    "heading_count": 8,
    "confidence": "medium",
    "artifacts_removed": 12
  }
}
```

## Warning codes

| Code | When |
|------|------|
| `low_heading_confidence` | doc >5000 chars, heading_count === 0 |
| `scanned_pdf_no_text` | PDF extract yields <50 chars total |
| `layout_complex` | multicolumn detected or high artifact rejection in body zone |
| `outline_partial` | outline exists but <50% titles matched in body |

## Rules (unchanged from v1 + additions)

1. `html` → `html_min` with inferred `<h1>`–`<h6>` when possible
2. `pdf`, `txt`, `md` → `markdown` with `#`–`######` when possible
3. Unsupported format → `unsupported_format` (unchanged)
4. **NEW**: Normalization MUST NOT use LLM
5. **NEW**: Page numbers MUST be stripped per `artifact-removal.md`

## Acceptance mapping

- FR-007, FR-010; extends FR-013/FR-014

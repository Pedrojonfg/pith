# Contract: Input Normalization (Formats v1)

## Purpose

Definir la conversión determinística del archivo fuente antes de generar bloques, optimizando tokens y evitando formatos fuera de alcance.

## Supported formats (v1)

- `pdf`
- `html`
- `txt`
- `md`

## Request contract

```json
{
  "filename": "source.ext",
  "detected_format": "pdf|html|txt|md",
  "raw_content": "..."
}
```

## Response contract

```json
{
  "normalized_format": "html_min|markdown",
  "normalized_content": "...",
  "warnings": []
}
```

## Rules

1. Si `detected_format === "html"`:
   - `normalized_format = "html_min"`
   - eliminar `<script>`, `<style>`, comentarios HTML, atributos de evento (`on*`) y estilos inline.
   - conservar texto y estructura semántica básica (`h1..h6`, `p`, `ul/ol/li`, `table`, `blockquote`, `pre/code`).

2. Si `detected_format` es `pdf`, `txt` o `md`:
   - `normalized_format = "markdown"`
   - convertir a texto markdown sin añadir CSS/JS ni HTML decorativo.

3. Si el formato no pertenece a la lista v1:
   - devolver error `unsupported_format`
   - no producir `normalized_content` parcial.

## Error contract

```json
{
  "error": {
    "code": "unsupported_format|normalization_failed",
    "message": "Human readable explanation",
    "detected_format": "..."
  }
}
```

## Acceptance mapping

- FR-013: regla de bifurcación HTML mínimo vs Markdown
- FR-014 / FR-014a: lista cerrada de formatos v1 y rechazo explícito fuera de lista

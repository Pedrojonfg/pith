# Contract: Text Analyzer API

**Module**: `src/js/recommendation/analyzer.js`

## Public API

```js
/**
 * @param {string} markdownText — markdown normalizado
 * @returns {import("../session-types.js").TextMetrics}
 */
export function analyzeText(markdownText)
```

## Pure function guarantees

- Sin I/O, sin LLM, sin dependencias de session
- Determinístico: mismo input → mismo output
- Seguro con `null`/`undefined` → string vacío

## sizeCategory thresholds (chars)

| Category | Range |
|----------|-------|
| `tiny` | < 2000 |
| `short` | 2000 – 7999 |
| `medium` | 8000 – 29999 |
| `long` | 30000 – 79999 |
| `very_long` | ≥ 80000 |

## Heuristic patterns (minimum)

- **Bibliography**: `\([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+,?\s+\d{4}\)`, `\[\d+\]`
- **Math**: `\$`, `\\frac`, `\\sum`, `∑`, `∫`
- **Definitions**: `(se define como|se denomina|denominamos|refers to as|is defined as)`
- **First person**: `\b(yo|nosotros|me|mi|I|we|my)\b` case-insensitive

## Academic vocab

Static `Set` ES+EN en el módulo; extensible sin cambiar API.

## Tests

`cursor-tests/20260609_flow-recommendation-analyzer.mjs` — mínimo 8 casos del spec T01.

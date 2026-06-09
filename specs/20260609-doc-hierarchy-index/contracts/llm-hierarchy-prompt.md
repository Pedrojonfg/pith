# Contract: LLM Hierarchy Prompt

**Module**: `src/js/normalization/hierarchy.js` (`buildDocumentHierarchy`)

## Invocation

- **Model**: User's active LLM (`getActiveSessionLlmModel()`)
- **Temperature**: 0
- **Max tokens**: 2000
- **Response**: JSON only (strip markdown fences if present)

## System + user prompt template

```
Eres un analizador estructural de textos académicos.
Dado el siguiente texto en markdown, genera un árbol jerárquico de sus secciones.

REGLAS ESTRICTAS:
- Responde SOLO con JSON válido, sin markdown, sin explicaciones.
- startOffset y endOffset son posiciones en caracteres del texto original.
  startOffset del primer nodo raíz = 0.
  endOffset del último nodo raíz = longitud total del texto.
- Los rangos de nodos hermanos no se solapan y son contiguos.
- level 1 = sección principal, level 2 = subsección, máximo level 3.
- Si el texto no tiene estructura clara, devuelve un solo nodo raíz con el título inferido del contenido.
- summary: 1 frase, máx 15 palabras, en el idioma del texto. (omitir si doc < 8000 chars)

TEXTO (longitud: {N} chars):
{texto}

RESPUESTA (solo JSON):
```

## Response shape

```json
[
  {
    "title": "...",
    "level": 1,
    "startOffset": 0,
    "endOffset": 4821,
    "summary": "...",
    "children": []
  }
]
```

Root MAY be array (preferred) or single object — normalizer accepts both.

## Post-processing

1. `JSON.parse` after stripping `` ```json `` fences
2. `validateHierarchy(tree, text.length)`
3. On failure → `buildDeterministicHierarchy(markdownText)` + `method: 'deterministic'`

## llmFn signature (injected)

```js
async function llmFn({ systemPrompt, userPrompt, temperature, maxTokens, signal }) → string
```

Tests mock `llmFn` to return fixture JSON.

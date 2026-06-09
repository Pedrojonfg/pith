# Contract: Hierarchy Pedagogical Meta Extension

**Module**: `src/js/normalization/hierarchy.js`

## Prompt extension

Añadir al `buildHierarchyUserPrompt` / system rules:

```text
Además del árbol, devuelve "pedagogical_meta" al mismo nivel que el array raíz del árbol:
- genre: philosophical | scientific_theoretical | scientific_empirical | essay | lecture_notes | textbook_chapter | unknown
- argumentative_density: 1-5
- conceptual_load: 1-5
- primary_learning_goal: understand_argument | memorize_facts | learn_procedure | survey_field
- reasoning: string, máx 20 palabras

Formato respuesta JSON: { "tree": [...], "pedagogical_meta": { ... } }
```

## Return shape change

```js
{
  method: 'llm' | 'deterministic' | 'trivial',
  tree: HierarchyNode[],
  pedagogicalMeta: PedagogicalMeta | null,  // NEW
  textHash: string,
  generatedAt: number,
  fromCache?: boolean,
}
```

## New exports

```js
export function buildDeterministicPedagogicalMeta(textMetrics) → PedagogicalMeta
export function parsePedagogicalMetaFromLlm(raw) → PedagogicalMeta | null
```

## When pedagogicalMeta is set

| method | Source |
|--------|--------|
| `llm` | Parsed from LLM JSON |
| `deterministic` | `buildDeterministicPedagogicalMeta(analyzeText(text))` |
| `trivial` | Same deterministic |
| LLM fail / null tree | deterministic fallback |
| `llmFn` null | deterministic if text processed; else null |

## Cache

`hierarchy-cache.js`: store `{ tree, method, pedagogicalMeta }` on LLM success.

## Backward compatibility

Callers que solo usan `.tree` siguen funcionando. `pedagogicalMeta` opcional hasta T06.

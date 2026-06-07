# Contract: Text Layer Node Subtypes

**Feature**: `20260530-graph-academic-genre` | **FR**: FR-003, FR-004, FR-007

## Subtypes

| Subtype | Meaning | Example |
|---------|---------|---------|
| CONCEPTO | Idea abstracta | Bildung, Erziehung |
| PERSONA | Pensador/autor referenciado | Herder, Humboldt |
| OBRA | Texto/libro citado | Allgemeine Pädagogik |
| MOVIMIENTO | Corriente, escuela, institución | Pietismo |
| EVENTO | Hecho histórico con fecha | Reforma universitaria 1810 |

## Prompt injection (conceptsToFind section)

```text
Para cada nodo indica su tipo entre corchetes: [CONCEPTO], [PERSONA], [OBRA],
[MOVIMIENTO] o [EVENTO]. Nunca crees un nodo [PERSONA] para el autor del texto
que estás analizando. Si el texto contiene su propio nombre como referencia
bibliográfica, ignóralo como nodo.

Cada ítem: { "term": "...", "authorUsage": "...", "nodeType": "CONCEPTO" }
```

## Cluster deduplication (same prompt block)

```text
Si detectas varios conceptos que cumplen el mismo rol estructural en el argumento
(ej. varios ejemplos del mismo tipo de oposición, o varias obras del mismo autor
sobre el mismo tema), agrúpalos en un único nodo con una etiqueta representativa
y lista los elementos agrupados en el campo "includes".

Ejemplo: en lugar de [PISA, estandarización, política basada en evidencia],
crea un solo nodo "[EVENTO] Tendencias tecnocráticas en educación (PISA, ...)"
con includes: ["PISA", "estandarización", "enseñanza para el examen"].
```

## Normalization (`normalizeConcept`)

- Parse `nodeType` from field or leading `[TYPE]` in `term`
- Strip duplicate bracket prefix when building label
- Validate `nodeType` enum; default `CONCEPTO`

## Graph node output

```js
g.addNode({
  id: textNodeId(termId),
  label: `[${nodeType}] ${term}`,
  layer: "text",
  termId,
  nodeSubtype: nodeType,
  includes: c.includes, // optional
});
```

## Edge directionality (build.js)

```js
const REINTERPRETS_FROM = new Set(["PERSONA", "MOVIMIENTO"]);
// reinterprets: only if fromSubtype in REINTERPRETS_FROM && toSubtype === "CONCEPTO"
// CONCEPTO → PERSONA with type "defines": blocked
```

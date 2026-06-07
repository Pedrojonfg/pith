# Contract: Phase 0 — Text Genre Classification

**Feature**: `20260530-graph-academic-genre` | **FR**: FR-001, FR-002, FR-011

## Prompt injection (system, before argumentMap instructions)

```text
Antes de construir el mapa argumental, clasifica este texto en uno de estos géneros:

- ARGUMENTO_LINEAL: el autor defiende una tesis con premisas que la sostienen directamente
- GENEALOGÍA: el autor reconstruye cómo un concepto evoluciona históricamente
- DEBATE: el autor contrasta posiciones de múltiples autores sobre un mismo problema
- DEFINICIÓN: el autor delimita qué es y qué no es un concepto
- ANÁLISIS_DE_CASO: el autor examina un fenómeno concreto con marco teórico

Devuelve el género detectado como campo "textGenre" en el JSON de Phase 0.
```

## argumentMap structure by genre

| textGenre | Map shape | Extra node fields |
|-----------|-----------|-------------------|
| ARGUMENTO_LINEAL | P1, P2, …, C | `status` |
| GENEALOGÍA | G1, G2, … (cronológico) | `period` (required per node) |
| DEBATE | D1, D2, … (posiciones) | `author` (required per node) |
| DEFINICIÓN | DEF (centro), S1, S2 (satélites) | distinciones/exclusiones en `text` |
| ANÁLISIS_DE_CASO | CASO, M1, M2 | marco teórico en nodos M* |

## JSON schema addition

```json
{
  "textGenre": "GENEALOGÍA",
  "thesis": "...",
  "argumentMap": [
    { "id": "G1", "text": "...", "period": "siglo XVIII" },
    { "id": "G2", "text": "...", "period": "siglo XIX" }
  ],
  "conceptsToFind": [...],
  "guideQuestion": "..."
}
```

## Validation (`validatePhase0Orientation`)

- Accept `textGenre`; coerce unknown → `ARGUMENTO_LINEAL`
- `argumentMap` still required (min 1 node)
- `period` / `author` optional at validation (warn if genre expects them and missing)

## Map-reduce

- Chunk prompts: unchanged partial schema
- Synthesis prompt: must merge partial maps **and** emit single `textGenre` for whole text
- If chunk genres disagree, synthesis picks dominant genre with brief coherence

## Graph build (`buildSlowPhase0GraphFromInputs`)

```js
const seqEdge =
  phase0.textGenre === "GENEALOGÍA" ? "historically_precedes" : "sequence";
// between consecutive argumentMap nodes
```

## Failure modes

- IA omits `textGenre` → default `ARGUMENTO_LINEAL`
- GENEALOGÍA sin `period` en nodos → grafo igual se construye; nodos sin period en label

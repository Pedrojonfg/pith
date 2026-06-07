# Contract: Graph Edge Vocabulary (Philosophical)

**Feature**: `20260530-graph-academic-genre` | **FR**: FR-006, FR-009, FR-010

## EdgeType enum (canonical)

```js
export const EDGE_TYPES = {
  // existing
  requires: "requires",
  covers: "covers",
  mentions: "mentions",
  sequence: "sequence",
  relates: "relates",
  supports: "supports",
  contradicts: "contradicts",
  refuta: "refuta",
  cuestiona: "cuestiona",
  instantiates: "instantiates",
  // new
  historically_precedes: "historically_precedes",
  reinterprets: "reinterprets",
  constitutes: "constitutes",
  contrasts_with: "contrasts_with",
  influences: "influences",
};
```

## Semantics

| Type | Meaning | vs existing |
|------|---------|-------------|
| `historically_precedes` | A ocurre antes que B en genealogía | Replaces `sequence` for GENEALOGÍA map |
| `reinterprets` | B toma A y cambia su significado | Persona/movimiento → concepto |
| `constitutes` | A es componente de B (no idéntico) | Más preciso que `part_of` |
| `contrasts_with` | Distinción conceptual sin incompatibilidad lógica | ≠ `contradicts` |
| `influences` | Contribución causal débil | Entre `implies` y `relates` |
| `instantiates` | Caso concreto de abstracción | Ya parcialmente usado |

## export-format.js families

```js
EDGE_TYPE_FAMILIES = {
  // ...existing...
  historically_precedes: "didactic",
  reinterprets: "semantic",
  constitutes: "semantic",
  contrasts_with: "argumentative",
  influences: "semantic",
};
```

## canvas.js stroke styles

| Style | Types |
|-------|-------|
| solid (`stroke-dasharray: none`) | sequence, historically_precedes, supports, constitutes, influences |
| dashed (`4 4`) | relates, contrasts_with, reinterprets |
| heavy dashed (`8 4`, width 2.5) | contradicts, refuta, cuestiona |

## EDGE_COLORS extension

Assign distinct hues for new types; fallback `#64748b`.

## Phase 0 → graph edge typing

When `argumentMap` nodes include `linkType` from IA:
- Map `linkType` synonyms to canonical edge type
- Default inter-map edges: `sequence` or `historically_precedes` per genre

# Contract: Cloze Graph View

**Feature**: `20260529-cloze-mode` | **FR**: FR-008

## Builder

- `buildClozeEpistemicGraph(session)` in `graph/build.js`.
- `buildSessionGraph(session, { mode: 'cloze' })` routes to cloze builder.
- Input: `session.cloze.epistemicGraph`.
- Output: `{ nodes, edges, kind: 'cloze' }` compatible with `renderGraphCanvas`.

## Node mapping

| Epistemic | Canvas node |
|-----------|-------------|
| `node.id` | `cloze:${id}` |
| `node.text` | label |
| `importance` | metadata / size hint optional |

## Edge mapping

| Epistemic | Canvas edge |
|-----------|-------------|
| `source_id` → `target_id` | directed edge |
| `type` | edge label/type |

## UI

- Reuse `mountMaterialGraphScreen(session, container, { mode: 'cloze' })`.
- Button **Ver grafo** visible when `epistemicGraph` exists (post Fase 0 or ready).
- No new canvas component.

## Non-goals

- No cross-mode graph merge.
- No IndexedDB cache beyond session slot.

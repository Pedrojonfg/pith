# Contract: Pack Concept Graph Editor

## Pure mutators (`pack-concept-editor.js`)

All return a **new** snapshot object (or documented in-place clone); never touch DocumentSession.

### `getConceptKey(entry) → string`

`canonicalId || id || concept_id` trimmed.

### `renameConcept(snapshot, conceptId, newTitle) → PackSnapshot`

Updates matching inventory `title`/`label` and graph node `text`/`label`. Throws if missing/empty.

### `addConcept(snapshot, title) → { snapshot, conceptId }`

Creates inventory entry + graph node with unique id (`graphTermSlug` + disambiguator).

### `deleteConcept(snapshot, conceptId) → PackSnapshot`

Removes inventory entry, node, and every edge where `source_id|from` or `target_id|to` equals conceptId.

### `addEdge(snapshot, fromId, toId, type) → PackSnapshot`

Adds edge with stored `type` from allowed set. Rejects self-loops / unknown type.

### `removeEdge(snapshot, fromId, toId, type?) → PackSnapshot`

Removes matching edge(s).

### `toCanvasGraph(snapshot) → { nodes, edges }`

Maps epistemic snapshot graph (+ inventory titles fallback) to canvas nodes/edges for `renderGraphCanvas` / `mountMaterialGraphScreen({ graph })`.

### `assertNoDanglingEdges(graph) → void`

Test helper: every edge endpoint exists in nodes.

## Storage (`pack-export.js`)

### `updatePackDraftSnapshot(packDraftId, snapshot, deps?) → Promise<SharedPackRow>`

1. Load row; throw if missing / not `draft`
2. UPDATE `snapshot` only (keep status draft)
3. Return updated row

## UI flow

1. Library **Create pack** → `createPackDraft(docId, ownerUserId)` → `showScreen('packConceptEditor')`
2. Mount graph via `mountMaterialGraphScreen(null, mountEl, { graph: toCanvasGraph(snapshot), onNodeClick, … })`
3. Mutations update working snapshot → debounce `updatePackDraftSnapshot`
4. **Publish** → flush → `finalizePack(packId, includeSourceDocument)`

## Errors

| Condition | Behavior |
|-----------|----------|
| Not draft / not owner | throw / RLS; show toast |
| Empty rename/add name | validation message; no mutation |
| Save failure | keep in-memory edits; show error |
| Finalize failure | stay on editor; draft remains |

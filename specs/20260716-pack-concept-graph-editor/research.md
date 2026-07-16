# Research: Pack Concept Graph Editor

## Decision: Entry point on project library doc row

**Rationale**: `project-library.js` already renders per-doc actions (Markdown export, move, delete). No pack UI exists elsewhere. Placing “Create pack” beside export matches the “share this session” mental model.

**Alternatives considered**:
- Mode-select screen — rejects: pack spans whole DocumentSession, not a mode.
- Vault branch — rejects: vault is curated knowledge, not session packs.

## Decision: Persist via `updatePackDraftSnapshot` + debounce

**Rationale**: `finalizePack` loads `snapshot` from Supabase. In-memory-only edits would be lost on publish unless finalize is extended. Adding a narrow draft UPDATE (status must remain `draft`) matches RLS owner policies and keeps finalize unchanged.

**Pattern**: Keep working snapshot in module/UI state; `setTimeout` debounce (~500ms) write; flush on leave/publish. No new retry-with-backoff wrapper (none exists as a shared utility yet).

**Alternatives considered**:
- Pass override snapshot into `finalizePack` — works but skips durable mid-edit recovery.
- Write on every click — excessive round-trips.

## Decision: Operate on pack epistemic graph shape + inventory ids

**Rationale**: Pack snapshots clone `shared.conceptGraph`, which is often the cloze/DPP epistemic shape (`nodes[].id/text`, `edges[].source_id/target_id/type`). Inventory ids use `id` / `concept_id` / `canonicalId`; display uses `title` / `label`. Mutators must:
- Match concepts by `canonicalId || id || concept_id`
- On rename, set both `title` and `label` when either exists
- Keep graph node `id` aligned with inventory concept id (not canvas `concept:` prefix inside the stored snapshot)
- For canvas display, adapt via a thin `toCanvasGraph(snapshot)` that maps to `{id, label, layer}` + `{from, to, type}` expected by `renderGraphCanvas`

**New concept ids**: `graphTermSlug(title)` + numeric suffix if collision; store as inventory `id`/`canonicalId`; add graph node with same id.

## Decision: Edge type picker maps product labels → existing `EDGE_TYPES`

**Rationale**: Spec brief listed `PREREQUISITE`/`PART_OF`/…; codebase uses lowercase `requires`, `constitutes`, `contradicts`, `exemplifies`, `relates`. UI shows product labels; stored edge `type` uses `EDGE_TYPES` values.

| UI label | Stored type |
|----------|-------------|
| Prerequisite | `requires` |
| Contradicts | `contradicts` |
| Exemplifies | `exemplifies` |
| Part of | `constitutes` |
| Associated | `relates` |

## Decision: Physical delete + known dangling-content limitation

**Rationale**: Soft-hide would require a new `hidden` flag and filter in every consumer. Inspection shows RSVP/questions reference concept ids loosely; cascade rewrite is out of scope. Document near delete: hanging mode references are accepted v1 risk (FR-010 / Assumptions).

## Decision: Edit mode confined to pack editor

**Rationale**: `mountMaterialGraphScreen` already accepts `onNodeClick`. Pack editor passes edit handlers; `screenSlowGraph` does not. Optional `onEdgeClick` added to canvas only if needed for edge delete — Slow path omits it → remains non-interactive for edges.

## Decision: No schema migration

**Rationale**: Draft snapshot jsonb already holds `conceptGraph` / `conceptInventory`. Owner UPDATE of own drafts is covered by pack-export RLS.

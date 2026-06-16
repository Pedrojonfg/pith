# Spec: Cross-Document Concept Vault & Global Concept Registry

**Date**: 2026-06-15
**Status**: Draft
**Depends on**: `20260613-recall-mode`, `20260614-study-projects`, `20260614-knowledge-vault-curation`, `20260609-unified-session`
**Supersedes (partial)**: `20260614-knowledge-vault-curation` (commit/curation gate — see §13)

---

## 1. Context & Problem Statement

MyLearning's core differentiator vs. Obsidian is not file format or graph visualization — it's that **the vault emerges as a side effect of active recall**, not from manual note-taking or LLM auto-generation. Today, each `DocumentSession` has its own `shared.conceptInventory`, `shared.assessmentSignals`, and `shared.smItems`, all scoped to that single document. There is no notion of "this concept also appears in three other documents" or "the user has actually written something meaningful about this concept across their whole corpus."

This spec introduces a **global concept registry**: a cross-document layer that sits above per-document `shared` data, tracks each concept's maturity on a **gray → yellow → green** scale, and becomes the backbone of:

- A cross-document concept graph (the "vault").
- A single SM-2 schedule per concept (replacing per-document `smItems` duplication).
- Recall-mode-authored content as the actual substance of "green" concepts.

The guiding constraint carried over from prior design discussions: **no concept page is generated speculatively**. Gray nodes are cheap (free, from inventory). Yellow requires real signal. Green requires the user's own words.

---

## 2. Goals

1. Give every concept in `conceptInventory`, across all documents, a single canonical identity (when it matters).
2. Define a maturity model (gray/yellow/green) that is a strict generalization of the existing gray/gap node convention (L24/L25), not a parallel system.
3. Move SM-2 scheduling to the global concept level, with per-facet schedules feeding a single aggregate `mastery` scalar.
4. Define exactly which events promote a concept gray→yellow and yellow→green, across every mode (RSVP, Questions, Slow, Cloze, Recall).
5. Define the vault graph as a view over the registry, reusing existing graph rendering (`graph/view.js`, `canvas.js`) rather than introducing a fourth graph schema.
6. Make population fully automatic — no "upload to vault" action, no curation gate.
7. Keep `session-store.js` (or its successor) as the single seam for the Supabase migration.

---

## 3. Non-Goals & Explicit Deferrals

The following are **out of scope** for this spec and should not be designed around:

- **BKT / multi-faceted mastery scores.** A single `mastery` scalar per concept is retained, as already decided in `20260614-knowledge-vault-curation`. Per-facet *schedules* exist (for SM-2 timing), but per-facet *scores* do not — that would reproduce the sparsity problem BKT was rejected for.
- **PACER taxonomy integration.** Still deferred; use cases unclear. The `ConceptFacet` taxonomy from Recall mode (`synthesis`, `relational`, `argumentative`, `applicative`, plus an implicit `recognition` facet for MCQ/cloze — see §7.3) is the only taxonomy this spec uses.
- **Full Obsidian-style import/export with wikilinks.** Touched on as a future direction in §11, but not specced here. This spec only requires that the data model *not preclude* it later (canonical slugs + aliases are sufficient groundwork).
- **Cross-document edges beyond co-occurrence and explicit Recall-authored links.** Richer relationship typing (e.g., "contradicts", "generalizes") is future work.
- **Manual merge/split UI for misidentified concepts.** Flagged as an open question in §16; a manual override mechanism will exist but its UI is not specced here.

---

## 4. Maturity Model

Three states, applied per **global concept**:

| State | Meaning | Visual convention |
|-------|---------|--------------------|
| **Gray** | Concept exists in some document's `conceptInventory`, but has no retrieval signal anywhere. May or may not yet have a global registry row (see §6.1). | Same as existing gray/gap nodes (L24/L25) — no new convention. |
| **Yellow** | Concept has at least one `assessmentSignal` or `smItem`-equivalent schedule entry (i.e., the user has been asked about it, in any mode). Has a global registry row. | New — desaturated accent color, distinct from gray and green. |
| **Green** | Concept has at least one piece of user-authored content from Recall (synthesis/relational/argumentative responses) or Slow Phase 3 modules (steel-man/devil's-advocate). | New — full accent color, matches "mastered/has content" semantics already used for completed nodes. |

**Maturity is monotonic.** A concept does not regress from green to yellow or yellow to gray due to decay. Decay affects the `mastery` scalar (§8), not the maturity state. A green concept whose mastery has decayed to near-zero is still green (it has content — it just needs review), which is a meaningfully different UI state from "never engaged with."

---

## 5. Data Model

### 5.1 `Concept` (new, global registry)

```typescript
interface Concept {
  id: string;                    // uuid, global registry PK
  canonicalName: string;         // display name, e.g. "Laplace Transform"
  slug: string;                  // normalized, e.g. "laplace-transform"
  aliases: string[];             // alternate names/phrasings seen across documents
  maturity: 'yellow' | 'green';  // gray concepts have NO row here — see §6.1
  mastery: number;                // 0–1 scalar, derived (see §8), persisted as cache
  facets: ConceptFacetSchedule[]; // per-facet SM-2 state, see §5.2
  content: ConceptContent | null; // present only when maturity === 'green'
  sourceDocIds: string[];         // DocumentSession ids where this concept appears
  createdAt: string;
  updatedAt: string;
}
```

Note: there is deliberately **no `gray` row** in this table. See §6.1 for why gray concepts stay local.

### 5.2 `ConceptFacetSchedule`

One per `(concept, facet)` pair that has ever been exercised. This is the per-document `smItems` entry, generalized to global scope and split by facet.

```typescript
type ConceptFacet =
  | 'recognition'   // MCQ / cloze-style — the "default" facet for RSVP/Questions/Cloze
  | 'synthesis'
  | 'relational'
  | 'argumentative'
  | 'applicative';

interface ConceptFacetSchedule {
  facet: ConceptFacet;
  interval: number;        // days, SM-2
  repetitions: number;
  easeFactor: number;
  dueDate: string;
  lastReviewedAt: string;
  lastQuality: number;     // 0-5, SM-2 quality of most recent review
}
```

Each facet schedule is independently due for review. The Review screen surfaces "next due" across all facets of all concepts, same as today but at global rather than per-document scope.

### 5.3 `ConceptContent` (green concepts only)

```typescript
interface ConceptContent {
  blocks: ConceptContentBlock[];
}

interface ConceptContentBlock {
  id: string;
  facet: ConceptFacet;          // which Recall question type produced this
  text: string;                  // the user's own words (post-tutor-refinement)
  sourceDocId: string;
  sourceSessionDate: string;
  supersededBy: string | null;   // id of a later block that consolidates/replaces this one
}
```

Content is **append-and-supersede**, not edit-in-place. Every Recall response that qualifies (§7.2) adds a block. When a later response on the same `(concept, facet)` is judged by the tutor to be a strict improvement, the earlier block is marked `supersededBy` but retained — this gives a visible "how my understanding evolved" history, which is itself pedagogically useful and avoids destructive overwrites. The vault page view shows only non-superseded blocks by default, with history expandable.

### 5.4 `ConceptLink` (per-document, new field on existing inventory entries)

`shared.conceptInventory[i]` gains:

```typescript
interface ConceptInventoryEntry {
  // ...existing fields (id, name, description, etc.)
  globalConceptId: string | null;  // null until resolved (gray) — see §6
}
```

No new top-level entity is needed for this — it's a single nullable field on the structure that already exists.

### 5.5 Changes to `shared`

- `shared.assessmentSignals` entries gain `globalConceptId` (populated at write time if resolution has already happened, otherwise backfilled when resolution runs — see §6.3).
- `shared.smItems` is **deprecated** in favor of `ConceptFacetSchedule` rows in the global registry. During the transition (Phase 1, §15), existing `smItems` are read-through for Review but new schedule writes go to the global registry. A one-time migration pass converts existing `smItems` for resolved concepts.

### 5.6 `VaultObservation` (carried over from `20260614-knowledge-vault-curation`)

Unchanged in structure, but now references `globalConceptId` instead of a per-document `VaultReviewItem`:

```typescript
interface VaultObservation {
  conceptId: string;      // global Concept.id
  facet: ConceptFacet;
  observedAt: string;
  quality: number;        // 0-5
  sourceDocId: string;
}
```

These feed the decay computation in §8.

---

## 6. Identity Resolution

### 6.1 Why gray concepts stay local

The global registry is the expensive resource — every row potentially requires an LLM dedup call against existing entries. A typical document's `conceptInventory` has 30–80 entries; the vast majority are never touched again. Promoting all of them to the global registry would mean 30–80 LLM calls per document upload for concepts the user will likely never revisit.

So: **gray concepts live only in `shared.conceptInventory`, with `globalConceptId: null`.** They render in that document's own graph exactly as gray/gap nodes do today (L24/L25 — no change). They do **not** appear in the cross-document vault graph as merged entities. If the same gray concept happens to exist in two different documents, those are two separate, un-deduplicated gray nodes — and that's fine, because nothing is being lost (there's no content or schedule to merge).

### 6.2 Trigger: resolution runs at gray→yellow promotion

The moment a concept receives its first `assessmentSignal` (any mode, any facet — see §7.1 for the full trigger list), identity resolution runs **once** for that concept:

1. Compute an embedding for `canonicalName` + short description from `conceptInventory`.
2. Query the global registry for nearest neighbors (vector similarity + slug/alias fuzzy match).
3. If a high-confidence match exists → reuse that `Concept.id`, add the new name as an `alias` if it differs.
4. If no match (or low confidence) → create a new `Concept` row with a fresh slug derived from `canonicalName`.
5. Write `globalConceptId` back onto the `ConceptInventoryEntry` and the triggering `assessmentSignal`.

This is a single LLM/embedding call per concept, and only for concepts that have already demonstrated they matter (the user was asked about them).

### 6.3 Backfill

If a user studies the same document twice, or the same concept across documents in quick succession, `assessmentSignals` written *before* resolution completes are backfilled with `globalConceptId` once it resolves. This should be a cheap update (no re-running resolution).

### 6.4 Ambiguous matches

If resolution returns a medium-confidence match (e.g., "Laplace Transform" vs. "Inverse Laplace Transform" — related but not identical), default to **not merging** (create a new concept, store the candidate match as a `relatedConceptId` hint). False negatives (two concepts that should've merged but didn't) are recoverable later via manual merge (§16, open question); false positives (two distinct concepts merged into one) corrupt content blocks and SM-2 history, which is much harder to undo. Bias toward splitting.

---

## 7. Promotion Rules

### 7.1 Gray → Yellow

Triggered by **any** of the following, the first time it occurs for a given concept:

| Source | Event |
|--------|-------|
| RSVP / Questions | User answers an MCQ or Socratic question tagged to this concept (facet = `recognition`, or the Recall facet if the question was generated via Recall-style prompting) |
| Cloze | User completes a cloze item (`sentence_with_blank`) whose `epistemicGraph` node resolves to this concept (facet = `recognition`) |
| Recall | User submits *any* response, including ones that don't qualify for green (facet = the question's type) |
| Slow | A checkpoint auto-explanation is dismissed *with* a quality signal (e.g., the user marks it "got it" / "review later") — Slow's lighter-touch interactions only count if they produce an explicit quality signal, not passive reading |

Effect: identity resolution runs (§6.2), a `Concept` row is created/reused, an initial `ConceptFacetSchedule` entry is created for the triggering facet with SM-2 defaults (interval=0, repetitions=0).

### 7.2 Yellow → Green

Triggered by:

| Source | Event |
|--------|-------|
| Recall | A response of type `synthesis`, `relational`, or `argumentative` is saved, **and** the tutor's evaluation does not flag it as off-topic/insufficient (reuses existing Recall scoring — a response that would score quality 0-1 on SM-2 should not promote to green even if it's the first response) |
| Slow Phase 3 | A devil's-advocate or steel-man module response is saved against a concept (treated as `argumentative` facet for content purposes) |

Effect: a `ConceptContentBlock` is created (or supersedes an earlier block — §5.3). `maturity` flips to `green`. **Note**: an `applicative`-facet Recall response does *not* by itself promote to green under the current Recall taxonomy (it's an SM-2 signal, facet = `applicative`, but doesn't produce vault-page prose) — only `synthesis`/`relational`/`argumentative` produce content blocks. This may be revisited once Recall mode has real usage data on what `applicative` responses actually look like.

### 7.3 Quality mapping consistency

Each mode already maps its own outcomes to SM-2 quality (0-5) for its local `smItems`. This spec requires no new mapping logic — it requires that **whatever quality value a mode currently computes gets written to the matching `(globalConceptId, facet)` schedule** instead of (or in addition to, during transition) the local `smItems` entry. The `facet` for non-Recall modes defaults to `recognition`.

---

## 8. Mastery Computation & Decay

`Concept.mastery` is a **cached, derived** value, recomputed whenever:
- A `VaultObservation` is recorded, or
- The decay loop runs (background, on app open or on a timer — existing mechanism from `20260614-knowledge-vault-curation`, unchanged in cadence).

Computation (carrying forward `lambda = 0.05`, still uncalibrated):

```
mastery = weighted_average(facet_schedules, weight = recency-aware)
        × exp(-lambda × days_since_last_observation_across_all_facets)
```

The weighting across facets is intentionally simple for v1 (e.g., most-recently-reviewed facet dominates, or a simple average) — this is exactly the kind of constant that the existing "residuals being logged for future tuning" effort already covers, just at concept-scope instead of per-document-item-scope. No new calibration infrastructure is needed; the same logging extends naturally.

A green concept's mastery can decay toward 0 without losing `green` status (§4) — the UI distinguishes "green, mastery low" (needs review, but content exists — show a review prompt) from "yellow" (no content yet — show a "study this with Recall" prompt) from "gray" (not yet engaged — show as graph context only).

---

## 9. Vault Graph

### 9.1 Relationship to existing per-document graphs

The vault graph is **not a fourth graph schema**. It reuses `graph/view.js` + `canvas.js`. Its node set is:

- All `green` and `yellow` concepts from the global registry (always shown), plus
- `gray` concepts from the **currently focused document's** `conceptInventory` (shown as contextual neighbors when that document is open — exactly as RSVP gray/gap nodes are shown today).

This means: opening the vault from "cold" (no document focused) shows only yellow/green nodes — a graph of "what I've actually engaged with." Opening it from within a document's context additionally overlays that document's gray concepts as potential expansion points, identical in appearance to the existing gap-node convention.

### 9.2 Node styling

| Maturity | Style |
|----------|-------|
| Gray | Existing gap/prerequisite style (L24/L25) — unchanged |
| Yellow | New desaturated accent — "has schedule, no content" |
| Green | New full accent — "has user-authored content"; additionally show a small badge if `mastery` is below a review threshold (e.g., < 0.3) to surface "green but due" |

### 9.3 Edges

- **Co-occurrence**: two concepts appearing in the same document's `conceptInventory` get a weak edge (weight = number of shared documents).
- **Prerequisite**: reuses L24/L25 prerequisite edges where the source document's hierarchy/inventory expressed a dependency.
- **Explicit links**: if a Recall `synthesis`/`relational` response text mentions another concept by name (detectable at resolution time via the same embedding pass), an explicit edge is added. This is the closest analog to an Obsidian `[[wikilink]]`, but it's generated from the user's own writing rather than required as input syntax.

### 9.4 Navigation

Per the "on the horizon" App Home plan: the **Vault** tab opens this graph (cold, i.e., yellow/green only) plus a list/search view for direct navigation to concept pages. Clicking a green node opens its `ConceptContent` (read-only consolidated view, with history expandable per §5.3). Clicking a yellow node offers "study this" → routes into Recall mode pre-scoped to that concept (cross-document — Recall mode's spec should accept an optional `focusConceptId` parameter; flagged as a small addition to `20260613-recall-mode` if not already present).

---

## 10. Ingest-Only Flow

To populate gray nodes (and thus make the vault graph meaningful) without forcing the user through a full study mode, a minimal ingest path is needed:

1. User uploads a file from the Session Hub (or a future "Library" bulk-upload).
2. Pipeline runs: normalization → `rawMarkdown` → `docHierarchy` → **inventory Phase 1 only** (`runConceptInventory`, no Phase 2 macro/micro pass, no packing).
3. A `DocumentSession` is created with `shared.conceptInventory` populated, `globalConceptId: null` on every entry (all gray), and no `modes.*` slice populated.
4. The document appears in the library and contributes gray nodes to the vault graph when focused (§9.1), but otherwise sits idle until the user opens it in any mode.

This is the same minimal pipeline already used for the recommendation flow's `analyzeText` pass — no new LLM call shapes, just an entry point that stops earlier in the existing pipeline. This entry point is also the natural target for any future bulk-import flow (§11).

---

## 11. Import / Export — Scope for This Spec

Only the following is in scope here, as groundwork:

- `Concept.slug` + `aliases` exist specifically so that a future export could render `canonicalName` as a filename and `aliases` as redirect stubs, Obsidian-style.
- `ConceptContent.blocks` with explicit links (§9.3) are structurally equivalent to a note body with `[[wikilinks]]` — a future renderer could emit them as such.

Actually generating `.md` files with `[[wikilinks]]`, handling a bulk Obsidian vault import (where existing wikilinks bootstrap identity resolution for free, as discussed), and any Drive integration are **separate future specs**, sequenced after this one has real usage data (i.e., after Phase 2, §15).

---

## 12. Per-Mode Integration Summary

| Mode | Reads from registry | Writes to registry |
|------|----------------------|----------------------|
| RSVP / Questions | — | `assessmentSignals` → gray→yellow (recognition facet) |
| Slow | — | Checkpoint quality signals → gray→yellow; Phase 3 devil's-advocate/steel-man → yellow→green (argumentative facet) |
| Cloze | `epistemicGraph` nodes resolve against registry for prioritization (read `assessmentSignals`-equivalent) | MC results → gray→yellow (recognition facet) |
| Recall | `focusConceptId` param to scope a session to a specific concept (yellow nodes) | synthesis/relational/argumentative/applicative responses → yellow→green (content + facet schedule) |
| Review | Aggregates due `ConceptFacetSchedule` entries across all concepts | Review outcomes update schedules |
| Study Projects | `projectId` can optionally filter the vault graph view to concepts sourced from documents in that project/subtree | — (no write interaction; confirmed orthogonal per `20260614-study-projects`) |

---

## 13. Relationship to Existing Specs

### `20260614-knowledge-vault-curation`

This spec **supersedes the curation/commit-gate flow** described there:

- **Superseded**: "Upload flow triggers at Session Hub level, batch LLM call, user curation screen before committing." There is no commit gate. Population is automatic per §7.
- **Retained**: `ConceptFacet` taxonomy (now sourced from Recall's taxonomy, reused as-is), single `mastery` scalar, `VaultObservation`-driven decay loop (now global-scoped, §5.6/§8), `lambda = 0.05` (uncalibrated, same logging approach).
- **Retained but relocated**: `VaultReviewItem`'s per-concept independent SM-2 scheduling becomes `ConceptFacetSchedule` (§5.2) — same idea, now at `(globalConceptId, facet)` instead of `(documentId, conceptInventoryId)`.

### `20260613-recall-mode`

- This spec is the primary *source* of green-promoting content (§7.2).
- Requested addition: an optional `focusConceptId` parameter so Recall can be entered scoped to a single global concept from the vault graph (§9.4). If Recall mode's current entry points don't support arbitrary concept-scoping, this is a small addendum to that spec, not a redesign.

### `20260614-study-projects`

- Confirmed orthogonal, as previously discussed: `projectId` (organizational, user-defined) and the global concept registry (semantic, cross-cutting) don't interact except as an optional view filter (§12). No changes required to that spec.

### `20260609-unified-session`

- `shared.conceptInventory` and `shared.assessmentSignals` gain the `globalConceptId` field (§5.4, §5.5). `shared.smItems` is deprecated with a read-through/migration path (§5.5). This is an additive schema change — bump `DocumentSession.schemaVersion` per the existing migration convention (`session-migration.js`).

---

## 14. Persistence & Supabase Sequencing

The global registry (`Concept`, `ConceptFacetSchedule`, `VaultObservation`) is **fundamentally relational** — "find all concepts sourced from documents in project X," "find all concepts due for review across the whole corpus," "find nearest-neighbor candidates during identity resolution" are all queries that are painful over a `DocumentSession[]` array in `localStorage`.

Per the existing learning that **`session-store.js` is the only module requiring changes for the Supabase migration**, this spec proposes the same seam applies to a new `concept-registry-store.js`:

- **Phase 1 (can ship pre-Supabase)**: `concept-registry-store.js` backs onto a new `localStorage` key (`mylearning_concept_registry`), with the same CRUD interface the Supabase-backed version will expose. Identity resolution queries do a linear scan (registry size is small — hundreds, not thousands, of yellow/green concepts even with heavy use).
- **Phase 2 (Supabase)**: same interface, backed by `concepts`, `concept_facet_schedules`, and `vault_observations` tables. Identity resolution's nearest-neighbor query becomes a real vector/index query (e.g., pgvector if available on Supabase's free tier — verify; fall back to trigram/fuzzy match on `slug`/`aliases` if not).

This means **this spec does not block on the Supabase migration**, but it does strengthen the case for not deferring it indefinitely — Phase 2 of this spec is a natural forcing function for Phase 1 of the migration, and the two can be sequenced together rather than the migration being a separate, undated future task.

---

## 15. Phasing / Rollout

1. **Phase 1 — Registry + Yellow.** Schema additions (§5), identity resolution (§6), gray→yellow promotion (§7.1) wired from RSVP/Questions/Cloze (the modes that already exist and already produce `assessmentSignals`). `smItems` migration. Vault graph shows yellow nodes + gray context (§9), no green yet. Works entirely independent of Recall mode shipping.
2. **Phase 2 — Green via Recall.** Yellow→green promotion (§7.2), `ConceptContent` storage and supersession, Slow Phase 3 integration. Vault concept pages become readable. This phase depends on Recall mode being live.
3. **Phase 3 — Vault navigation.** App Home `Vault` tab (§9.4), `focusConceptId` Recall entry point, explicit-link edges from content (§9.3).
4. **Phase 4 (deferred, separate specs)** — Obsidian-style export/import, Drive integration, manual merge UI.

---

## 16. Open Questions

1. **Manual merge/split.** If identity resolution produces a false split (two `Concept` rows that should be one) or — worse, but rarer by design (§6.4) — a false merge, what's the recovery path? A merge needs to combine `ConceptFacetSchedule`s (how? max of intervals? reset?) and concatenate `ConceptContent.blocks`. A split needs to duplicate or reassign content blocks. Needs its own design pass, likely as part of Phase 3.
2. **Facet weighting in `mastery` aggregation (§8).** Simple average vs. recency-weighted vs. most-recent-facet-dominates — needs the same "log residuals, tune later" treatment as `lambda`, but the *shape* of the formula should be picked before Phase 1 ships, since changing it later means recomputing cached `mastery` for every concept.
3. **`applicative` facet and green promotion.** Currently excluded from content-block generation (§7.2). Revisit once Recall has real usage data — it's plausible an `applicative` response (e.g., "here's how I'd use X to solve Y") is exactly the kind of content a vault page should show.
4. **pgvector availability on Supabase free tier** for identity resolution nearest-neighbor queries (§14) — needs verification before Phase 2 design is finalized.

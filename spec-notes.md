# Spec: Vault — Personal Notes, Connections & Resumable Upload

## 1. Motivation

`KnowledgeVaultEntry` (today, schemaVersion implicit "1") works well as the
algorithmic backbone of the vault: mastery tracking, SM-2 review items,
prerequisite-based recommendation, cross-document concept dedup. What it
doesn't support is the thing that makes a personal vault worth returning to:
**connections the user makes themselves, and a place to write in their own
words**.

This spec extends `KnowledgeVaultEntry` with a small set of new fields
(`notes`, `area`, `tags`, `related`, `status`, `type`) and reworks the
**Upload to Vault** flow so that creating/updating entries also produces
those connections — without requiring the user to do extra work beyond what
they already do during curation.

It also defines a **resumable processing model** for Upload to Vault, since
extending the flow makes each batch noticeably more LLM-call-heavy.

## 2. Scope / Non-goals

In scope:

- New fields on `KnowledgeVaultEntry` (data model v2) and migration from v1.
- Extended Upload to Vault flow: per-concept `notes`/`area`/`tags`/`related`
  suggestions, dedup call extended to also suggest `related` candidates and
  `area`.
- Bidirectional `related[]` writes (backlinks), including to vault entries
  outside the current batch.
- Resumable, incrementally-persisted processing queue for a batch.

Out of scope (see §8):

- Parsing `[[wikilinks]]` inside `notes` to auto-populate `related[]`.
- `type` values other than `CONCEPT` (CLASS / CONVERSATION / PROJECT) —
  reserved in the schema, no entry flow populates them yet.
- Background processing while the app is fully closed (Service Worker /
  Background Sync) — revisit post-Supabase as a server-side job.
- Importing external Obsidian vaults (`importFromObsidianMarkdownVault`) —
  a natural future import path given the new `notes`/`related`/`tags`
  fields, but not part of this spec.

## 3. Data model changes — `KnowledgeVaultEntry` v2

```typescript
{
  // --- existing fields, unchanged ---
  id: string,
  canonicalTitle: string,
  aliases: string[],
  topic: string,                  // retained, see §4 — legacy/CSV-JSON compat
  masteryBase: number,
  masteryDeclarativeBase: number,
  masteryProceduralBase: number,
  masteryLastUpdated: number,
  lastSeen: number,
  sources: VaultSource[],
  prerequisites: string[],
  dependents: string[],
  observations: VaultObservation[],
  definitions: VaultDefinition[],
  facetCoverage: object,
  misconceptions: [],
  coPrerequisites: [],
  manualOrigin: boolean,

  // --- new fields (v2) ---
  type: "CONCEPT" | "CLASS" | "CONVERSATION" | "PROJECT",
  area: string[],                 // always an array, primary categorization
  tags: string[],                 // free-form; Spanish + English technical terms
  notes: string,                  // markdown body, user's own voice
  notesUpdatedAt: number | null,
  related: string[],              // vault entry IDs, symmetric/bidirectional
  status: "pending" | "ready"
}
```

### Field semantics

- **`type`** — entry kind. v1 of this spec only ever writes `"CONCEPT"`
  (all current Upload to Vault entries are concepts). The other values are
  reserved so a future "import a Obsidian-style note" path doesn't need
  another schema bump.
- **`area`** — broad categorization, user-facing, always an array even with
  one value. This is the field the Upload to Vault flow actively curates
  (§5.2). `topic` is *not* replaced — see §4 for how the two coexist.
- **`tags`** — free tags, no enforced taxonomy. Mixed-language is expected
  (e.g. `"cálculo"`, `"chain-rule"`).
- **`notes`** — markdown body. This is the "Obsidian note" content: a short
  definition + context + free notes, in the user's words, possibly
  containing `[[Title]]`-style references as plain text (not parsed in this
  spec — see §8).
- **`notesUpdatedAt`** — timestamp of last edit to `notes`, used to decide
  whether a re-curation appends vs. overwrites (§7, decision 2).
- **`related`** — symmetric, non-hierarchical connections, stored as vault
  entry IDs. Distinct from `prerequisites`/`dependents`, which remain the
  directed, pedagogically-inferred edges. An entry that is already a
  prerequisite/dependent of another MAY also appear in `related` — the UI
  is responsible for not showing the same connection twice, the data model
  doesn't deduplicate across these arrays.
- **`status`** — `"ready"` means "has been through Pith's Upload to Vault
  pipeline at least once" (has `notes`, reviewed `definitions`, etc.).
  `"pending"` means the entry exists but hasn't been curated this way —
  e.g. it came from a CSV/JSON/manual/free-text import. This is effectively
  a vault inbox marker.

## 4. Schema migration (v1 → v2)

Lazy migration on vault load, analogous to `session-migration.js` for
`DocumentSession` — e.g. `vault-migration.js`, bumping a `schemaVersion`
field on the vault container (vault-level, not per-entry).

For every existing `KnowledgeVaultEntry`:

| New field | Default |
|---|---|
| `type` | `"CONCEPT"` |
| `area` | `topic ? [topic] : []` |
| `tags` | `[]` |
| `notes` | `""` |
| `notesUpdatedAt` | `null` |
| `related` | `[]` |
| `status` | `sources.length > 0 ? "ready" : "pending"` |

The `status` default follows directly from the existing "Resumen rápido"
table: entries from session-close, "already know this", and curation all
have non-empty `sources` and came from `mylearning.app`'s own pipeline →
`ready`. Entries from free text, CSV/JSON, and manual entry have empty
`sources` → `pending`.

`topic` is **not** removed or rewritten. CSV/JSON import
(`importStructuredRows`) keeps reading/writing `topic` exactly as today,
including its existing merge-by-`canonicalTitle`+`topic` logic. New entries
created via Upload to Vault additionally set `topic = area[0]`, so any
existing code path that only knows about `topic` keeps working without
changes.

## 5. Upload to Vault — extended flow

### 5.1 Batch context

Before per-concept curation begins, assemble:

```typescript
{
  docId: string,
  concepts: Array<{        // full batch, from shared.conceptInventory
    id: string,
    title: string,
    module: string,
    prerequisite_ids: string[],
    concept_type: string
  }>,
  existingVaultAreas: string[]   // distinct `area` values across the vault
}
```

This is new input to the curation step (5.2) and the dedup call (5.3) —
both need to know about sibling concepts in the same batch and about the
vault's existing `area` taxonomy.

### 5.2 Per-concept curation (extended)

For each concept, in addition to today's `definition` / `reviewItems`
review:

- **`notes` draft** — LLM-generated, seeded from `scope_one_line`,
  `source_phrase`, the accepted `definition`, `module`, and sibling concept
  titles from the batch (for cross-references). Suggested shape (mirrors the
  user's existing personal-vault convention):
  - *Definition* — 2–4 sentences, self-contained.
  - *Context* — where this comes from, why it matters, how it connects to
    the document's overall topic.
  - *Notes* — source-specific details, examples, nuances.
  - *Related concepts* — short list, populated from `related` candidates
    below.

  User edits/accepts like any other generated field. Default: auto-draft
  **on** (toggle in settings for users who prefer a blank `notes` field —
  see §7, decision 1).

- **`area` suggestion** — 1–2 values, preferring matches from
  `existingVaultAreas`; only proposes a new value if nothing existing fits.
  Editable multi-select.

- **`tags` suggestion** — short list, editable as free tags.

- **`related` candidates** — union of:
  1. sibling concepts in the same batch, and
  2. vault entries flagged "related but not duplicate" by the dedup call
     (5.3).

  Shown as checkboxes; top 2–3 pre-checked, rest available but unchecked.

### 5.3 Dedup + related/area suggestion (single LLM call)

The existing dedup call (`{ id, title, type: "CONCEPT" }` → `merge | alias |
new`) is extended. Input additionally includes `batchContext` and a compact
list of existing vault entries — `{ id, canonicalTitle, aliases, area,
topic }` only, not full entries, restricted to entries sharing an `area`
with the batch's likely areas plus a small top-K by title similarity (to
keep the prompt bounded regardless of vault size).

Output:

```json
{
  "decision": "merge | alias | new",
  "mergeTargetId": "...",
  "areaSuggestion": ["..."],
  "relatedCandidates": ["vaultEntryId1", "vaultEntryId2"]
}
```

Still one call per concept (not one call for the whole batch) — keeps each
prompt small and failure isolated to a single item, which matters for the
queue model in §6.

### 5.4 Commit & bidirectional backlinks

For each concept, on commit:

- **New entry** — write full `KnowledgeVaultEntry` v2: `status: "ready"`,
  `type: "CONCEPT"`, `topic: area[0]`, plus `area`, `tags`, `notes`,
  `notesUpdatedAt: now`, `definitions`, `reviewItems`, `related` as accepted.
- **Merge** — as today (append `definitions`/`reviewItems`,
  `mergeNormalizationResult`), plus: union `tags` and `area`; union
  `related`; merge `notes` per §7 decision 2; flip `status` to `"ready"`.
- **Backlinks** — for every ID now in this entry's `related[]`, check the
  *target* entry's `related[]`. If this entry's ID isn't already there,
  append it. This may touch vault entries that are not part of the current
  batch at all ("neighbors"). Neighbor updates are **`related[]`-only** — no
  other field changes, `status` untouched (see §7, decision 4).

## 6. Processing model — resumable queue

New persisted structure, `pith_vault_upload_queue`:

```typescript
{
  docId: string,
  createdAt: number,
  items: Array<{
    conceptId: string,
    status: "pending" | "processing" | "done" | "error",
    payload: {              // accepted curation, ready to commit
      definition: VaultDefinition,
      reviewItems: ReviewItemDraft[],
      notes: string,
      area: string[],
      tags: string[],
      relatedAccepted: string[]
    },
    error?: string
  }>
}
```

A new controller module, `vault-upload-queue.js`, owns processing. It's
invoked when the user confirms "Upload to vault" but doesn't live inside the
curation screen — registered at app boot, the same way `study.js` orchestrates
RSVP independently of which screen is currently rendered.

- **Order**: sequential per item — dedup+related call → commit → backlinks.
- **Incremental persistence**: each item's vault writes (including any
  neighbor backlink writes) are flushed to `pith_knowledge_vault`
  immediately on completion; only then does the queue item flip to `"done"`.
- **Resumability**: on app boot, if `pith_vault_upload_queue` has any
  `pending` / `error` / stale-`processing` items, show a banner — *"Vault
  upload pending (N items) — Resume"*. Any item found `"processing"` at boot
  is treated as `"pending"` (it was interrupted mid-call; not re-flagged as
  error, just retried).
- **Errors**: per-item, with a message. A failed item doesn't block the rest
  of the queue. UI offers retry per-item and "retry all errors".
- **Within the same tab**, changing screens or navigating elsewhere does not
  pause the queue — it's a global controller, not screen-local state.
- **Fully closing the app/tab** pauses the queue (work resumes on next
  open); already-`"done"` items are not lost or repeated. No guarantee of
  progress while closed — see §8 for the future server-side direction.

## 7. Decisions taken

1. **`notes` generation** — LLM draft + user edit/accept, default **on**,
   with a settings toggle for a blank-canvas mode. Consistent with how
   `definition`/`reviewItems` already work; the extra LLM call's
   cost/latency is accepted as part of the curation step.
2. **`notes` on re-curation of an existing entry** — never overwritten.
   A new dated subsection is appended (e.g. `## Update 2026-06-14`).
3. **`area` assignment** — chosen against `existingVaultAreas` first; a new
   value is only proposed if nothing existing fits. The dedup call (5.3)
   receives the existing areas list specifically to support this.
4. **`status` on merge** — flips to `"ready"` only for entries that go
   through full curation in this batch. Neighbor entries that only receive
   a `related[]` backlink keep their existing `status`.
5. **Minimum-connections rule** — soft nudge, not a hard block. If a concept
   ends up with an empty `related[]` after curation (e.g. a single-concept
   batch with no candidates), show a non-blocking note — *"this entry has no
   connections — continue anyway?"* — but allow commit.

## 8. Open questions / future work

- **Wikilink parsing in `notes`** — `[[Title]]` references inside `notes`
  could auto-populate `related[]` and give backlinks for free. Deferred:
  `notes` stays plain markdown for now, with `related[]` populated only via
  the explicit checkboxes in 5.2.
- **`type` values beyond `CONCEPT`** — schema reserves `CLASS` /
  `CONVERSATION` / `PROJECT`, but no entry flow writes them yet. The most
  natural path to populate them is an Obsidian-markdown import
  (`importFromObsidianMarkdownVault`, parsing frontmatter + wikilinks per
  the user's existing personal-vault convention) — worth its own spec if
  pursued.
- **Server-side queue processing** — once the Supabase migration moves LLM
  calls server-side, "close the app and it keeps going" becomes feasible via
  an Edge Function job + client polling. Explicitly out of scope here.

## 9. Testing notes (`cursor-tests/`)

- Migration: v1 → v2 defaults, including `status` inference from
  `sources.length`, for entries from each of the six import paths.
- Dedup+related call: mocked LLM responses covering `merge | alias | new`
  combined with `areaSuggestion` / `relatedCandidates`.
- Bidirectional backlinks: committing a batch updates `related[]` on
  out-of-batch neighbor entries without touching their other fields or
  `status`.
- Queue resume: simulate interruption mid-batch (some items `"done"`, one
  `"processing"`), reload, verify only non-`"done"` items are reprocessed and
  no vault entry is duplicated or double-committed.

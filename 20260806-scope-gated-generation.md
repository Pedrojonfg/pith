# Spec: Scope-Gated Generation Architecture

**Date:** 2026-08-06
**Status:** Ready for implementation
**Supersedes (partially):** `20260705-document-scope-selection` (FR-011/T07 is only
partially implemented — this spec completes and corrects it). Does NOT rewrite
that spec; this is a new spec per project convention. Where behavior conflicts,
this spec wins.

**Context documents this spec relies on (read before implementing):**
- Audit A: "Feasibility of blocking all Tier-1+/Tier-2 generation on scope
  resolution and running it exclusively over scopedMarkdown" (2026-08-06)
- Audit B: "screenSlowScope / readingScope removal safety" (2026-08-06)
- `application-overview.md` DPP phase table (section 5)

---

## 0. Problem statement

Two independent but entangled bugs/gaps:

1. **Timing bug:** `processCreateSessionStagedUpload` intends to stop DPP
   execution after the scope structure is ready (`stopAfterScopeGate: true`)
   so the user can be asked for scope early. `startDocumentPreparation` drops
   this option (never forwards it to `runDocumentPreparationPipeline`), so the
   full Tier 0–2 pipeline runs before the user ever sees the scope question.

2. **Architecture gap:** Even once (1) is fixed, most generation phases
   (T1.2, T1.2b, T1.4, T1.6, T1.7, T1.8, T1.9, T2.1, T2.2, T2.3, shared
   assessment) do not correctly and exclusively consume scope-limited text.
   Some default to full-document text silently (`scopedMarkdown` is seeded
   as a copy of `rawMarkdown` before any user choice exists, so "unresolved
   scope" and "user chose whole document" are indistinguishable today).
   Some are hardcoded to `rawMarkdown` regardless of scope (Recall, shared
   assessment, T1.2b). Some receive correctly-scoped text but silently
   misbehave because they still consult full-document `docHierarchy` offsets
   for chunking/boundary logic, which do not align with scoped text.

This spec fixes both, and additionally removes `screenSlowScope` /
`session.slow.readingScope`, which become fully redundant once every mode
(including Slow) consumes the same blocking, universal `scopeSelection`.

---

## 1. Core product rules (non-negotiable, drive every phase below)

**R1.** No study-content generation phase (T1.2, T1.2b, T1.4, T1.6, T1.7,
T1.8, T1.9, T2.1, T2.2, T2.3, shared/holistic assessment) may execute until
`scopeResolvedAt` is set on the session. This is a hard gate, not a soft
preference.

**R2.** Every phase in R1's list must consume `scopedMarkdown` (and a scope-
relative reconstructed hierarchy — see R4) exclusively. None may fall back to
`rawMarkdown`, whether by explicit reference or by an untagged default.

**R3.** Exactly one exception to R1/R2: the guide/Socratic chatbot retains
access to full-document `rawMarkdown` as background context, even while the
user studies a resolved scope. This is existing dual-context behavior
(`resolveChatScopeFields`) and must NOT be changed by this spec.

**R4.** When the resolved scope consists of non-contiguous sections, a new
scope-relative hierarchy ("mini-tree") must be reconstructed: a hierarchy
tree containing only the chosen section nodes, with `startOffset`/
`endOffset` recomputed against the concatenated `scopedMarkdown` string —
never against the original full-document offsets.

**R5.** Scope is a one-time decision per study session. Once
`scopeResolvedAt` is set, it is immutable for the lifetime of that
`DocumentSession`. There is no scope-change flow, no re-scoping, no
invalidation-on-change logic. (This eliminates the need for scope-keyed
cache invalidation — see §5.)

**R6.** `screenSlowScope` (HTML + routing) and `session.modes.slow.
readingScope` (field + all read/write sites) are removed. Slow Mode
consumes `scopedMarkdown` exactly like every other mode. Slow retains an
in-reader navigation index (table of contents) built from the mini-tree,
letting the user jump to any chosen section — this is navigation within
already-resolved scope, not a second scope concept.

---

## 2. Non-goals (explicitly out of scope for this spec)

- Multi-file source picker (`selectedSourceFileId` on the old Slow scope
  screen). Removed without replacement — `scopedMarkdown` is already a
  concatenation across whatever documents/sections the user selected at the
  single, universal scope step.
- Manual heading edit / auto-split (`scopeEditMode`, `headingOverrides`,
  auto-split by length). Removed without replacement.
- Arbitrary sub-section character-range scoping (picking "first half of
  section 3"). The minimum scope unit is a whole hierarchy section. This is
  an accepted capability loss, not deferred.
- Redesigning the export format (`export.js` / `export-format.js` scope
  label). This spec keeps export working (label falls back to listing
  section titles instead of a character range) but does not redesign
  export. Flagged as a likely follow-up, not addressed here.
- Cross-scope caching, scope-change flows, or any invalidation mechanism.
  R5 makes these moot.
- Fixing `T1.5` (mode recommendation) potentially running concurrently with
  or before `T1.2` in the phase DAG — that ordering is intentional per
  `PHASE_DEPS` and unrelated to this spec. Do not touch `PHASE_DEPS` for
  `T1.5`.
- The `#recommendationPanel` implementation on `screenModeSelect` — tracked
  separately, unrelated to this spec.

---

## 3. Fix 1 — Timing bug (forward the stop option)

**File:** `src/js/study.js`

`startDocumentPreparation` currently does not forward `stopAfterScopeGate`
to `runDocumentPreparationPipeline`. Locate the call (~L564–574) and ensure
`options.stopAfterScopeGate` is passed through, exactly as
`ensureScopeStructurePreparation` already does correctly elsewhere in the
same file. Do not invent a new option name; reuse the existing one so both
call paths are consistent.

After this fix, `processCreateSessionStagedUpload`'s existing
`stopAfterScopeGate: true` call will actually take effect: DPP stops after
T0.1/T0.2/T1.1, and `maybeEnterScopeSelectionGate` is reached with the
scope-structure-ready gate (`isScopeStructureReady`, keyed off
`docHierarchy.tree`) as the real, early trigger — matching what
`ensureScopeStructurePreparation` already does on the other call path.

**Verify after this fix:** `enterModeSelectAfterTier1Gate` and the rest of
the downstream flow still function when entered from this corrected early
stop point. Do not assume — trace it.

---

## 4. Fix 2 — Disambiguate "unresolved" from "user chose whole document"

**Problem:** `session-store.js` currently seeds `scopedMarkdown = rawMarkdown`
at creation and migration time (L519–520, L344–346), before the user has
made any scope choice. `resolveScopedMarkdown` (`session-types.js:753–759`)
returns this seeded value whenever `scopedMarkdown` is non-empty — so a
session with no scope decision yet is indistinguishable from a session where
the user explicitly chose "entire document."

**Fix:**
- Do NOT seed `shared.scopedMarkdown` at session creation or migration time.
  Leave it unset/null until scope is actually resolved.
- `resolveScopedMarkdown(session)` must check `isScopeGateResolved(session)`
  (i.e. `scopeResolvedAt` is set) FIRST. If not resolved, it must not return
  any text — callers in the R1 phase list must not be calling this function
  at all before resolution (see R1's hard gate), so this is a defensive
  correctness fix, not the primary gate mechanism.
- When the user resolves scope as "entire document" (a valid choice), set
  `scopedMarkdown = rawMarkdown` explicitly AND set `scopeResolvedAt`, so the
  two states are now distinguishable by `scopeResolvedAt` alone, not by
  inferring intent from whether `scopedMarkdown` happens to equal
  `rawMarkdown`.
- Audit and update `mode-bootstrap.js:280`'s explicit second fallback
  (`resolveScopedMarkdown(doc) || doc.shared?.rawMarkdown`) — this fallback
  must be removed or made to only apply to the chatbot/guide context path
  (R3 exception), never to mode content bootstrap.

---

## 5. Fix 3 — The hard gate (R1 enforcement)

**File:** `document-preparation.js`, phase runner entry points for T1.2,
T1.2b, T1.4, T1.6, T1.7, T1.8, T1.9, T2.1, T2.2, T2.3.

Add an explicit precondition check at the top of `executePhase` (or each
runner, whichever is the single choke point — inspect and choose the one
that cannot be bypassed) for every phase in this list: if
`!isScopeGateResolved(doc)`, the phase must not execute. Decide and
implement one consistent behavior (do not mix): either (a) the phase is
excluded from the wave entirely when scope is unresolved (preferred —
cleaner, matches how `stopAfterScopeGate` already truncates the phase list),
or (b) the phase executes and immediately no-ops/defers. Prefer (a); use
`phasesForStopTier` / the existing stop-tier mechanism as the model, adding
an equivalent "stop after scope gate, do not resume until resolved"
semantics that the create-session and hub-bootstrap flows both then use to
sequence: T0.1 → T0.2 → T1.1 → [WAIT for scopeResolvedAt] → T1.2 onward.

**Existing early-return bypass to close:** `ensureTier1Preparation`
(`document-preparation.js:1312–1324`) currently early-returns based on
artifact presence (`isTier1PreparationComplete`) without checking scope
resolution. Because of R5 (scope immutable once set), you do NOT need
scope-keyed invalidation — but you DO need to ensure this early-return can
never fire for a session where scope was never resolved in the first place
(i.e. don't let stale/legacy sessions with artifacts but no
`scopeResolvedAt` slip through). Add the `isScopeGateResolved` check here
too.

**Legacy migration path:** `session-store.js:355–357` sets
`scopeResolvedAt` inferred from "has inventory" without an actual user scope
choice, for migrated legacy sessions. Given this is pre-launch/friend-
testing data (confirmed acceptable to discard per Audit B §5), this
migration shortcut should be removed. Legacy sessions without a real scope
choice should be treated as scope-unresolved and re-prompted, not silently
grandfathered in as "resolved."

**Fingerprint overwrite bug (found in Audit A §7, fix as part of this
gate):** `runDocumentPreparationPipeline` overwrites `prep.fingerprint` at
pipeline start (`document-preparation.js:1017`) before `phaseSucceeded`
checks it (`:261–267`), which means the check is always vacuously true
post-overwrite. This allows phases to be treated as "already succeeded" for
the wrong content. Fix so `phaseSucceeded` compares against the fingerprint
that was current when that phase last actually ran, not one just
overwritten in the current run.

---

## 6. Fix 4 — Mini-tree reconstruction (R4)

**New module:** create `src/js/normalization/scoped-hierarchy.js` (or
equivalent location matching project conventions — inspect
`normalization/hierarchy.js` for the existing pattern and mirror its
exports).

**Function contract:**

```
buildScopedHierarchy(fullHierarchy: DocHierarchy, chosenSectionIds: string[], scopedMarkdown: string): DocHierarchy
```

- Input: the full-document `docHierarchy.tree` (built by T1.1 on
  `rawMarkdown`), the ordered list of section node IDs the user selected as
  scope, and the already-concatenated `scopedMarkdown` string (concatenation
  order must match `chosenSectionIds` order — confirm this invariant holds
  wherever `scopedMarkdown` is assembled today, likely in the scope
  selection confirm handler; if concatenation order and `chosenSectionIds`
  order can diverge, fix that first, this function depends on it).
- Output: a new `DocHierarchy`-shaped tree containing ONLY the chosen
  section nodes (preserve their internal parent/child structure among
  themselves if it's a strict subset of a subtree; flatten to siblings if
  the selection crosses unrelated branches — inspect `hierarchy.js`'s
  `pedagogical_meta` handling to decide the correct shape, and document
  the decision in code comments since this is a judgment call not fully
  specified by existing types).
- Each node's `startOffset`/`endOffset` must be recomputed against
  `scopedMarkdown`, not copied from the original tree. Compute by locating
  each section's known text length (from the original tree) and laying
  nodes out sequentially in `scopedMarkdown` in concatenation order.
- `pedagogical_meta` (genre, density, goal) fields can be copied as-is from
  the original nodes — they describe content, not position, and are
  unaffected by reflowing offsets.

**Wire this into every consumer that currently reads full-document
`docHierarchy` for chunking or boundary purposes**, per Audit A's findings:

| Consumer | File | Current behavior | Required change |
|---|---|---|---|
| T1.2 inventory chunking | `api.js` `buildInventoryChunks` (~L975–978) | Slices `material` using full-doc `node.startOffset/endOffset` | Must receive and use the reconstructed mini-tree, not `doc.shared.docHierarchy` |
| T1.2 sparsity check | `document-preparation.js:397–400` | Prefers full-doc `docMeta.charCount`/`textMetrics.charCount` over `text.length` | Must use scoped text length once scope resolved |
| T2.3 Slow orientation hierarchy summary | `phase0.js:750–752`, `:263–267` | `scopeStart=0, scopeEnd=text.length` against full-doc hierarchy | Must use mini-tree with correctly reflowed offsets |
| T2.3 map-reduce hierarchy shift | `phase0.js:618–633` | Only runs when legacy `readingScope` truthy | Must run keyed off the mini-tree unconditionally once scope resolved (this logic is being generalized, not deleted — see §8) |
| Shared/holistic assessment coverage chunking | `study.js:9180` `buildInventoryChunks(docHierarchy, flow.cleanedText)` | Full hierarchy × full text | Must pass mini-tree × `scopedMarkdown` |

**T1.2b concept anchoring** (`concept-anchoring.js:73`, currently hardcoded
`rawMarkdown`): also needs the mini-tree if it does any offset-based
anchoring against hierarchy sections; if it only anchors against plain text
search (not offsets), only the `rawMarkdown` → `scopedMarkdown` text swap is
needed. Inspect and confirm which before implementing.

---

## 7. Fix 5 — Flip hardcoded full-document consumers

Per Audit A, these do not use scope at all today (not mislabeled — actually
wrong):

**Recall (T2.2), `recall-study.js:165–167` and `recall-api.js:124–135`:**
Replace `rawMarkdown: doc.shared.rawMarkdown` with scoped text
(`resolveScopedMarkdown(doc)`, now safe post-Fix-2 since it only returns
text when scope is resolved). `buildDeterministicPedagogicalMetaFallback`
and `buildDefaultRecallConfig`'s length-based tiering must key off scoped
text length, not full-document length.

**Shared assessment, `study.js:1350–1362`:** Replace
`cleanedText = String(doc.shared.rawMarkdown || "")` with scoped text. Then
per §6's table, fix the holistic coverage chunking at `study.js:9180` to use
the mini-tree.

**T1.2b, `concept-anchoring.js:73`:** per §6, flip to scoped text (and
mini-tree if offset-based).

**T1.7 image analysis:** Audit A notes this processes all `shared.images`
regardless of scope. A `countScopedImages`-style pattern already exists per
the audit — locate it and use the same filtering approach so vision calls
only run on images whose tokens fall within `scopedMarkdown`.

---

## 8. Fix 6 — Cloze (T2.1) scope correctness

Per Audit A §3, two issues:

1. **Graph reuse mismatch:** If `shared.conceptGraph` (T1.3) was built
   before this spec's gate existed (i.e. on old data) or is otherwise
   full-document, and Cloze's `shouldSkipClozePhase0` decides to reuse it
   instead of regenerating from `scopedMarkdown`, the result is scoped text
   analyzed against a full-document graph. Since T1.3 is now also gated
   behind scope resolution (§5, it's in the R1 list — confirm T1.3 is
   included; if the phase table omits it, add it, T1.3 must also wait for
   scope), this should resolve itself going forward: `shared.conceptGraph`
   will only ever be built from `scopedMarkdown` post-gate. No separate fix
   needed beyond ensuring T1.3 is correctly included in the gated phase
   list.

2. **`shouldPreserveClozeSlice`** (`mode-bootstrap.js:63–76`): currently
   preserves an existing Cloze slice (ready items, in-progress, or failed-
   with-leftovers) without checking whether that slice was generated for
   the current (immutable, per R5) scope. Given R5, once scope is resolved
   it never changes for that session — so an existing slice for this
   session, if one exists, was necessarily generated for the only scope
   this session will ever have. The function's premise is therefore fine
   AS LONG AS it is never reachable for a slice from a different session/
   docId. Verify this is already guaranteed (slices are per-session, per
   `DocumentSession`, and sessions don't share slices), and if so, no change
   is needed here beyond what the gate (§5) already provides. Confirm this
   in code before concluding "no change needed" — do not assume.

---

## 9. Fix 7 — T2.3 Slow orientation scope key

**File:** `document-preparation.js:922–927`

Replace hardcoded `scopeKey: "full_document"` with the actual resolved
scope identity (e.g. the ordered list of chosen section IDs, or a hash of
them — pick whichever the rest of the codebase already uses as a scope
identity primitive; if none exists, use the ordered section ID array
directly since R5 means it never needs to be compared against a "new"
scope, only stored for reference/debugging).

Per §6, also fix `buildSectionBoundariesForScope` (`phase0.js:452–487`) and
the `treeSummary` scope math (`phase0.js:750–752`) to use the mini-tree
instead of returning `[]` or using full-doc offsets.

---

## 10. Fix 8 — Remove `screenSlowScope` and `readingScope`

Per Audit B, this is not a rename — several pieces are removed outright per
the decisions in §2 (Non-goals), and one capability (navigation index) is
rebuilt on the new foundation.

### 10.1 Remove the screen and legacy routing

- Delete `#screenSlowScope` and its child controls from `index.html`
  (`#slowScopeHierarchyLoading`, `#slowScopeWarningBanner`,
  `#slowScopeFileLabel`, `#slowScopeFileSelect`, `#slowScopeCharCount`,
  `#slowScopeLongWarning`, `#slowScopeEditBtn`, `#slowScopeAutoSplitBtn`,
  `#slowScopeList`, `#slowScopeFillableMap`, `#slowScopeCheckpoints`,
  `#slowScopeConfirmBtn`, `#slowScopeBackBtn`).
- Remove the `"slowScope"` screen registry entries in `ui.js` (L1467, 1505).
- **Redirect the live legacy path:** `study.js:10309–10367`
  (`generateBlocksForm` submit handler for `selectedMode === "slow"`)
  currently calls `createSlowSession` then `showScreen("slowScope")`. This
  is a live, reachable path (per Audit B §1), not dead code — it's how a
  user reaches Slow when `applyModeEntry` returns `upload_required` (no
  bootstrappable doc yet). Redirect this to the universal scope selection
  flow (`screenScopeSelection` / whatever the shared gate screen is called)
  instead of the old Slow-specific screen, so upload → shared scope
  question → (blocked generation, per this spec) → Slow entry, matching
  every other mode's path.
- `reader.js:94` and `:108` (`navigateSlowByPhase` for `phase === "scope"`)
  and the `resumeSlowSession` remap (`study.js:4261–4265`) that redirects
  `phase === "scope"` → Phase 0: since new sessions never write
  `phase: "scope"` after this spec, these become dead code for new data.
  Per Audit B §5 (pre-launch data, safe to discard), you may either delete
  this remap or leave it as a harmless no-op safety net for any leftover
  local test sessions — your call, low stakes either way, but note the
  decision in your implementation summary.

### 10.2 Remove `readingScope` and its read sites

Per Audit B's classification, category (a) sites are replaced with mini-
tree/scope-relative equivalents; category (b) capabilities are dropped per
§2 Non-goals; category (c) write sites are deleted.

- `reader.js:79–87` `getScopeText`: delete this function.
  `slow.normalizedTextFull` should simply be `scopedMarkdown` directly
  (already the case via hub bootstrap per Audit B §4) — callers that
  called `getScopeText(session)` should just read
  `session.slow.normalizedTextFull` (or wherever the session stores scoped
  text) directly, no slicing needed since there is no narrower "reading
  scope" than "the resolved scope" anymore.
- `reader.js:166–180` `buildReaderSectionBoundaries`: rewrite to derive
  section boundaries from the mini-tree (§6) instead of filtering by
  `readingScope`.
- `checkpoints.js:53–58`: same — section text comes from mini-tree node
  offsets against the (now full, no further slicing) scoped text.
- `phase0.js:452–487` `buildSectionBoundariesForScope`: rewrite to consume
  the mini-tree unconditionally (no more `readingScope` null-check
  returning `[]`).
- `phase0.js:618–633, 749–752`: same, mini-tree offsets.
- `annotations.js:54–56`: clamp against `scopedMarkdown.length` directly
  (there is no narrower window to clamp against anymore).
- `ai-context.js:5–6`: update its `getScopeText` call site to read scoped
  text directly per the `reader.js` change above.
- Delete all `readingScope` write sites: `study.js:1997` (init null —
  remove the field from `createSlowSession`'s initial slice shape
  entirely), `:3956` (hub bootstrap force-null — remove, no longer
  needed), `:4319–4325` (user pick on old scope screen — removed with the
  screen), `:4448` (cleared on file-select change — removed with the
  multi-file picker per Non-goals).
- Remove `readingScope` from the Slow data-model type/shape wherever it's
  declared (Audit B found no formal typedef in `session-types.js`, only
  documented in `specs/20260528-slow-mode/data-model.md` — update that
  spec's data model doc to reflect removal, per project convention of not
  rewriting old specs silently: add a short addendum note there pointing
  to this spec, rather than editing history).

### 10.3 fillable_map / checkpoints / critical_mode heuristic (close this out)

Per Audit B §3, `decideSlowReadingModifiers` does not exist yet — the
prior decision to make these system-decided (not user-configurable) was
never implemented. Both `screenSlowScope`'s toggles and `screenSlowPhase0`'s
duplicate toggles currently coexist, with Phase 0's values winning on
transition (`study.js:5147–5187`).

This spec closes that gap:
- Implement `decideSlowReadingModifiers(textMetrics, pedagogicalMeta)` as a
  pure function returning `{ fillableMap: boolean, checkpoints: boolean,
  criticalMode: boolean }`, using the text density / pedagogical genre
  heuristics already computed by DPP (T0.2 metrics, T1.1
  `pedagogical_meta`) — mirror the placeholder-constant convention used
  elsewhere in the project (name thresholds explicitly, e.g.
  `FILLABLE_MAP_DENSITY_THRESHOLD`, and mark them as unvalidated
  placeholders to calibrate post-launch, consistent with project
  convention).
- Remove the user-facing toggles entirely: `#slowScopeFillableMap` /
  `#slowScopeCheckpoints` are deleted with the screen (§10.1). Also remove
  their Phase 0 duplicates (`index.html:1649–1660`) and the
  `#criticalModeToggleBtn` create-form control (`index.html:883–891`) along
  with its wiring in `study.js:10345–10354`.
- Call `decideSlowReadingModifiers` once, at Slow session creation time
  (wherever `createSlowSession` currently reads the toggle values), and
  store the result on the slice exactly as the toggles used to.

### 10.4 New: Slow in-reader navigation index

Per the decision in conversation: Slow retains a table-of-contents-style
navigation UI, letting the user jump to any section within their already-
resolved scope (this is navigation, not a second scope-selection step).

- Build this from the mini-tree (§6): each node becomes a navigable entry
  (section title + jump-to-offset within `scopedMarkdown`).
- Location: surface this in `screenSlowReader` (the existing paginated
  reader screen), not as a separate screen — likely a collapsible sidebar
  or index panel, consistent with existing Slow reader chrome patterns
  (inspect `slow/sidebar.js` for the existing pattern to extend, since a
  sidebar module already exists for Slow and this may belong there rather
  than as new UI).
- Clicking an entry scrolls/paginates the reader to that section's start
  offset. No new backend/DPP work — this is pure client-side navigation
  over data already computed by §6.

### 10.5 Export label

Per the Non-goals decision (§2): keep export working without a redesign.
`export.js:444–452` / `export-format.js:131–135` currently print
`scope.label (start–end)` sourced from `readingScope`. Replace with a
simple joined list of the chosen section titles (available from the
mini-tree or from `shared.scopeSelection`'s chosen section IDs resolved
against `docHierarchy` titles). No character range needed. Flag in your
implementation summary that a proper export redesign is a likely near-term
follow-up (do not scope-creep into it here).

---

## 11. Implementation sequence (risk-ordered)

Implement and test in this order — each step should be independently
verifiable before moving to the next:

1. **§3 Fix 1** (forward `stopAfterScopeGate`) — smallest, highest-confidence
   fix. Verify the scope question now appears immediately after T1.1
   completes on the create-session path, with no other behavior regression.
2. **§4 Fix 2** (disambiguate unresolved vs whole-document) — foundational
   for everything else; nothing in §5 onward is safe until this lands.
3. **§5 Fix 3** (hard gate) — implement the phase-list exclusion mechanism.
   At this point, generation simply doesn't happen until scope is resolved;
   scoped-text *correctness* isn't done yet, but the timing/blocking
   contract is now real. Verify no phase in the R1 list can execute
   pre-resolution, across both create-session and hub-bootstrap paths.
4. **§6 Fix 4** (mini-tree reconstruction) — build and unit-test the
   `buildScopedHierarchy` function in isolation (contiguous selection,
   non-contiguous selection, single-section selection) before wiring any
   consumer to it.
5. **§7 Fix 5** (flip hardcoded consumers) + **§9 Fix 7** (T2.3 scope key) —
   these are independent of each other, do both, wire in the mini-tree from
   step 4 wherever the table in §6 requires it.
6. **§8 Fix 6** (Cloze correctness) — mostly verification once steps 3–5
   are in place; confirm the `shouldPreserveClozeSlice` reasoning in §8.2
   holds in actual code before calling this step done.
7. **§10 Fix 8** (remove `screenSlowScope`/`readingScope`) — do this last,
   once every other mode is confirmed working on the new scoped-generation
   architecture, since Slow's removal depends on the mini-tree (step 4) and
   the gate (step 3) being solid. Sub-order within this step: 10.1 (screen/
   routing removal) → 10.2 (field removal + read-site rewrites) → 10.3
   (heuristic function) → 10.4 (nav index) → 10.5 (export label).

---

## 12. Open questions for Cursor to resolve via repo inspection before coding

- Exact current shape/location of `isScopeGateResolved`, `isScopeStructureReady`,
  and `scopeResolvedAt` — confirm field names and where they live
  (`session-types.js` per prior audits) before writing new checks against
  them, in case naming has drifted.
- Whether `T1.3` (concept graph) is already correctly included in whatever
  phase list `stopAfterScopeGate`/the new hard gate excludes — the audits
  focused on T1.2 onward; confirm T1.3's treatment explicitly since §8
  depends on it.
- The exact current mechanism (if any) guaranteeing `scopedMarkdown`
  concatenation order matches `chosenSectionIds` order — required
  precondition for §6's mini-tree function; verify or fix before building
  on it.
- Whether `pedagogical_meta` shape allows a straightforward copy in the
  mini-tree (§6) or needs recomputation — inspect `hierarchy.js` before
  deciding.

---

## 13. Explicit non-regression checklist

Before considering this spec done, confirm:

- [ ] Create-session path shows the scope question within seconds of upload
      (T0.1–T1.1 only), not after full DPP.
- [ ] No phase in the R1 list executes before `scopeResolvedAt` is set, on
      either create-session or hub-bootstrap entry paths.
- [ ] A document with non-contiguous chosen sections produces correct,
      non-empty Cloze items, Recall questions, and Slow orientation (manual
      spot-check with a real multi-section document).
- [ ] The guide/Socratic chatbot still has full-document context (R3) —
      explicitly verify this was NOT accidentally scoped down by this spec.
- [ ] Choosing "entire document" as scope still works end to end
      (distinguish from the old accidental-full-document-by-default state).
- [ ] `screenSlowScope` is unreachable from any UI path, including the
      former `generateBlocksForm` legacy path (§10.1).
- [ ] Slow reader shows a working navigation index over the resolved scope.
- [ ] `fillable_map`/`checkpoints`/`critical_mode` are no longer user-
      toggleable anywhere; `decideSlowReadingModifiers` output is applied.
- [ ] Export still produces a readable scope label (section titles, not a
      character range).

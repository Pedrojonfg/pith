# Spec: Read Mode (textbook-style exposure mode with embedded visuals)

Status: Draft for Cursor implementation
Date: 2026-07-05
Supersedes: none

## 1. Summary

Introduce a new study mode, `read`, that reuses the entire RSVP block/question
generation pipeline (shared block packing, didactic explanation generation,
question generation, concept inventory linkage, SM-2 ingest, assessment
signals) but replaces the RSVP word-flash presentation with a static,
textbook-style rendering of the full block text. The renderer additionally
supports inline visuals: real document images (already produced by DPP T1.7)
and AI-generated Mermaid diagrams, both positioned at an LLM-chosen anchor
point inside the block text.

## 2. Non-goals

- No anti-skimming mechanisms (timers, forced dwell time, etc.) — explicitly
  deferred to a future spec.
- No user-facing diagram editing.
- No new LLM provider — diagram generation uses DeepSeek like all other chat
  calls (per project convention: DeepSeek for all LLM calls, Gemini reserved
  exclusively for `gemini-embedding-001` and vision).
- No change to RSVP or Questions modes' existing behavior, prompts, or data
  shapes. This spec is strictly additive.
- No retroactive diagram generation for already-completed sessions or for
  blocks the learner never reaches (diagrams are generated lazily, per R5).
- No advanced Mermaid diagram types beyond flowchart, sequence-lite
  (step lists), and simple hierarchy/tree — no user-configurable diagram
  styling.

## 3. Data model changes

### 3.1 New mode key

Add `read` to:
- `MODE_KEYS` in `session-types.js`
- `mode-taxonomy.js` — classify as **exposure** mode (same family as RSVP),
  since it presents content before retrieval, unlike Cloze/Recall/Review
  which are retrieval-first.
- `mode-bootstrap.js` — wire enter/resume handling identically to RSVP's
  bootstrap path, since it consumes the same block source.

### 3.2 New slice: `modes.read`

Shape mirrors `modes.questions` (itself a variant of the RSVP block shape),
since Read mode consumes the same blocks and question data:

```
modes.read: {
  studyMode: "read",
  n_blocks: number,
  blocks: Block[],          // identical Block shape to rsvp/questions
  blocksRef?: { storageKey, count },  // externalization threshold unchanged
  _responses: {...},        // identical to questions/rsvp
  _meta: { knowledge_profile, rev, session_id },
  language: string,
  llmModel: "deepseek",
  materialMeta: {...}
}
```

`Block` shape gains two new **optional** fields, additive only, backward
compatible with RSVP/Questions consumers that ignore unknown fields:

```
Block.visualNeed?: {
  type: "diagram" | "image" | null,
  reason: string,           // short rationale, for debugging/QA only
  insertionAnchor: string   // verbatim substring of block.explanationText
                            // marking insertion point
}

Block.resolvedVisual?: {
  type: "diagram" | "image",
  status: "pending" | "ready" | "failed",
  // for type === "diagram":
  mermaidSource?: string,
  // for type === "image":
  imageId?: string,         // references shared.images[].id
  // shared:
  generatedAt?: number
}
```

`visualNeed` is written once, at block generation time (R3). `resolvedVisual`
is written lazily during prefetch (R5/R4) and starts absent (equivalent to
`status: "pending"` implicitly) until prefetch resolves it.

Rationale for a separate slice rather than reusing `modes.questions`: per
existing convention, each mode tracks its own progress independently even
when block content is structurally identical (RSVP and Questions already do
this). Read mode's progress (which block the learner is on, per-mode
completion tracking for `recommendation/tracker.js`) must not collide with
Questions mode's progress on the same document.

## 4. Block generation: cheap visual-need flag (R3)

Extend the existing `deepSeekGenerateBlockJson` contract (`api.js`) with an
additive field in the requested JSON output — no new LLM call, no new
system-prompt bulk. Add to the existing prompt instructions:

> After the explanation, indicate whether a visual aid would meaningfully
> help a reader understand this specific block. Only mark `true` when the
> content describes a process, a hierarchy, a comparison, or a relationship
> that is easier to grasp visually than in prose. Do not mark `true` for
> purely definitional or narrative content. If true, output the exact
> verbatim substring of your own explanation text after which the visual
> should be inserted.

Output field added to schema:
```json
"visualNeed": {
  "type": "diagram" | "image" | null,
  "reason": "<short string>",
  "insertionAnchor": "<verbatim substring or empty string>"
}
```

`"image"` should only be selected when the block's underlying source section
is known to contain real document figures (see 5.1); otherwise the model
should only ever choose `"diagram"` or `null`. Pass a boolean
`sectionHasImages` hint into the prompt context per block so the model isn't
guessing.

This keeps the token cost of this decision to a handful of extra output
tokens per block, not a duplicated instruction set.

## 5. Visual resolution (lazy, during prefetch)

Reuses the existing next-block prefetch mechanism (`sneakPeek.js` /
`session.js` prefetch path already used by RSVP) — no new scheduling system.
When prefetch resolves block N+1 for Read mode specifically, and
`blocks[N+1].visualNeed.type` is non-null, additionally trigger the
appropriate resolution path below in parallel with the existing prefetch
work. Because prefetch already runs while the learner is engaged with block
N, this hides diagram/image generation latency entirely under normal usage;
no loading spinner is required in the common case. If the learner advances
faster than prefetch completes, the block renders without its visual and
the visual is inserted in place (re-render only that region) as soon as
resolution finishes — do not block the question flow on visual resolution.

### 5.1 Image resolution path

When `visualNeed.type === "image"`:
1. Determine the source section(s) that contributed to this block's
   underlying text (blocks are built from the shared inventory / hierarchy,
   which retains provenance back to `docHierarchy` sections).
2. Query `shared.images[]` for entries whose section/position association
   overlaps that range.
3. If exactly one candidate: attach `resolvedVisual = { type: "image",
   status: "ready", imageId }`.
4. If multiple candidates: pick the one with highest positional overlap;
   log ambiguity for QA (do not surface a picker to the learner in v1).
5. If zero candidates despite `visualNeed.type === "image"` (model
   mis-selected image over diagram): fall back to treating it as `"diagram"`
   silently, or drop the visual entirely and set
   `resolvedVisual = { type: "image", status: "failed" }`. Cursor to choose
   whichever is simpler given how section provenance is currently tracked
   in the block-packing code; flag as an open question below.

### 5.2 Diagram resolution path

When `visualNeed.type === "diagram"`:
1. New dedicated LLM contract in `api.js`: `generateBlockDiagram(blockText,
   conceptLabels, reason)`.
2. This is the **only** place the full Mermaid-authoring system prompt
   lives (syntax rules, examples of flowchart/sequence/hierarchy diagrams,
   instruction to keep diagrams small — under ~8 nodes — for readability on
   mobile). It is never included in the cheap per-block call from Section 4.
3. Temperature: use the project's JSON-output convention (~0.1) since the
   output is structured Mermaid source, not free prose.
4. Explicit `max_tokens` constant per project convention
   (`MAX_TOKENS_DIAGRAM_GENERATION`, suggest 500 — diagrams should be short).
5. Response contract: `{ mermaidSource: string }`. Validate the returned
   string is non-empty and contains a recognized Mermaid diagram type
   keyword (`graph`, `flowchart`, `sequenceDiagram`) before accepting;
   otherwise mark `resolvedVisual.status = "failed"` and do not retry
   automatically (retry policy: none in v1 — a failed diagram silently
   omits the visual, block still renders normally).
6. On success: `resolvedVisual = { type: "diagram", status: "ready",
   mermaidSource, generatedAt }`.

## 6. Rendering (R2)

### 6.1 Screen reuse

Do not create a new top-level screen. Extend `screenTest` (already shared by
RSVP and Questions) with a `renderMode` parameter: `"rsvp" | "paced" |
"read"`. When `"read"`:
- Render the full `block.explanationText` as static text using the same
  typographic component already used by Slow mode's reader
  (`slow/reader.js` — extract/reuse its text-rendering function rather than
  duplicating it, per the project's minimal-intervention and
  no-dead-code-left conventions; do not fork it into a second copy).
- Do not include Slow-mode-specific features (annotations, phase gating,
  margin marks) — Read mode borrows only the typographic rendering, not the
  Slow feature set.
- After the full text render, proceed directly into the same MCQ /
  Socratic flow already used by RSVP/Questions for this block (no new
  question UI).

### 6.2 Visual insertion

Given `block.resolvedVisual` is ready and `visualNeed.insertionAnchor` is a
non-empty string:
1. Locate the first verbatim occurrence of `insertionAnchor` within
   `block.explanationText`.
2. Split the rendered text at the end of that substring; render the visual
   (Mermaid canvas or `<img>` for real document images) immediately after
   that point; continue rendering the remainder of the text below it.
3. **Fallback if the anchor string is not found verbatim** (e.g. the model
   paraphrased instead of quoting exactly): append the visual at the end of
   the block's text rather than failing silently or discarding it. This
   must degrade gracefully — never block rendering on a missing anchor
   match.

### 6.3 Mermaid client library

Add `mermaid` via CDN (matching the project's existing pattern of CDN
imports for MathJax/`marked`) to `index.html`, and add the CDN URL to the
service worker's cached asset list (`sw.js`) so it works under the existing
offline/PWA caching strategy. Bump `SW_VERSION`, the matching `?v=` on
`sw-update.js`/`main.js` in `index.html`, and `CACHE_NAME` together per
`.cursorrules` — this is exactly the version-bump hygiene issue already
flagged as a recurring problem; do not repeat it here.

Render Mermaid diagrams with a dark theme configuration matching
`DESIGN.md` (cold blue-gray base `#111318`, teal accent) rather than
Mermaid's default light theme.

## 7. Mode-select entry point

Add Read mode as a selectable option alongside RSVP/Questions/Slow/Cloze/
Recall on `screenModeSelect`, and make it eligible for
`recommendation/recommender.js`'s `primaryFlow` suggestions using the same
signals RSVP currently qualifies on (the recommender's existing
exposure-mode criteria apply unchanged — Read mode is a same-taxonomy
sibling of RSVP, not a new taxonomy branch).

## 8. Risk-ordered implementation sequence

1. **R1 — Mode plumbing only.** Add `read` mode key, slice shape, taxonomy
   entry, bootstrap wiring. Point it at existing block generation with no
   visual fields yet. Verify a full block → question → next-block loop
   works with zero visual logic, rendering block text as plain paragraphs.
2. **R2 — Textbook renderer.** Extract/reuse Slow's text-rendering
   component into the `screenTest` `"read"` render path. No visuals yet.
3. **R3 — Cheap visual-need flag.** Add `visualNeed` to the existing block
   generation JSON contract. Verify it populates correctly and does not
   inflate token usage materially (spot-check actual DeepSeek usage logs
   before/after).
4. **R4 — Image resolution.** Section-overlap association between
   `shared.images[]` and blocks. Lowest LLM risk (no new generation call),
   but depends on section/position provenance being available at block
   level — confirm this exists before starting (see open question below).
5. **R5 — Diagram generation contract + prefetch wiring.** New
   `generateBlockDiagram` call, hooked into existing prefetch timing.
6. **R6 — Mermaid rendering + anchor-based insertion + fallback handling.**
   Client-side rendering, dark theme, anchor split logic, degradation path.

## 9. Open questions for Cursor (resolve via repo inspection before coding)

- Does block-packing currently retain enough section/position provenance
  per block to implement the image-association overlap in R4 as specified,
  or does that provenance need to be threaded through from
  `docHierarchy`/`normalization` first? If threading is required, treat
  that as a prerequisite sub-step of R4, not scope creep.
- Confirm current `sneakPeek.js` prefetch trigger points (on block-enter?
  on block-N-minus-1 render?) so the diagram/image resolution call is
  attached at the correct trigger without altering RSVP/Questions' existing
  prefetch timing.
- Confirm whether `slow/reader.js`'s text-rendering function is already
  extracted as a standalone reusable unit, or whether extracting it
  requires refactoring that file first (if so, keep that refactor minimal
  and scoped only to what R2 needs).

## 10. Testing checklist

- [ ] Read mode block/question loop completes end-to-end with no visuals
      (R1/R2), producing identical `assessmentSignals` and `smItems`
      behavior to RSVP/Questions for the same document.
- [ ] `visualNeed` flag: spot-check on a sample of real documents that
      `true` is only assigned to process/hierarchy/comparison content, not
      definitional prose (qualitative rubric check, not exact-match).
- [ ] Image association: fixture with known multi-image document — verify
      correct block/image pairing; verify graceful fallback when zero
      candidates found.
- [ ] Diagram generation: verify malformed/empty Mermaid output is caught
      and marked `failed` without crashing the render or blocking question
      flow.
- [ ] Anchor insertion: verify correct split when anchor matches verbatim;
      verify fallback-to-end behavior when anchor is not found.
- [ ] Prefetch timing: confirm visual resolution does not delay the
      question flow when the learner advances before prefetch completes.
- [ ] PWA/version hygiene: confirm `SW_VERSION`, all `?v=` strings, and
      `CACHE_NAME` were bumped together and the Mermaid CDN asset is
      actually cached offline.
- [ ] Dark theme Mermaid rendering matches `DESIGN.md` tokens.

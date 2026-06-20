# RSVP Block Generation — Pedagogical Wiring, Fidelity Toggle & Structured Headers

**Canonical path on repo:** `specs/20260620-rsvp-generation-pedagogy-hardening/spec.md`
**Status:** Draft → ready for Cursor implementation
**Scope:** RSVP block generation pipeline only (`packInventoryToBlocks`, `ensureBlockGenerated`, `deepSeekGenerateBlockJson`, `buildBlockGenerationSystemPrompt`, `source-fidelity.js`). Questions, Slow Mode, Cloze, and Recall are explicitly out of scope unless a rule says otherwise.

---

## 0. Context

This spec closes five gaps surfaced by a pedagogical audit of the RSVP block content generation pipeline (packing → LLM generation → source fidelity → validation → cross-block coherence), and adds one new feature (structured bold section headers). All citations below (`startLine:endLine:filepath`) refer to the audited state of the codebase as of June 2026; **before writing any code, confirm line numbers and exact field/function names are still current** — the audit is a snapshot, not a contract.

The five fixes share a common root cause: **pedagogical machinery that was already built (in the prompt layer) but never wired to the data that should drive it.** This spec is primarily plumbing, not new architecture, except for R5.

---

## 1. Rules

### R1 — Wire pre-packing knowledge profile into block generation config

**Problem.** `packInventoryToBlocks` (`session.js`, ~2583-2756), when called with a `knowledgeProfile`, instructs the pack LLM to set `learning_goal` (`'prerequisite_review'` | `'relational'`) on block index entries (`api.js` ~1346-1358). Nothing downstream reads this field. `_config.gap_focus` and `_config.explanation_profile` — the fields `buildBlockGenerationSystemPrompt` already knows how to consume (gap-focused questions, `brief_deep` recap profile) — are never populated by the current pre-packing flow. The function that used to populate them, `applyAssessmentResults`, is dead code for RSVP and **stays dead** (see Non-goals).

**R1.1.** Before implementing: locate and confirm the exact field name(s) the pack LLM actually returns on block index entries when `knowledgeProfile` is set (`learning_goal`, and any `mastery_adjusted` flag), by inspecting how `deepSeekPackConceptsToBlocks`'s response is parsed in `session.js`. If the parsed field names differ from the prompt text quoted in the audit, use the real ones.

**R1.2.** Implement a pure function — e.g. `mapKnowledgeProfileToBlockConfig(blockIndexEntry) -> { gap_focus: Array, explanation_profile: string|null }` — with this mapping:

| `learning_goal` on block entry | `gap_focus` | `explanation_profile` |
|---|---|---|
| `'prerequisite_review'` | `[{ concept_id, reason: 'prerequisite_review' }]` | `'brief_deep'` (existing ~120-word recap profile already supported by the generation prompt) |
| `'relational'` | `[{ concept_id, reason: 'relational' }]` | `'relational_compressed'` (new value — see R1.2a) |
| absent / no `knowledgeProfile` | `[]` | `null` (current default, unchanged) |

**R1.2a.** If `'relational_compressed'` is not already a value `buildBlockGenerationSystemPrompt` understands, add it: explanation must focus only on how the concept relates to already-covered concepts, with non-relational content compressed to ~40% of the standard word budget (this matches language already present in the pack prompt at `api.js` ~1356 — it is currently descriptive metadata only; this rule makes it operative at generation time).

**R1.3.** Call the mapping function once per block immediately after `packInventoryToBlocks` returns inside `runPrePackingPack` (`study.js`), writing results onto `session.blocks[i]._config` before the blocks-list screen renders. Must not clobber any `_config` fields already set by other code paths.

**R1.4.** Confirm `resolveBlockQuestionConfig` reads `_config.gap_focus` / `_config.explanation_profile` the same way the existing prompt-building logic in `api.js` expects (the gap-focused question rules and `brief_deep` handling already exist in the prompt layer — they were previously only reachable via the dead `applyAssessmentResults` path). Wire the read path if it is missing.

**R1.5.** Manual per-block edits made by the user in `screenBlocksList` take precedence over profile-derived defaults. The profile mapping only sets *initial* values when blocks are first packed — it must never overwrite a value the user edits afterward.

---

### R2 — Restore source fidelity strict/standard as a manual Settings control

**Problem.** `resolveSourceFidelityStrictForSession` (`study.js` ~5254-5260) already supports per-session (`session._meta.source_fidelity_mode`) and global (`state.sourceFidelityStrict`) resolution. The full strict pipeline (claim extraction, stricter coverage thresholds, fidelity retries) is implemented and currently unreachable in the UI. Ghost handlers remain at `ui.js` L565-566 and `study.js` L7348-7351, L9011-9017.

**R2.1.** Add a control to `screenSettings` — a binary choice (Standard / Strict), plain-language labeled, e.g.: *"Strict: stays closer to your source material, may feel terser. Standard: more natural explanations, slightly more interpretive."* On change, persist via `getSourceFidelityStrictPreference()` / a corresponding setter (create the setter if it doesn't exist, mirroring the existing getter's localStorage key) and assign to `state.sourceFidelityStrict`.

**R2.2.** Locate the ghost handlers at the cited lines first and reuse their logic rather than rewriting from scratch — relocate/rewire to the new Settings control.

**R2.3.** Default stays `false` (Standard). This spec does not change default behavior for existing users — it only makes the existing toggle reachable.

**R2.4.** Per-session override (`session._meta.source_fidelity_mode`) is **out of scope**. `resolveSourceFidelityStrictForSession` already falls back to the global toggle correctly when absent — leave that path untouched.

**R2.5.** Bump the PWA service worker version (`sw.js` `CACHE_NAME`, `sw-update.js` `SW_VERSION`, and matching `?v=` query strings in `index.html`) per existing project convention, since this ships new HTML/JS in `screenSettings`.

---

### R3 — Harden question-count enforcement

**Problem.** When the model returns fewer `test`/`socratic` questions than `cfg` requested, `ensureBlockGenerated` only `console.warn`s (`study.js` L5117-5120). The block is shown short, silently, with no retry.

**R3.1.** When parsed question counts fall below `cfg.n_test` / `cfg.n_socratic` after the first generation attempt, trigger exactly **one** retry of `deepSeekGenerateBlockQuestions`, with an explicit instruction stating the required counts and that the previous attempt under-delivered — reuse the existing retry idiom already used for JSON-parse failures and paragraph-count failures in the same function (bounded to one retry, not a loop).

**R3.2.** If the retry still falls short, accept the result (no further retries) but attach diagnostic metadata to the block — e.g. `question_count_status: 'short'` plus actual vs. requested counts. This is diagnostic only; it must never block study flow.

**R3.3.** Follow-on from R1: once `gap_focus` is live and non-empty, a block with non-empty `gap_focus` but zero gap-targeted questions in the generated set is a correctness issue, not a cosmetic one. Fold this into the **same single retry** from R3.1 — the retry instruction should also restate the gap-focus requirement rather than opening a second, separate retry path. Do not exceed one retry total for question-count-and-gap-coverage combined.

---

### R4 — Explicit analogy/fidelity arbitration rule ("Rule D")

**Problem.** `EXPLANATION_PEDAGOGICAL_HEADER` ("use concrete examples, analogies... teach") and `SOURCE_FIDELITY_RULES` ("do not introduce... examples absent from the source") are in unresolved tension. The model currently arbitrates this itself, inconsistently.

**R4.1.** Add the following text to `SOURCE_FIDELITY_RULES` in `source-fidelity.js`, positioned directly after the existing "If the source does not provide an example, contrast, or narrative hook, omit..." bullet (so it reads as a refinement, not a contradiction, of that rule):

> Analogies are permitted, and encouraged, when at least one of the following holds: (a) the analogy connects two concepts that are both already present in the source material; (b) the analogy is explicitly marked as an external comparison (e.g. prefixed "As an analogy:" / "Como analogía:") so the student cannot mistake it for something the source itself says; or (c) the concept is abstract enough that a brief external bridge is genuinely necessary for first-pass understanding, and no equivalent bridge exists in the source. Do not add an analogy by default or out of habit — only when it earns its place under (a), (b), or (c). Even when used, an analogy must never supply facts, data, dates, examples, or claims that get treated as if the source stated them: the analogy illustrates a relationship, it does not become a new factual claim.

**R4.2.** No logic changes beyond inserting this text into the constant. Confirm it is included in every assembled system prompt that already includes `SOURCE_FIDELITY_RULES` (automatic, same injection point — `mergeFidelityIntoSystemPrompt`).

---

### R5 — Structured bold section headers for development blocks

**Problem.** The forced explanation structure (definition → concrete example → implication) is currently implicit prose with no visible signposting, even though the RSVP reader already pauses both before and after bold text. That pause currently fires incidentally on whatever the model happens to bold mid-sentence, rather than deliberately at structural transitions.

**Scope.** Applies only to **development** blocks (per `BLOCK_TYPE_SCOPE` in `mode-taxonomy.js` / `api.js`) generated via `EXPLANATION_RSVP_THOROUGH`. Overview/Course-map and Key-terms/vocabulary blocks are explicitly excluded — unchanged.

**R5.0 — Prerequisite investigation (must complete before writing any prompt text).** Locate the exact mechanism that triggers the pre/post pause on bold text in the RSVP reader (`rsvp.js` and/or `paced-reader.js`). Confirm:
- (a) the markup convention it keys off (`**text**` rendered by `marked` to `<strong>`, or something else);
- (b) that a bold *line* (standalone header, not inline mid-sentence bold) tokenizes and paces correctly — this is a new usage pattern for the existing pause mechanism, not the one it was originally built around;
- (c) whether any per-flash word-count/character limit could be violated by a multi-word header phrase.

Do not proceed to R5.1–R5.6 until this is confirmed.

**R5.1 — Header pool.** Define a fixed pool of 50 header phrases (English; the model translates the *chosen* header into the document's study language at generation time, same as the rest of the explanation — exact wording need not be verbatim-translated, functional meaning must be preserved). The pool is organized into five functional bands:

| Band | Function | Position | Required? |
|---|---|---|---|
| **OPENING** | orient / define what this is | always first | mandatory, exactly 1 |
| **MECHANISM** | how it works / what drives it | middle | optional |
| **EXAMPLE** | concrete case / application | middle | mandatory if source provides one, else the whole section is omitted (never invented) |
| **CONTRAST** | what it's not / common confusion / edge case | middle | optional, only if grounded in source |
| **IMPLICATION** | why it matters / what follows | always last | mandatory, exactly 1 |

**Pool (50 entries):**

*OPENING (12)*
What is it? · The core idea · Defining [concept] · What's actually going on · The basic idea · Where this fits · Setting the stage · What we're talking about · The key distinction · Naming the problem · The starting point · What changed

*MECHANISM (10)*
How it works · The mechanism · Step by step · Under the hood · What drives this · The process · Cause and effect · What makes it happen · The logic behind it · Breaking it down

*EXAMPLE (10)*
A concrete case · In practice · Seeing it in action · A worked example · Applying the idea · The real-world version · Putting it to use · Where you'd see this · A quick illustration · Case in point

*CONTRAST (8)*
What it's not · The common confusion · The exception · Where this breaks down · Versus the alternative · The trap to avoid · A frequent mistake · Where people get this wrong

*IMPLICATION (10)*
Why it matters · What this means · The takeaway · The consequence · What follows from this · Why you should care · The bigger picture · What this enables · The payoff · Connecting the dots

**R5.2 — Selection rules.**
- Exactly one OPENING header, always first; exactly one IMPLICATION header, always last.
- EXAMPLE section included only when the source chunk actually provides a concrete example/case for this concept — same source-fidelity constraint already governing example inclusion (no change to *that* rule; it just now gets a visible header when triggered).
- MECHANISM and CONTRAST are optional add-ins, used only when the block's content genuinely has a separable process/mechanism component or a genuine source-grounded contrast. Never added purely to pad length or hit a header count.
- Total headers per block: minimum 2 (OPENING + IMPLICATION, for thin source material), maximum 4. Never reuse a band twice in one block.
- Never invent a header phrase outside the pool — if nothing fits perfectly, choose the closest pool entry rather than improvising.
- When more than one middle band is used, their order follows the order those ideas actually appear in the source — never reordered for stylistic effect.

**R5.3 — Format.** Each header is a standalone bold line (`**Header Phrase**`), followed by a blank line, the paragraph(s) for that section, then a blank line before the next header. Must remain compatible with existing `\n\n`-paragraph-split logic used elsewhere (see R5.6).

**R5.4 — Word budget.** Replace the fixed "200-300 words maximum" line in `EXPLANATION_RSVP_THOROUGH` with a tiered budget keyed to the number of headers actually used (excluding header text itself from the count):

| Headers used | Total body word budget |
|---|---|
| 2 | 180–260 words |
| 3 | 260–340 words |
| 4 | 320–420 words |

Each section ≥ ~40 words, except CONTRAST sections, which may run shorter (~30–60 words) since they are often a brief caveat rather than a full explanatory beat.

**R5.5 — Validation compatibility.** Check `hasValidExplanationParagraphs` / `enforceExplanationParagraphs` (`api.js` / `normalizeBlockJson`) against the new header+paragraph format and update if they currently assume plain paragraphs with no leading bold header line — a false-fail here would trigger unnecessary retries. Spot-check that `validateBlockFidelity`'s Jaccard/key-term checks aren't meaningfully skewed by the small amount of added header text (expected negligible — confirm, don't assume).

**R5.6 — Connection-hook extraction fix.** `ensureBlockGenerated` currently takes the first `\n\n`-delimited paragraph of the *previous* block's explanation (truncated to 220 chars) as the connection-question hook (`study.js`, `prevBlockSummaryForConnection`). With headers, that first segment is now the OPENING header line, not content. Update the extraction to skip a leading bold-only line and take the first real paragraph instead.

**R5.7 — Non-goals for R5.** No new JSON schema fields — headers live inside the existing `explanation` string. No application to Slow Mode, Cloze, Recall, or Questions-mode generation. No retroactive regeneration of already-generated blocks in existing sessions — forward-only. No retry-enforced pool compliance — a lightweight post-generation header-count check (2–4 bold lines present) may log a warning if violated but must not trigger a retry (stylistic, not correctness-critical — consistent with warn-only treatment elsewhere in this pipeline for non-critical checks).

---

## 2. Non-goals (entire spec)

- No automatic LLM-driven selection of source fidelity mode. R2 is a manual user-facing toggle only; an LLM auto-deciding this is a plausible future direction, explicitly out of scope here.
- `applyAssessmentResults` and its `gap_focus`/`brief_deep` mechanism are **not** revived or called. R1 introduces a new, separate population path for the *same* `_config` fields, sourced from the pre-packing profile rather than post-hoc assessment results.
- No Bloom's-taxonomy-level question-type quotas or difficulty progression.
- No document-wide difficulty ramp across blocks.
- No change to `assessmentSignals` scope (remains Questions-mode-only for reordering).
- No change to the block-count recommender's advisory nature.
- No per-session source-fidelity override UI (R2 is global-only).

## 3. Supersession notes

- This spec supersedes the implicit "leave unwired" posture toward `sourceFidelityStrictToggleBtn` left by `20260618-ui-dead-weight-removal` — that toggle is restored, relocated to `screenSettings`, and becomes a live, documented setting.
- This spec supersedes the fixed "200-300 words maximum" instruction in `EXPLANATION_RSVP_THOROUGH` (`api.js`) with the tiered word budget in R5.4.
- This spec does **not** alter `20260613-source-fidelity`'s strict-mode pipeline logic itself (claim extraction, thresholds) — it only restores the UI path to reach it.

## 4. Implementation sequence (ordered by risk, ascending)

1. **R3** — question-count retry hardening. Isolated, reuses an existing retry pattern, no data-flow changes.
2. **R4** — analogy arbitration rule. Pure prompt-text addition, no logic changes.
3. **R2** — fidelity Settings toggle. UI-only, additive; touches HTML/PWA versioning but no generation logic.
4. **R1** — knowledge-profile → `gap_focus`/`explanation_profile` wiring. Touches the pack→generation data flow; verify the no-profile (default) path is provably unaffected, before and after.
5. **R5** — structured headers. Highest complexity: prompt redesign plus three downstream dependencies (paragraph validation, fidelity validation, connection-hook extraction). Do this last, after R5.0 investigation is complete and R1–R4 are stable.

## 5. Testing checklist

- [ ] R3: force a short-question response → confirm exactly one retry fires with strengthened count instruction; confirm `question_count_status` is attached if still short after retry; confirm study flow is never blocked.
- [ ] R3.3: a block with non-empty `gap_focus` and zero gap-targeted questions on first attempt → confirm the single retry restates the gap requirement (not a second retry path).
- [ ] R4: spot-check generated blocks for analogies — confirm externally-marked analogies use the prefix convention, and confirm no analogy introduces a fact/date/example absent from source.
- [ ] R2: toggle Strict in Settings → generate a block → confirm `resolveSourceFidelityStrictForSession` returns `true` and the strict pipeline (claim extraction, stricter thresholds) actually runs. Toggle back to Standard → confirm reversion. Confirm persistence across reload.
- [ ] R2: run the PWA service-worker validation test after the version bump.
- [ ] R1: generate a session with a pre-packing profile producing both `prerequisite_review` and `relational` blocks → confirm `_config.gap_focus`/`explanation_profile` populate correctly, and the resulting generation prompt actually reflects `brief_deep`/`relational_compressed` behavior (shorter, gap-focused output).
- [ ] R1: generate a session **without** a pre-packing profile → confirm zero behavior change (regression check).
- [ ] R1.5: manually edit a block's config in `screenBlocksList` after profile mapping ran → confirm the manual edit is not overwritten.
- [ ] R5: generate development blocks across varied source materials (process-heavy, comparison-heavy, sparse/thin) → confirm header count varies appropriately (2/3/4), headers come only from the pool, OPENING always first, IMPLICATION always last, and word count matches the tiered budget for the header count used.
- [ ] R5.5: confirm `hasValidExplanationParagraphs` doesn't false-fail on the new header format.
- [ ] R5.6: confirm block-to-block connection questions still produce a coherent hook (not a bold header phrase) after the extraction fix.
- [ ] R5: confirm Key-terms and Overview blocks are unaffected (no headers, unchanged format).
- [ ] Full regression: run the existing `cursor-tests/` suite relevant to RSVP packing/generation/fidelity validation to confirm no existing test is broken by prompt text changes.

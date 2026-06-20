# Deep Dive: RSVP Generation Pedagogy Hardening

## 1. What we built

We closed five gaps in the RSVP block generation pipeline where pedagogical machinery existed in prompts but was never wired to runtime data, plus one new UX feature (structured bold section headers). The work wires pre-packing `learning_goal` into per-block `_config`, restores a global Standard/Strict source-fidelity control in Settings, adds a single bounded retry when the LLM under-delivers questions, inserts an explicit analogy arbitration rule (Rule D), and replaces implicit prose structure with a 50-phrase header pool for development blocks. Scope is RSVP packing → generation only; Slow/Cloze/Recall are untouched.

## 2. Design decisions

### Profile mapping via `_initial_block_config`, not live session mutation

**Chosen:** `mapKnowledgeProfileToBlockConfig` runs after pack and stores `_initial_block_config` on block index entries; session confirm copies it once onto `blocks[i]._config`.

**Alternatives:** Write directly to `session.blocks` after pack (no session exists yet); revive `applyAssessmentResults` (explicitly dead for RSVP).

**Trade-off:** Manual edits in the blocks list before confirm are preserved because profile data never re-applies after session start. If a user re-packs without re-confirming, stale `_initial_block_config` on the index could theoretically linger — acceptable because confirm is the single commit point.

### Pure module split: `block-profile-config.js`

**Chosen:** Extract mapping functions out of `session.js` into a dependency-free module.

**Alternatives:** Keep everything in `session.js`; duplicate test logic in cursor-tests.

**Trade-off:** One more file, but cursor-tests can import pure functions without pulling the entire session/api graph (which breaks Node ESM on CDN `https:` imports).

### Question retry in `ensureBlockGenerated`, not inside `deepSeekGenerateBlockJson`

**Chosen:** After first `normalizeBlockJson`, call `deepSeekRegenerateBlockQuestions` once with `buildQuestionCountRetryInstruction` appended via `userExtra`.

**Alternatives:** Loop inside `api.js` (harder to attach block-level diagnostics); silent accept (status quo).

**Trade-off:** Retry is RSVP-study-path specific; other callers of `deepSeekGenerateBlockJson` unchanged. Gap + count shortfalls share one retry (spec requirement), not two.

### Structured headers as prompt-only change + validation shim

**Chosen:** New `EXPLANATION_RSVP_STRUCTURED_HEADERS` prompt for `deriveBlockType(title) === 'development'` and `profile === 'thorough'`; `hasValidExplanationParagraphs` treats bold header lines as non-body paragraphs.

**Alternatives:** New JSON schema fields for sections (rejected in spec); enforce header pool via retry (rejected — warn-only).

**Trade-off:** Model can still ignore the pool; we only warn via `warnStructuredHeaderCount`. Paragraph validator must stay in sync with header format forever.

### Standard/Strict as radio group, not toggle button

**Chosen:** Replace ghost `sourceFidelityStrictToggleBtn` with labeled radios wired through `wireSourceFidelityStrictUi`.

**Alternatives:** Reuse toggle with better hint text.

**Trade-off:** Slightly more HTML; clearer affordance and matches spec plain-language labels.

### Rule D as prompt text only

**Chosen:** Insert analogy arbitration paragraph into `SOURCE_FIDELITY_RULES` after the omit-if-no-example bullet.

**Alternatives:** Post-generation analogy validator (out of scope).

**Trade-off:** Zero runtime cost; enforcement is entirely model-dependent.

## 3. Concepts applied

| Concept | Where it appears |
|--------|------------------|
| **Pure functions / deterministic mapping** | `mapKnowledgeProfileToBlockConfig`, `formatGapFocusList`, `buildQuestionCountRetryInstruction` — same input → same output, no I/O |
| **Strategy pattern (prompt selection)** | `buildBlockGenerationSystemPrompt` picks among `EXPLANATION_BRIEF_DEEP`, `EXPLANATION_RELATIONAL_COMPRESSED`, `EXPLANATION_RSVP_STRUCTURED_HEADERS`, or legacy thorough based on profile + block type |
| **Bounded retry / circuit breaker** | `ensureBlockGenerated`: exactly one question retry; JSON parse retry already existed as precedent |
| **Diagnostic metadata (non-blocking)** | `question_count_status: 'short'`, actual vs requested counts — observability without blocking study flow |
| **Separation of initial vs user-edited config** | `_initial_block_config` on index vs `_config` on session blocks — one-time hydration pattern |
| **Markdown convention as protocol** | `isBoldHeaderLine` regex `^\*\*[^*\n]+\*\*$` aligns with RSVP reader's `RSVP_BOLD_END_MARKER` pause on bold spans |
| **Re-export facade** | `session.js` re-exports from `block-profile-config.js` so existing import paths keep working |
| **Feature flags / persisted preferences** | `saveSourceFidelityStrictPreference` + `state.sourceFidelityStrict` + `resolveSourceFidelityStrictForSession` chain |
| **PWA cache busting** | Coordinated bump: `SW_VERSION`, `CACHE_NAME`, `index.html ?v=` |

## 4. Technical debt and improvements

**Well done:** Mapping table for `learning_goal` is explicit and testable; gap_focus objects finally format correctly in prompts (previously `String({})` → `"[object Object]"`). Question retry reuses existing regen API with a suffix instead of a parallel code path. Header validation avoids false-fail on the new format without rewriting `enforceExplanationParagraphs`.

**Functional duct tape:** `_initial_block_config` on block index is an ad hoc field not in a formal schema; easy to drop during merge/edit flows if someone adds a new code path that rebuilds index rows. `blockQuestionsNeedRetry` treats total question count vs gap count as a proxy for "gap-targeted" — it does not inspect question text or `concept_id` linkage. Header pool compliance is warn-only console output. `relational_compressed` word-count warning in `warnBlockGenerationProfileMismatch` uses a loose upper bound (140 words), not tiered header budgets.

**Would not scale:** `EXPLANATION_RSVP_STRUCTURED_HEADERS` embeds all 50 phrases inline in every development-block system prompt — token cost grows linearly with pool size. `ensureBlockGenerated` is already a god function; adding retry logic increases regression surface. Import graph: `api.js` now depends on `rsvp-section-headers.js` and `pipeline-levers.js`; heavy modules remain hard to unit-test under Node without the cursor-tests loader shim.

## 5. Consolidation questions

1. When pre-packing sets `learning_goal: 'relational'` on a block index entry, what exact `_config.explanation_profile` and `gap_focus` shape does generation receive, and at which two lifecycle points is that data written?

2. Why does `extractConnectionHookFromExplanation` skip paragraphs matching `isBoldHeaderLine`, and what user-visible bug appears if that skip is removed after structured headers ship?

3. Under what conditions does `ensureBlockGenerated` perform exactly one question retry versus attach `question_count_status: 'short'`, and why is a second retry intentionally forbidden?

## 6. Suggested update for .cursorrules

1. **RSVP block `_config` hydration:** When adding new fields to `blocks[i]._config`, define whether they are profile-derived (set once from `_initial_block_config` at confirm), user-editable (blocks list), or session-default — never re-apply profile mapping after confirm.

2. **Gap focus shape:** Prompt formatters must use `formatGapFocusForPrompt` (or equivalent) for `gap_focus` entries; never `String(g)` on objects.

3. **RSVP explanation structure changes:** Any change to explanation markdown structure (headers, paragraphs) must update both `hasValidExplanationParagraphs` and connection-hook extraction in the same PR.

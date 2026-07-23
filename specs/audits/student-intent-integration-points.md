# Audit: Student Intent / Free-Text Context Integration Points

**Date**: 2026-07-23  
**Status**: research only — no implementation  
**Goal**: Locate storage for an optional onboarding free-text field (student goal / relationship to the document topic) and map which LLM prompts should (or should not) receive it.

Tentative field name: `shared.studentIntent: string` (optional).

---

## 1. Current `shared` shape and proposed placement

There is **no single JSDoc `@typedef SharedLayer`** in `session-types.js`. The shape is the union of:

1. Fields initialized in `createSession()` (`session-store.js` ~510–541)
2. Fields validated in `validateDocumentSession()` (`session-types.js` ~337–458)
3. Fields added later by features / migrations without always being in `createSession`

### 1.1 Effective `shared` inventory (as of schemaVersion 4)

| Field | Type (runtime) | Required | Notes |
|-------|----------------|----------|-------|
| `rawMarkdown` / `rawMarkdownRef` | string / `{storageKey, charCount}` | one of | Canonical document text |
| `scopedMarkdown` | string | yes (v4) | Study subset; defaults to full markdown |
| `scopeSelection` | `ScopeSelection \| null` | yes (v4) | Partial-scope picker |
| `scopeContext` | `string \| null` | yes (v4) | **LLM-generated** 1–3 sentence blurb about selected sections |
| `scopeResolvedAt` | `number \| null` | yes (v4) | Scope gate timestamp |
| `docMeta` | object | yes | `inferDocMeta` title/language/genre |
| `docHierarchy` | object \| null | yes | Tree + often `pedagogical_meta` / `topics` |
| `conceptInventory` | array | yes | Teachable concepts |
| `annotations` | array | yes | Slow-mode (and shared) annotations |
| `smItems` | array | yes | Spaced-memory items |
| `modeRecommendation` | object \| null | optional | Flow recommender output |
| `uploadMeta` | object \| null | optional | File / pack / interview attribution |
| `assessmentSignals` | array | optional | Cross-mode wrong/correct signals |
| `docTopics` | string[] | optional | Vault topic tags |
| `mnemonicDevices` | array | yes (v3 default `[]`) | User-authored only — **never LLM** |
| `images` | array | yes (v3 default `[]`) | Document images |
| `preparation` | object | yes (v3) | DPP frontload status / phases |
| `conceptGraph` | object \| null | optional | Shared epistemic graph |
| `blockRecommendation` | object \| null | optional | RSVP block-count recommendation |
| `slowOrientation` | object \| null | optional | Slow Phase 0 cached orientation |
| `interviewTranscript` | `InterviewTurn[]` | optional | Free-text Q&A turns (nodoc interview) |
| `interviewSynthesisComplete` | boolean | optional | Interview lock flag |
| `knowledgeProfile` | `SharedKnowledgeProfile` | optional | Pre-mode assessment mastery |
| `assessmentGate` | `AssessmentGateState` | optional | accepted / skipped |
| `textMetrics` | object | optional | Analyzer metrics (flow / slow modifiers) |
| `knowledgeBeliefState` | (feature) | optional | Adaptive probing (spec’d) |
| `practicePrep` | (feature) | optional | Practice ontology (spec’d) |

**Related but not on `shared`:**

- `PrimaryLearningGoal` (`understand_argument` \| `memorize_facts` \| …) lives on **document-inferred** `docHierarchy.pedagogical_meta` — not student free-text.
- `studyNotes` (“Comments / study focus”) is **UI/`state` + `localStorage['study_notes']` + optional `_meta.study_notes`**, not `shared`. It already injects into several DPP prompts (see §3).

### 1.2 Proposed placement for `shared.studentIntent`

**Recommendation:** add optional `shared.studentIntent: string | null` next to other **human-authored, document-scoped context** fields — closest siblings:

- `scopeContext` (string context for prompts, but **machine-generated**)
- `interviewTranscript` (human free-text, document-scoped)
- **not** under `docHierarchy.pedagogical_meta` (that is LLM-inferred document genre/goal enum)

Suggested validation (mirror `scopeContext`):

```text
if (sh.studentIntent != null && typeof sh.studentIntent !== "string")
  → error "shared.studentIntent must be string or null"
```

**Conflict check:**

| Existing concept | Conflict? |
|------------------|-----------|
| `pedagogical_meta.primaryLearningGoal` | No — enum inferred from text; studentIntent is user free-text |
| `studyNotes` | **Semantic overlap** — both are optional free-text study focus. Prefer either (a) reuse/rename `studyNotes` into `shared.studentIntent`, or (b) keep studyNotes as ephemeral “this generate run” focus and studentIntent as durable onboarding intent. Do not invent a third parallel channel without clarifying UX. |
| `scopeContext` | No — different meaning (scope role in document) |
| `interviewTranscript` | No — different capture flow |
| `mnemonicDevices` | No — and must stay LLM-free |

Default in `createSession`: `studentIntent: null` (or omit; treat missing as empty).

---

## 2. LLM prompt-building functions — context, intent fit, injection point

Verdict key:

- **Improve** — personalization likely helps tone, depth, framing, or prioritization  
- **Irrelevant** — structural / extractive / fidelity-pure; intent adds noise or tokens for little gain  
- **Hurt** — personalization could bias factual coverage, MCQ fairness, or source fidelity

### 2.1 Core RSVP / Questions pipeline (`src/js/api.js`)

| Function | Current dynamic context | Intent verdict | Injection point (if applicable) |
|----------|-------------------------|----------------|----------------------------------|
| **`buildConceptInventoryPrompt` / `callConceptInventoryLlm` / `deepSeekConceptInventory`** | Material text; optional **`studyNotes`** as separate user message; language; density target; SOURCE_FIDELITY | **Improve (mild)** — already has study-notes channel; studentIntent could prioritize exam vs curiosity concepts. Risk: over-filtering inventory. Prefer same channel as studyNotes, not a second competing message. | `callConceptInventoryLlm` ~1519–1523: user message `Student comments / study focus:\n…` (only when `!chunkLabel`) |
| **`deepSeekConceptInventoryChunk`** | Chunk material + studyNotes passthrough | Same as inventory; chunk path **skips** notes when `chunkLabel` set (~1519) | Same builder; fix gap if intent must apply to map-reduce chunks |
| **`buildMergeConceptInventoriesPrompt` / `deepSeekMergeConceptInventories` / slim merge / semantic dedup** | Partial inventories JSON only | **Irrelevant / slight Hurt** — merge must be deterministic & coverage-complete | Do not inject |
| **`deepSeekSplitIntoBlocks`** | Material; **studyNotes**; target N | **Improve (mild)** — split boundaries by exam focus | ~1328–1332: `Student comments / study focus (follow these preferences when splitting)` |
| **`buildConceptPackPrompt` / `deepSeekPackConceptsToBlocks`** | Inventory JSON; knowledgeProfile; vaultContextBlock; threshold ids; **studyNotes** user msg | **Improve** — pack density / omit leisurely digressions under interview pressure | System: vault append ~2611; user notes ~2740–2744 |
| **`buildBlockGenerationSystemPrompt` / `buildBlockGenerationUserContent`** | Language; n_test/n_socratic; explanation profile; gap_focus; source chunk; vaultHint; previousComment; coverage manifest; fidelity rules | **Improve (strong for explanations + socratic)** — tone, examples, urgency. **Hurt risk for MCQ** if intent steers away from source-faithful options | System: after vaultHint (~3560) or pedagogical header. User: beside `previousComment` (~3588–3590) as parallel “Student intent” line |
| **`deepSeekGenerateBlockJson` / `deepSeekGenerateBlockExplanation` / `deepSeekGenerateBlockQuestions` / `deepSeekRegenerateBlockQuestions`** | Same as block builders + vault session | Same as above | Via `buildBlockGeneration*` (~3449–3606, ~3928+) |
| **`buildQuestionsOnlySystemPrompt` / user content** | Questions-only regen from existing explanation | **Improve (mild)** for socratic stems; **Hurt** for MCQ if over-personalized | Mirror block generation |
| **`deepSeekExtractSourceClaims`** | Source chunk only + SOURCE_FIDELITY | **Hurt** — must stay source-only | Do not inject |
| **`enrichBlockConceptDefinitions` / `buildConceptEnrichment*`** | Block concepts + material | **Irrelevant** — glossary fidelity | Do not inject |
| **`deepSeekAuditBlockIndex` / `deepSeekAuditBlockOverlap` / `deepSeekPostMergeChunk`** | Block index / overlap JSON | **Irrelevant** | Do not inject |
| **`classifyThresholdConceptsLLM`** | Inventory | **Irrelevant** (structural) | Do not inject |
| **`deepSeekGenerateBlockBridge` / `deepSeekSummarySoFar`** | Prior blocks / user prompt | **Improve (mild)** for summary tone | System prompt ~807 / ~839 |
| **`mapBlocksToPages`** | Block index + pages | **Irrelevant** | Do not inject |
| **`generateAssessmentQuestions` / `generateAssessmentSynthesis` / `synthesizeAssessmentGaps`** | Block index / results | **Hurt / Irrelevant** for diagnostic fairness | Do not inject (or only synthesis coach prose) |
| **`deepSeekSocraticTutor`** | blockTitle; question; studentAnswer; scopedMarkdown; backgroundMarkdown; **scopeContext** | **Improve (strong)** — critique framing for interview vs curiosity | System after scope note ~708–714, or user prompt ~733 |
| **`deepSeekReviewSocraticTutor`** | Review session content + student answer | **Improve** | System ~5655 |
| **`deepSeekGenerateReviewBatch`** | sessionContent; optional **`reviewInstructions`** (student focus) | **Improve** — already has free-text channel | User parts ~4488–4491: `Student review focus…` |
| **`generateScopeContext`** | Hierarchy outline + selected titles | **Irrelevant** — describes document structure, not learner | Do not inject |
| **`generatePrePackingAssessmentItems` / `buildPrePackingAssessmentSystemPrompt` / holistic / coverage batch / evaluate responses** | Inventory; edges; material excerpt; n_test/n_socratic | **Hurt** — diagnostic must be content-true, not intent-steered | Do not inject (~4554–4615, ~5247+) |
| **`generateHolisticPrePackingAssessmentItems`** | Same family | **Hurt** | Do not inject |
| **`evaluatePrePackingAssessmentResponses`** | Quiz answers → mastery rows | **Irrelevant / Hurt** | Do not inject |

### 2.2 Recall (`src/js/recall-api.js`, re-exported from `api.js`)

| Function | Current context | Intent verdict | Injection point |
|----------|-----------------|----------------|-----------------|
| **`buildRecallQuestionsSystemPrompt` / `generateRecallQuestions`** | Inventory; material excerpt; weakConceptIds; **`primaryLearningGoal`** (from pedagogical_meta) | **Improve** — applicative vs argumentative balance; interview scenarios | Append after goal line ~209 or weakBlock ~200–202; wire through `generateRecallQuestions` ~425 |
| **`deepSeekRecallTutor`** | Question; student_answer; concept defs; source_chunk | **Improve (mild)** for critique tone; keep quality rubric source-grounded | System ~509 after rubric, before JSON schema |

### 2.3 Cloze pipeline (`src/js/cloze/pipeline.js`)

| Function | Current context | Intent verdict | Injection point |
|----------|-----------------|----------------|-----------------|
| **`generateEpistemicGraph`** (phase 0) | Material only | **Irrelevant / Hurt** — graph must reflect text | Do not inject (~183) |
| **`analyzeSemanticCandidates`** (phase 1) | Graph + material | **Irrelevant** | Do not inject (~239) |
| **`generateBaseItems`** (phase 2) | Analysis + material | **Irrelevant / slight Hurt** — blanks must be text-faithful | Do not inject (~293) |
| **`generateDistractors`** (phase 3) | Items + graph nodes | **Irrelevant / Hurt** — distractor quality is structural | Do not inject (~367) |
| **`qaCalibrateItems`** (phase 4) | Items + graph | **Irrelevant** | Do not inject (~429) |

### 2.4 Slow mode Phase 0 (`src/js/slow/phase0.js`)

| Function | Current context | Intent verdict | Injection point |
|----------|-----------------|----------------|-----------------|
| **`buildPhase0SystemPrompt` / `generatePhase0Single` / `generatePhase0ForScope`** | Scope text; optional tree summary; criticalMode; language | **Improve (mild)** for `guideQuestion` framing; **Hurt** if intent warps thesis/argumentMap away from author | Optional short block in system (~215) or user (~256): “Student intent (do not alter thesis): …” |
| Chunk / synthesis Phase 0 prompts | Partial maps | Same caution | Same pattern |

### 2.5 Vault / import / curation (`src/js/api.js` + `vault/prompt-injection.js`)

| Function | Current context | Intent verdict | Injection point |
|----------|-----------------|----------------|-----------------|
| **`extractVaultCandidates`** | Concepts + source chunks + batchContext areas/facets | **Irrelevant** — vault definitions must stay source-faithful | Do not inject (~5906) |
| **`normalizeConceptsToVault`** | Existing vault + new concepts | **Irrelevant** | Do not inject |
| **`extractConceptsFromImportText`** | Student free-text of what they *know* | N/A — different free-text (knowledge claim, not goal) | Precedent only (§3) |
| **`detectMisconceptionPattern` / `inferCrossDocumentPrerequisites` / temporal / influence** | Vault entries | **Irrelevant** | Do not inject |
| **`buildVaultContextBlock` / `buildBlockVaultHint`** | Cross-doc mastery bands | Orthogonal personalization channel (mastery, not intent) | Could *later* append studentIntent in callers of pack/block, not inside vault builder |

### 2.6 Other notable LLM call sites (outside strict `api.js` list)

| Location | Current context | Intent verdict | Injection point |
|----------|-----------------|----------------|-----------------|
| **`guide-chat.js` `buildGuidePrompt`** | Chat history; material; dual scope + **scopeContext** | **Improve (strong)** | After scope note ~109–113 |
| **`interview/interview-api.js`** | Transcript free-text; bookMeta description | Interview *is* free-text capture; studentIntent less relevant once transcript exists | Optional on first follow-up only |
| **`normalization/hierarchy.js` `buildHierarchyUserPrompt`** | Full markdown → tree + pedagogical_meta | **Hurt** — structural offsets + inferred genre must ignore learner goals | Do not inject (~231) |
| **`slow/ai-context.js` `askSlowReaderIA`** | Read-so-far + user query | **Improve (mild)** | System ~15–32 |
| **`slow/phase3.js` retrieval / devil’s advocate** | Annotations / argument map | **Improve (mild)** for application framing | Prompt templates in phase3 |
| **Practice ontology extract** (`practice-ontology/extract-steps.js`) | Procedure text | **Irrelevant** unless intent is “learn procedure for job” | Optional later |

### 2.7 Priority summary (design recommendation)

| Priority | Inject studentIntent? | Rationale |
|----------|----------------------|-----------|
| High | Block explanations, Socratic tutor, guide chat, recall question gen, pack (+ studyNotes channel), review batch | Learner-facing generative pedagogy |
| Medium | Concept inventory / split (via existing studyNotes path), Phase 0 guideQuestion only | Prioritization without rewriting facts |
| Do not | Pre-packing MCQ assessment, source claims extract, cloze graph/items/distractors, hierarchy, vault extract/normalize, merge/dedup/audit | Fidelity, fairness, structural correctness |

---

## 3. Precedents for free-form user context in prompts

Follow these patterns for consistency.

### 3.1 `studyNotes` — closest precedent (reuse pattern)

- **UI**: `index.html` `#studyNotesInput` — “Comments / study focus (optional)” with placeholder about exam focus.
- **Storage**: global `localStorage['study_notes']` + in-memory `state.studyNotes`; sometimes copied to `session._meta.study_notes` (not `shared`).
- **Injection idiom** (extra **user** message, not buried in system):

```text
Student comments / study focus:
${notes}
```

Seen in:

- `deepSeekSplitIntoBlocks` — `api.js` ~1328–1332  
- `callConceptInventoryLlm` — `api.js` ~1519–1523  
- `deepSeekPackConceptsToBlocks` — `api.js` ~2740–2744  

**Design implication:** `studentIntent` should use the **same labeling and message-role pattern**, or **absorb/replace** studyNotes into durable `shared.studentIntent` so DPP and tutors share one source of truth.

### 3.2 `previousComment` — per-block free-text

- `buildBlockGenerationUserContent` ~3588–3590:  
  `The student had this comment after the previous block:\n${previousComment}\nTake it into account…`  
- Ephemeral session flow, not persisted on `shared`.

### 3.3 `reviewInstructions` — review generation

- `deepSeekGenerateReviewBatch` ~4488–4491:  
  `Student review focus (follow these preferences when generating questions):\n…`

### 3.4 `scopeContext` — string context on `shared` (but LLM-authored)

- Generated by `generateScopeContext`; stored `shared.scopeContext`.
- Injected into Socratic tutor and guide chat as `Scope note: ${scopeContext}` (`api.js` ~708; `guide-chat.js` ~112).
- **Pattern to copy for storage**: optional string on `shared`, null default, type-checked in validate, injected as a short labeled appendix.
- **Difference**: studentIntent is **user-authored**, not generated.

### 3.5 Vault context block — structured personalization channel

- `vault/prompt-injection.js` `buildVaultContextBlock` appends  
  `GLOBAL KNOWLEDGE CONTEXT (from user's cross-document study history):…`  
  onto pack system prompts; block hints via `buildBlockVaultHint`.
- Precedent for a **named, clearly labeled context appendix** with instructions on how to use it (calibrate depth, don’t invent).

### 3.6 `interviewTranscript` — free-text on `shared`

- Typed as `InterviewTurn[]` (`session-types.js`); stored on `shared`; fed wholesale into interview follow-up / synthesis prompts (`interview-api.js`).
- Shows that **human free-text belongs on `shared`**, validated when present, without being part of pedagogical_meta.

### 3.7 `extractConceptsFromImportText`

- Free-text describing what the student **already knows** → concept extraction.
- Precedent for treating student prose as first-class LLM input — different semantics from “goal/intent.”

### 3.8 `mnemonicDevices`

- On `shared`, user-authored; **explicitly never passed to LLM** (workspace rule). Not a prompt-injection precedent.

### 3.9 `primaryLearningGoal` (pedagogical_meta)

- Enum inferred from document by hierarchy LLM; consumed by recall (`buildRecallQuestionsSystemPrompt`) and flow recommender.
- **Do not overload** with free-text; keep studentIntent separate. Optionally *map* intent → soft bias alongside the enum.

### Recommended injection template (consistency)

Prefer a single labeled appendix (system or dedicated user message), English heuristics:

```text
STUDENT INTENT (optional; from onboarding — calibrate examples, depth, and urgency;
do not invent facts absent from the source material):
"""
${studentIntent}
"""
```

Align wording with existing “Student comments / study focus” if merging channels.

---

## 4. Schema migration concerns (`session-store.js`)

### 4.1 Current versioning

| Version | Migration | What it forces |
|---------|-----------|----------------|
| 2 | baseline unified session | — |
| 3 | `migrateSessionV3` | `preparation` default; `conceptGraph` promotion; `globalConceptId` on inventory/signals; `mnemonicDevices=[]`; `images=[]`; bump to 3 |
| 4 | `migrateSessionV4` | `scopeSelection`, `scopedMarkdown`, `scopeContext`, `scopeResolvedAt` defaults; bump to 4 |
| New sessions | `createSession` | `schemaVersion: 4` |

`validateDocumentSession` accepts `schemaVersion` ∈ `{2, 3, 4}`.

### 4.2 Does `shared.studentIntent` require a schemaVersion bump?

**No bump required** if treated as optional additive string:

- Absent / `undefined` / `null` ⇒ no intent (same as empty).
- Validation only when present (`typeof === "string"`), matching `interviewTranscript` / optional fields that were **not** alone sufficient to invent a new schema version.
- Load path (`normalizeLoadedSession`) does not need to rewrite old sessions.

**Optional v5 bump** only if you want:

1. `createSession` + migrate to always set `studentIntent: null` explicitly (like v4 did for `scopeContext`), and/or  
2. A hard contract that every persisted session enumerates the field for tooling/export.

That is a **process preference**, not a correctness requirement. Prefer **no bump** for a nullable optional string unless the feature already plans other v5 shared fields.

### 4.3 Migration checklist (when implementing)

1. JSDoc / data-model note for `shared.studentIntent`.  
2. `validateDocumentSession` type guard.  
3. `createSession` default `null` (optional).  
4. **No** need to touch `migrateSessionV3` / `V4` unless bumping to v5.  
5. Clarify relationship to `studyNotes` (wire intent into the same prompt sites, or migrate studyNotes → shared).  
6. Do **not** clear `studentIntent` in SW update / cache invalidation flows.  
7. Pack export/import: decide whether intent travels with packs (probably **no** — personal, not material).

---

## 5. Open design questions (out of scope for this audit)

1. Is onboarding intent **per document** only, or also a global user profile? (`shared` implies per-doc.)  
2. Should filling studentIntent **supersede** the existing study-notes textarea, or coexist?  
3. Max length / sanitization before prompt injection (studyNotes currently unbounded aside from practical LLM limits)?  
4. Does changing intent invalidate DPP caches / `preparation.fingerprint` the way studyNotes edits already trigger invalidation?

---

## Sources (primary)

- `src/js/session-types.js` — validation, InterviewTurn, PedagogicalMeta, resolveChatScopeFields  
- `src/js/session-store.js` — createSession shared init; migrateSessionV3/V4  
- `src/js/api.js` — inventory, pack, block gen, Socratic, assessment, vault, review  
- `src/js/recall-api.js` — recall questions + tutor  
- `src/js/cloze/pipeline.js` — phases 0–4  
- `src/js/slow/phase0.js` — Phase 0 orientation  
- `src/js/vault/prompt-injection.js` — vault context appendix pattern  
- `src/js/guide-chat.js`, `src/js/interview/interview-api.js`  
- Specs: `20260609-unified-session/data-model.md`, `20260618-document-preparation-frontload`, `20260620-nodoc-interview-capture`, `20260702-shared-pre-mode-assessment`

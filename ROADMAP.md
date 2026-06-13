# ROADMAP — Global Knowledge Vault (Phase A+)

**Feature**: `20260618-knowledge-vault-a-plus` | **Spec**: `specs/20260618-knowledge-vault-a-plus/spec.md` | **Plan**: `specs/20260618-knowledge-vault-a-plus/plan.md`

**Objective**: Persistent cross-document knowledge store with mastery decay, LLM concept deduplication, prerequisite elevation, and prompt/assessment calibration. Useful from T03 (debug UI) even before normalization.

## Task table

| ID | Description | Deps | Complexity | Status |
|----|-------------|------|------------|--------|
| T01 | `vault-store.js` + `mastery-model.js` — CRUD, decay, signal weights | — | M | [x] |
| T02 | `session-close.js` — observation collection without LLM normalization | T01 | M | [x] |
| T03 | Debug UI — settings Knowledge Vault panel | T02 | M | [x] |
| T04 | `normalization.js` + `normalizeConceptsToVault()` in api.js | T02 | L | [x] |
| T05 | `prompt-injection.js` + api.js pack/block prompt extensions | T04 | M | [x] |
| T06 | `prerequisites.js` — elevate RSVP prerequisite_ids | T04 | S | [x] |
| T07 | `docTopics` — extend buildDocumentHierarchy + session-types | — | M | [x] |
| T08 | Assessment pre-fill — presumed_known from vault | T04, T07 | M | [x] |
| T09 | cursor-tests + quickstart QA closure | T01–T08 | M | [x] |

## Dependency graph

```text
T01 ──→ T02 ──→ T03
T01 ──→ T04 ──┬──→ T05
              ├──→ T06
              └──→ T08
T07 ───────────────→ T08

T01–T08 ──→ T09
```

**Parallel from start**: T01 + T07 (up to 2 agents)

**Parallel wave 2** (after T02): T03 + T04 (2 agents)

**Parallel wave 3** (after T04): T05 + T06 + T08 (3 agents; T08 also needs T07)

## Recommended execution order

### Wave 0 — Foundation (2 parallel agents)
- **T01** Vault store + mastery model
- **T07** Document topic tags

### Wave 1 — Ingestion (1 agent)
- **T02** Session-close pipeline (no LLM dedup yet)

**Checkpoint**: Study a doc, exit session, vault fills with raw concept names.

### Wave 2 — Visibility + dedup (2 parallel agents)
- **T03** Debug UI
- **T04** LLM normalization

**Checkpoint**: Two docs same topic → shared concepts merge in debug UI.

### Wave 3 — Consumption (3 parallel agents)
- **T05** Prompt injection (pack + block generation)
- **T06** Prerequisite elevation
- **T08** Assessment presumed-known pre-fill

### Wave 4 — Closure
- **T09** Tests + QA

**Minimum useful MVP**: T01 + T02 + T03 — vault populates and is inspectable.

---

## PROMPT T01 — Vault store + mastery model

Implement **T01** from this ROADMAP (Global Knowledge Vault A+).

**Context**: Feature spec `specs/20260618-knowledge-vault-a-plus/spec.md`. Data model `specs/20260618-knowledge-vault-a-plus/data-model.md`. Contracts: `contracts/vault-store-api.md`, `contracts/mastery-model.md`. Research constants in `research.md` (ALPHA=0.3, LAMBDA=0.05, signal weight table).

**Create files**:
- `src/js/vault/vault-store.js` — loadVault, saveVault, upsertEntry, getEntryById, addSource, clearVault, exportVaultJson, getEntriesByTopic (flexible substring topic match)
- `src/js/vault/mastery-model.js` — OBSERVATION_WEIGHTS, updateMastery, getCurrentMastery, getMasteryLabel, hydrateMastery, PRESUMED_KNOWN_THRESHOLD=0.7

**Rules**:
- Empty/corrupt localStorage → empty vault, no throw
- `mastery` is runtime-only; persist masteryBase + masteryLastUpdated
- Split storage at ~300KB following existing large-session localStorage pattern
- All comments and exports in English

**Do NOT** wire study.js yet — pure modules only.

**Success criteria**: Pure functions testable in Node; 7-day decay lowers getCurrentMastery without new observation. Run `/validate` before closing this message.

---

## PROMPT T02 — Session-close pipeline (no normalization)

Implement **T02** from this ROADMAP. Depends on **T01**.

**Context**: Contract `specs/20260618-knowledge-vault-a-plus/contracts/session-close-pipeline.md`. Phase rollout: skip LLM steps 4–5; create entries with canonicalTitle = concept.title from conceptInventory.

**Create**:
- `src/js/vault/session-close.js` — updateVaultFromSession(session, mode): filterNewConcepts, collectObservations, applyObservations, persistVault

**Modify**:
- `src/js/study.js` — call updateVaultFromSession on session exit (leave study screen, mode switch with saveable state). Fire-and-forget; do not block navigation.

**collectObservations** sources:
- `session.shared.assessmentSignals` (mode-continuity)
- Pre-packing assessment outcomes if present in session meta
- Block responses (MCQ/Socratic) from RSVP slice — map to ObservationType per contract

**Rules**:
- One vault entry per conceptInventory item on first close (sources array with docId + conceptId)
- Update lastSeen on repeat sessions

**Success criteria**: After RSVP session + exit, localStorage `mylearning_knowledge_vault` has entries with observations. Run `/validate` before closing this message.

---

## PROMPT T03 — Debug UI

Implement **T03** from this ROADMAP. Depends on **T02**.

**Context**: Contract `specs/20260618-knowledge-vault-a-plus/contracts/debug-ui.md`. Quickstart scenario 1.

**Create**:
- `src/js/vault/debug-ui.js` — renderVaultPanel, renderDetail, handleClear, handleExport

**Modify**:
- `index.html` — Settings area: button "Knowledge Vault", container for table/modal
- `src/css/main.css` — table, mastery bar, filter dropdown
- Wire open handler from existing settings screen (same area as API key)

**UI** (English strings):
- Header: `Knowledge Vault — N concepts`
- Columns: Concept, Topic, Mastery (%), Last seen, Sources
- Topic filter dropdown
- Row click → detail (aliases, prerequisites, recent observations)
- Buttons: Clear vault (confirm), Export JSON

**PWA**: If touching src/js, index.html, or css — bump SW_VERSION and ?v= per .cursorrules.

**Success criteria**: After T02 flow, panel shows populated table; export valid JSON; clear empties vault. Run `/validate` before closing this message.

---

## PROMPT T04 — LLM normalization

Implement **T04** from this ROADMAP. Depends on **T02**.

**Context**: Contracts `contracts/normalization-llm.md`, `contracts/session-close-pipeline.md` (enable steps 4–5).

**Create**:
- `src/js/vault/normalization.js` — mergeNormalizationResult(vault, mappings, newConcepts, docTopics, docId)

**Modify**:
- `src/js/api.js` — normalizeConceptsToVault({ existingEntries, newConcepts, topic }) with English LLM prompt; JSON-only response
- `src/js/vault/session-close.js` — call normalization when new concepts exist; empty vault → all-new without LLM; on LLM error → fallback all-new

**Rules**:
- existingEntries input: metadata only (id, canonicalTitle, aliases)
- merge adds source; alias adds alias string + source; new creates entry with UUID
- Topic filter via getEntriesByTopic before LLM call

**Success criteria**: Two docs same topic → chain rule appears once with 2 sources (SC-001). Empty vault does not error. Run `/validate` before closing this message.

---

## PROMPT T05 — Prompt injection (pack + blocks)

Implement **T05** from this ROADMAP. Depends on **T04**.

**Context**: Contract `specs/20260618-knowledge-vault-a-plus/contracts/prompt-injection.md`.

**Create**:
- `src/js/vault/prompt-injection.js` — getVaultContextForDoc, buildVaultContextBlock, buildBlockVaultHint

**Modify**:
- `src/js/api.js`:
  - `buildConceptPackPrompt()` — append buildVaultContextBlock when docTopics + vault entries exist
  - Block generation context (ensureBlockGenerated / buildBlockGenerationContext) — append buildBlockVaultHint for block concept_ids

**Rules**:
- English prompt sections only
- Mastered ≥0.7, partial 0.3–0.7, unstable prereqs: dependents.length > 0 && mastery < 0.5
- No behavior change when vault empty

**Success criteria**: Pack prompt log/sniff includes GLOBAL KNOWLEDGE CONTEXT when vault populated; block gen includes mastery hint. Run `/validate` before closing this message.

---

## PROMPT T06 — Prerequisite elevation

Implement **T06** from this ROADMAP. Depends on **T04**.

**Context**: Contract `specs/20260618-knowledge-vault-a-plus/contracts/prerequisites-elevation.md`.

**Create**:
- `src/js/vault/prerequisites.js` — elevatePrerequisiteRelations, addPrerequisiteRelation

**Modify**:
- `src/js/vault/session-close.js` — call elevatePrerequisiteRelations after applyObservations

**Rules**:
- Use concept.prerequisite_ids from shared.conceptInventory
- Sync prerequisites + dependents arrays bidirectionally
- Cycles allowed — do not resolve

**Success criteria**: After two docs with shared prereqs, vault detail shows prerequisite links. Run `/validate` before closing this message.

---

## PROMPT T07 — Document topic tags

Implement **T07** from this ROADMAP. Independent — can run parallel with T01.

**Context**: research.md Decision 4; data-model docTopics field.

**Modify**:
- `src/js/api.js` — extend buildDocumentHierarchy LLM prompt/output schema with `"topics": ["string"]` (2–5 tags, document language OK for tags)
- `src/js/session-types.js` — document shared.docTopics: string[]
- Session save path — persist docTopics on hierarchy build (study.js or session.js wherever hierarchy is stored)

**Rules**:
- No extra LLM call — piggyback on existing hierarchy call
- Default docTopics [] for legacy sessions

**Success criteria**: New upload stores docTopics on session.shared; visible in session export. Run `/validate` before closing this message.

---

## PROMPT T08 — Assessment presumed-known pre-fill

Implement **T08** from this ROADMAP. Depends on **T04** and **T07**.

**Context**: Contract prompt-injection.md assessment section; FR-010; SC-004.

**Modify**:
- Pre-packing assessment UI flow in `src/js/study.js` (and related assessment UI files from rsvp-assessment-reposition)
- Use getVaultContextForDoc(session.shared.docTopics)
- Concepts with getCurrentMastery ≥ 0.7 → show presumed_known UI (check icon); user can override
- On submit, contradictions emit assessment_partial / assessment_unknown observations into vault via session-close or inline observation helper

**Rules**:
- Empty vault → unchanged assessment UX
- Do not skip assessment entirely

**Success criteria**: Third doc same topic shows presumed-known markers; override works; vault records contradiction. Run `/validate` before closing this message.

---

## PROMPT T09 — Tests + QA closure

Implement **T09** from this ROADMAP. Depends on **T01–T08**.

**Context**: `specs/20260618-knowledge-vault-a-plus/quickstart.md` — all scenarios.

**Create**:
- `cursor-tests/20260618_knowledge-vault-a-plus.mjs`

**Cover**:
- updateMastery + getCurrentMastery decay (7+ days)
- OBSERVATION_WEIGHTS mapping
- getEntriesByTopic flexible match
- mergeNormalizationResult merge/alias/new
- elevatePrerequisiteRelations bidirectional sync
- empty vault normalization fallback
- clearVault removes all keys

**Update**:
- Mark all ROADMAP tasks [x] when passing
- Mark spec quality items in quickstart as verified

**Success criteria**: `node cursor-tests/20260618_knowledge-vault-a-plus.mjs` passes; quickstart scenarios 1–8 documented as PASS/FAIL. Run `/validate` before closing this message.

---

## Execution instruction

1. **Launch first** (parallel): **PROMPT T01** + **PROMPT T07**
2. **Wait** for T01 before **T02**
3. **After T02**: launch **T03** + **T04** in parallel
4. **After T04** (and T07 for T08): launch **T05** + **T06** + **T08** in parallel
5. **After all pass**: **T09** alone

Minimum path to first validation: T01 → T02 → T03 (~3 sequential steps).

Each prompt ends with: run `/validate` before closing.

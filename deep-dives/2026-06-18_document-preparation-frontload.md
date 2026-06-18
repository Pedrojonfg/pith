# Deep Dive — Document Preparation Front-Load (DPP)

**Date:** 2026-06-18

## 1. What we built

Uploading a document now triggers a **Document Preparation Pipeline (DPP)** that runs reusable LLM work once into `DocumentSession.shared`: hierarchy, concept inventory, epistemic graph, block-count recommendation, flow recommendation, vault concept linking, and Tier-2 artifacts (Cloze items, Recall questions, Slow Phase 0 orientation). Study modes consume these cached artifacts so RSVP opens with recommended block count, Cloze/Recall skip re-generation, and Slow reuses orientation. Progress is resumable, idempotent per phase, and surfaced as library badges (Preparing / Ready / Partial / Failed).

## 2. Design decisions

### Central orchestrator module (`document-preparation.js`)

**Chosen:** Single async orchestrator with explicit phase IDs, dependency waves, and `Promise.allSettled` per wave.

**Alternatives:** Inline everything in `study.js`; or a service-worker batch.

**Why rejected:** `study.js` is already huge; SW cannot access LLM API keys on the main thread pattern used today.

**Trade-off:** One more import hub; but testable phases and clear spec mapping (T0.x / T1.x / T2.x).

### Canonical `shared.conceptGraph`

**Chosen:** Epistemic graph lives in `shared.conceptGraph`; Cloze slice gets a projection on bootstrap.

**Alternatives:** Keep graph only on `modes.cloze.epistemicGraph`.

**Why rejected:** Spec FR-012 — Recall, vault, and future modes need graph without entering Cloze.

**Trade-off:** Dual-write during prep (shared + cloze slice); migration copies legacy cloze graph → shared.

### Preparation status model (`ready | partial | failed | legacy | …`)

**Chosen:** Tier 1 complete ⇒ at least `partial`; all Tier 2 success ⇒ `ready`; offline ⇒ `partial` after Tier 0 path.

**Alternatives:** Binary ready/not.

**Why rejected:** Spec FR-050/051 and progressive readiness (enter RSVP while Tier 2 still running).

**Trade-off:** Mode entry must handle `partial` with artifact presence checks, not status alone.

### Fingerprint = markdown + studyNotes

**Chosen:** `computePreparationFingerprint` hashes normalized markdown + study notes (aligned with block-split cache invalidation).

**Alternatives:** File metadata fingerprint only.

**Why rejected:** Study focus notes change inventory semantics (spec edge case).

**Trade-off:** Editing notes after prep should invalidate Tier 1+2 — wired in spec, full rerun on note change is v1 default but not all UI paths trigger yet.

### RSVP Recommend button vs shared `blockRecommendation`

**Chosen:** Auto-fill N from shared when prep ≥ partial; skip inventory LLM on generate when cache fingerprint matches.

**Alternatives:** Keep on-demand Recommend as primary path.

**Why rejected:** Core UX promise (US2) — eliminate extra inventory wait.

**Trade-off:** `maybeAutoRecommendBlockCount` and `handleRecommendBlockCount` must short-circuit when shared rec exists.

## 3. Concepts applied

| Concept | Where |
|--------|--------|
| **Directed acyclic graph (DAG) scheduling** | `PHASE_DEPS` + `buildWaves()` in `document-preparation.js` — topological waves for parallel execution |
| **Idempotent pipeline / content addressing** | `phaseSucceeded()` compares `outputHash` + `fingerprint` before skipping a phase |
| **Promise aggregation** | `Promise.allSettled` per wave — partial failure does not abort independent phases |
| **Schema migration** | `migrateSessionV3` in `session-store.js` — backfill `preparation.status = legacy`, copy cloze graph |
| **Bootstrap vs resume state machine** | `resolveModeEntryState` in `mode-bootstrap.js` — prep-aware entry kinds |
| **Cache-aside pattern** | `shared.blockRecommendation` + `blockSplitCache` on RSVP create — pack uses cached inventory |
| **Facade / orchestration** | `startDocumentPreparation()` in `study.js` — thin wiring over DPP |

## 4. Technical debt and improvements

**Well done**

- Phase IDs map 1:1 to spec Pipeline Contract — easy to extend or stop early (`stopAfterTier: 1` for ingest-only).
- Pure helpers (`computePreparationFingerprint`, `normalizePreparationState`, badge label) are unit-testable without DOM.
- Legacy sessions migrate without breaking validation.

**Functional duct tape**

- `runPhaseT12` calls `addConceptsToShared` after setting inventory — possible duplicate promotion paths vs `promoteConceptInventoryToShared` in study.js.
- Slow orientation cache is full-document only; scope-narrower re-orientation deferred to v2 (spec Out of Scope).
- `recommendFlowFromUploadedFile` removed duplicate hierarchy call but DPP is fire-and-forget — mode select may render before Tier 1 completes (progressive readiness OK per spec, but RSVP open before inventory exists still falls back to old Recommend path).

**Would not scale**

- All prep runs in main thread sequentially per wave; very long docs still sum all LLM calls (NFR-003 caps duplicate work, not total tokens).
- `saveActiveSession` after every phase — fine for localStorage, heavy for future remote sync.
- Circular import risk: `mode-bootstrap` → `study.js` → … — pre-existing, worsened if DPP imports study.

## 5. Consolidation questions

1. When `preparation.status` is `partial` but Tier 1 failed (no inventory), what should `resolveModeEntryState` return for RSVP — and where is that branch tested in production?
2. How does changing `studyNotes` after prep invalidate `shared.preparation.fingerprint` and trigger Tier 1 rerun — is there a single hook or is it still manual?
3. If T1.3 (graph) succeeds but T1.2 (inventory) fails, can T2.1 Cloze prep run, and what does the Cloze slice contain?

## 6. Suggested `.cursorrules` additions

1. **DPP tier boundary:** Tier 3 work (`packInventoryToBlocks`, pre-packing assessment, `ensureBlockGenerated`) MUST NOT be called from `document-preparation.js` — only from mode study paths.
2. **Prep consumption:** Mode entry MUST check `shared.preparation` + artifact presence before triggering legacy inventory/graph LLM calls.
3. **New shared fields:** Any new `DocumentSession.shared.*` field used by DPP requires migration in `migrateSessionV3`, default in `createSession`, and an entry in `specs/20260618-document-preparation-frontload/data-model.md`.

# Technical Audit Findings — 2026-07-06

## Scope And Assumptions

- This audit is source-of-truth from code only (`src/js/**`, `cursor-tests/**`), not from specs/docs.
- "No automated tests" is defined here as: module not referenced by path or basename in `cursor-tests/*.mjs`.
- Test coverage mapping method can undercount dynamic/import-indirect coverage; this report treats unreferenced modules as untested unless directly evidenced otherwise.
- Existing workspace changes were not modified; this is an audit-only pass.

## Untested Modules Inventory (Current Snapshot)

The following modules are currently unreferenced by automated tests:

1. `src/js/adaptive-probing/assessment-integration.js`
2. `src/js/adaptive-probing/belief-persist.js`
3. `src/js/concept-anchoring.js`
4. `src/js/concept-registry/dedup-gates.js`
5. `src/js/concept-registry/graph-mount.js`
6. `src/js/concept-registry/mastery.js`
7. `src/js/dev/wipe-user-data.js`
8. `src/js/document-images/extract-html.js`
9. `src/js/document-images/prepare-markdown.js`
10. `src/js/document-images/render.js`
11. `src/js/document-images/storage.js`
12. `src/js/interview/interview-api.js`
13. `src/js/llm-usage-log.js`
14. `src/js/mc-keyboard.js`
15. `src/js/normalization/heading-text.js`
16. `src/js/normalization/plain-text-blocks.js`
17. `src/js/pedagogy/concept-span-index.js`
18. `src/js/recall-study.js`
19. `src/js/resume.js`
20. `src/js/rsvp.js`
21. `src/js/session-persist-supabase.js`
22. `src/js/shared-dpp-cache-persist.js`
23. `src/js/storage-rebrand-migration.js`
24. `src/js/vault/doc-similarity.js`
25. `src/js/vault/embedding-persist.js`
26. `src/js/vault/inventory-merge-embeddings.js`
27. `src/js/vault/novelty-scoring.js`

## Risk-Ordered Findings (Low Isolation → High Interconnection)

### 1) MC Keyboard Helper Returns False-Negative For ContentEditable Inputs

- **Untested modules:** `src/js/mc-keyboard.js`
- **Evidence:** `isMcTypingTarget()` only checks `input|textarea|select` and ignores content-editable nodes.
  - `src/js/mc-keyboard.js` line 9-12
- **Concrete impact:** keyboard handlers that rely on this helper can capture A/B/C/D shortcuts while user is typing inside rich-text editors.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** pure function and deterministic behavior; easiest to lock with focused unit/integration assertion.

### 2) Pedagogy HTML Marker Function Is A No-Op

- **Untested modules:** `src/js/pedagogy/concept-span-index.js`
- **Evidence:** `applySpanClassesToHtml()` computes classes but intentionally does nothing (`void classes`) and returns input unchanged.
  - `src/js/pedagogy/concept-span-index.js` line 78-93
- **Concrete impact:** any caller expecting dim/highlight class application on HTML never gets transformed output.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** function contract is explicit and output is directly assertable.

### 3) HTML Image Extractor Assigns Hardcoded `lineIndex` For MediaWiki Headings

- **Untested modules:** `src/js/document-images/extract-html.js`, `src/js/document-images/prepare-markdown.js`, `src/js/document-images/render.js`, `src/js/document-images/storage.js`
- **Evidence:** MediaWiki heading branch creates heading blocks with fixed `lineIndex: 2` instead of using/incrementing rolling `lineIndex`.
  - `src/js/document-images/extract-html.js` line 255-272
- **Concrete impact:** duplicate/incorrect line ordering metadata for multiple headings; downstream ordering/traceability can diverge.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** parser output shape is deterministic for fixture HTML; easy to lock with fixture-based test.

### 4) Gutenberg Header Stripping Is Over-Specific (Misses Valid Variants)

- **Untested modules:** `src/js/normalization/plain-text-blocks.js`
- **Evidence:** start/end regex requires numeric ebook id (`...EBOOK \d+...`), but many valid Gutenberg headers omit or format identifiers differently.
  - `src/js/normalization/plain-text-blocks.js` line 7-8
- **Concrete impact:** boilerplate leaks into extracted content for real-world plain-text inputs.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** corpus/fixture cases can reproduce mismatch reliably.

### 5) Resume Payload Decode Path Uses Deprecated UTF-8 Conversion Primitive

- **Untested modules:** `src/js/resume.js`
- **Evidence:** decode relies on `decodeURIComponent(escape(atob(...)))`.
  - `src/js/resume.js` line 11
- **Concrete impact:** non-BMP/unicode edge payloads can misdecode or throw depending on content/runtime.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** exact encoded payloads can be fixture-tested across known unicode edge cases.

### 6) Recall Screen Leaves Stale Concept Peek List On Questions Without Concepts

- **Untested modules:** `src/js/recall-study.js`
- **Evidence:** concept list HTML is updated only when `q?.concept_ids?.length`; no else branch clears previous content.
  - `src/js/recall-study.js` line 115-120
- **Concrete impact:** UI can display concept hints from the previous question, causing incorrect learner guidance.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** deterministic DOM state bug; easy to reproduce with two-question fixture sequence.

### 7) Belief Load Coerces Valid Zero Belief To 0.5

- **Untested modules:** `src/js/adaptive-probing/belief-persist.js`
- **Evidence:** `belief: Number(row.belief) || 0.5` treats `0` as falsy and rewrites it to `0.5`.
  - `src/js/adaptive-probing/belief-persist.js` line 63
- **Concrete impact:** weakest confidence state is silently inflated on read, corrupting adaptive probe behavior.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** critical value-coercion bug with straightforward input/output assertions.

### 8) Adaptive Coverage Ignores Explicit Zero-Test Budget

- **Untested modules:** `src/js/adaptive-probing/assessment-integration.js`
- **Evidence:** probe count enforces `Math.max(1, ...)`, so `n_test: 0` is impossible.
  - `src/js/adaptive-probing/assessment-integration.js` line 96-99
- **Concrete impact:** caller cannot disable probes via budget; behavior diverges from explicit `n_test` configuration semantics.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** budget-to-output contract should be protected by tests before behavior change.

### 9) Dedup Proposal Merge Treats A→B And B→A As Different Pairs

- **Untested modules:** `src/js/concept-registry/dedup-gates.js`
- **Evidence:** merge key is directional `${source}|${target}` with no canonicalization.
  - `src/js/concept-registry/dedup-gates.js` line 175
- **Concrete impact:** duplicate logical proposals can survive merge if order differs by source.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** pure merge logic; trivial to encode in deterministic test.

### 10) Concept Graph Detail Pane Can Keep Stale Content

- **Untested modules:** `src/js/concept-registry/graph-mount.js`
- **Evidence:** when `getConceptPageData(node.id)` returns null, function returns without clearing/hiding existing detail content.
  - `src/js/concept-registry/graph-mount.js` line 68-70
- **Concrete impact:** user can click node with missing data and still see previous node details.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** UI-state regression is reproducible with small DOM harness.

### 11) Mastery Decay Fallback Branch Is Dead, Inflating No-Observation Cases

- **Untested modules:** `src/js/concept-registry/mastery.js`
- **Evidence:** function returns early when no facets; later fallback `facets.length ? 0 : 30` always takes `0` because `facets.length` is guaranteed >0 at that point.
  - `src/js/concept-registry/mastery.js` line 21 and line 47
- **Concrete impact:** concepts with facets but no observations never incur intended stale-time penalty.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** computation is pure and highly testable.

### 12) Rebrand Migration Rewrites Embedded Prefixes In Only Two Keys

- **Untested modules:** `src/js/storage-rebrand-migration.js`
- **Evidence:** embedded `mylearning_` references are rewritten only for `pith_doc_sessions` and `pith_knowledge_vault`, excluding mapped `pith_knowledge_vault_data`.
  - `src/js/storage-rebrand-migration.js` line 66-70
- **Concrete impact:** mixed old/new key references can remain in migrated state blobs.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** migration behavior should be snapshotted with fixture localStorage payloads.

### 13) Session Persistence Auth Helper Throws Instead Of Returning Nullability

- **Untested modules:** `src/js/session-persist-supabase.js`
- **Evidence:** `getAuthUserId()` throws on missing user.
  - `src/js/session-persist-supabase.js` line 11
- **Concrete impact:** several call sites treat auth absence as non-fatal flow; throwing forces broad try/catch reliance and inconsistent control paths.
- **Safest fix path:** **(b) verify call-graph + integration harness first**
- **Why:** this helper is shared across persistence modules; changing return contract can cascade across many subsystems.

### 14) Shared DPP Cache Uses Global Cache Key Without User Namespace

- **Untested modules:** `src/js/shared-dpp-cache-persist.js`
- **Evidence:** read/write select/upsert by `cache_key` built from `docId + pipelineVersion`, with no `user_id` filter in this module.
  - `src/js/shared-dpp-cache-persist.js` line 21, line 24-27, line 52-61
- **Concrete impact:** if backend policy is ever relaxed/misconfigured, cross-user cache collisions become possible immediately.
- **Safest fix path:** **(b) schema/policy verification + integration checks**
- **Why:** correctness depends on DB constraints/RLS policy, not only JS logic.

### 15) LLM Usage Logger Performs Insert Even With Potential Missing Auth

- **Untested modules:** `src/js/llm-usage-log.js`, `src/js/concept-anchoring.js`
- **Evidence:** logger always constructs payload and inserts; auth failure is swallowed in catch, and call sites fire-and-forget (`void logLlmUsage`).
  - `src/js/llm-usage-log.js` line 20-35
  - `src/js/concept-anchoring.js` line 39-44
- **Concrete impact:** telemetry silently drops, making operational monitoring inconsistent with "log usage" expectations.
- **Safest fix path:** **(b) operational verification (telemetry assertions)**
- **Why:** this is observability behavior; best validated with integration-level telemetry checks rather than unit-only.

### 16) Interview Synthesis Retry Is Single-Shot And Non-Adaptive

- **Untested modules:** `src/js/interview/interview-api.js`
- **Evidence:** on fidelity failure, code retries exactly once with identical strategy and then throws.
  - `src/js/interview/interview-api.js` line 199-212
- **Concrete impact:** transient or systematic fidelity failures are not degraded/recovered beyond one duplicate attempt.
- **Safest fix path:** **(b) model-output evaluation harness**
- **Why:** depends on LLM behavior; robust fix requires scenario matrix beyond deterministic unit tests.

### 17) RSVP Module Declares Duplicate Ellipsis Condition (Dead Branch Signal)

- **Untested modules:** `src/js/rsvp.js`
- **Evidence:** `if (last === "…" || last === "…")` duplicates same literal.
  - `src/js/rsvp.js` line 472
- **Concrete impact:** indicates missed condition branch; currently harmless but reveals unverified token-classification logic path.
- **Safest fix path:** **(a) regression test then cleanup**
- **Why:** low-risk parser branch; simple tokenization test can protect intent.

### 18) Dev Wipe Storage Deletion Assumes Flat Path Listing

- **Untested modules:** `src/js/dev/wipe-user-data.js`
- **Evidence:** markdown storage enumeration lists only one prefix level and concatenates `${prefix}/${item.name}` without recursion.
  - `src/js/dev/wipe-user-data.js` line 118-133
- **Concrete impact:** if nested objects exist under user folder, wipe can report success while leaving artifacts.
- **Safest fix path:** **(b) storage integration verification**
- **Why:** behavior depends on actual bucket path layout and Supabase list semantics.

### 19) Document Similarity Scope Filtering Is Narrower Than Novelty Scope Semantics

- **Untested modules:** `src/js/vault/doc-similarity.js`
- **Evidence:** peer selection filters only exact `projectId` matches, while related scope utilities elsewhere use ancestor chains.
  - `src/js/vault/doc-similarity.js` line 91-93
- **Concrete impact:** cross-scope related docs in same hierarchy are ignored; recommendations become incomplete.
- **Safest fix path:** **(b) cross-feature integration verification**
- **Why:** this touches recommendation behavior and project scoping semantics across modules.

### 20) Embedding Persistence Fallback Hard-Limits Candidate Scan To 500 Rows

- **Untested modules:** `src/js/vault/embedding-persist.js`
- **Evidence:** client-side fallback query has fixed `.limit(500)`.
  - `src/js/vault/embedding-persist.js` line 95-100
- **Concrete impact:** nearest-neighbor results become inaccurate at larger vault sizes even though operation reports success.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** deterministic paging/candidate-size behavior can be reproduced in fixture data.

### 21) Inventory-Merge Arbitration Budget Is Global Mutable State Across Runs

- **Untested modules:** `src/js/vault/inventory-merge-embeddings.js`
- **Evidence:** `arbitrationCallsThisRun` is module-global and only reset when external caller explicitly invokes reset helper.
  - `src/js/vault/inventory-merge-embeddings.js` line 29-33, line 118-123
- **Concrete impact:** one run can deplete arbitration budget for later runs in same runtime, causing non-local behavior shifts.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** state leakage can be reproduced with two sequential runs in one test.

### 22) Novelty Scope Counter Ignores Input Scope IDs

- **Untested modules:** `src/js/vault/novelty-scoring.js`
- **Evidence:** `countScopedRegistryConcepts(projectIds)` never uses `projectIds` to filter concepts.
  - `src/js/vault/novelty-scoring.js` line 31-39
- **Concrete impact:** empty-vault short-circuit can be bypassed incorrectly by unrelated concepts, forcing unnecessary embedding calls and wrong novelty treatment.
- **Safest fix path:** **(a) regression test then fix**
- **Why:** pure counting logic with direct, high-signal fixture assertions.

## Recommended Fix Sequence

Follow this order to minimize blast radius while restoring trust quickly:

1. `mc-keyboard`, `concept-span-index`, `extract-html` (local pure/UI helpers)
2. `plain-text-blocks`, `resume`, `recall-study` (format/parsing/UI state)
3. `adaptive-probing/*`, `concept-registry/*`, `storage-rebrand-migration`
4. `session-persist-supabase`, `shared-dpp-cache-persist`, `llm-usage-log + concept-anchoring`
5. `interview-api`, `rsvp`, `dev/wipe-user-data`
6. `vault/doc-similarity`, `vault/embedding-persist`, `vault/inventory-merge-embeddings`, `vault/novelty-scoring`

## Verification Strategy Summary

- Prefer **test-first regression** for deterministic parser/transform/state bugs.
- Use **integration verification** where behavior depends on Supabase policy/schema/runtime data shape.
- Use **LLM-evaluation harnesses** for interview/semantic generation paths where deterministic assertions alone are insufficient.

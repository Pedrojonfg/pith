# Spec: Pedagogical Principles Layer

**Status:** Draft
**Date:** 2026-06-21
**Depends on:** `20260621-vault-embedding-quality-layer` (novelty scoring — implemented), `20260621-adaptive-knowledge-probing` (belief state — implemented), `20260620-sm2-priority-queue`, `20260621-recall-mode`, `20260613-source-fidelity`
**Supersedes:** Nothing directly.

---

## 1. Problem statement

Six independent, evidence-backed principles (sourced from Petrarca's design documentation) that none of the existing specs cover, now unblocked because their prerequisites — novelty scoring and belief state — are implemented:

1. Factual questions should be generated deterministically, not by LLM.
2. Conceptual (non-factual) knowledge needs a comprehension check before entering spaced-repetition scheduling.
3. Familiar content should be visually dimmed, not hidden, and "new" highlighting should be budget-capped.
4. The SM-2 review queue should prioritize document-sourced items over auto-generated filler.
5. The system should be able to explain, in one line, why a given item is being surfaced now.
6. Block packing should bias toward a novelty/familiarity mix instead of packing purely by length/structure — this was explicitly deferred as a non-goal in both prerequisite specs pending their own completion; it's in scope here.

These are mostly independent of each other (R1–R5) with one explicit dependency chain (R2 depends on R1) and one feature that's higher-risk because it touches the core packing algorithm (R6).

## 2. Non-goals

- Changing the underlying SM-2 algorithm/interval math itself (`sm2.js`'s core scheduling formula) — R4 only adds a scoring nudge within the existing priority queue, not a new algorithm.
- Building a full entity-span-to-concept mapping system from scratch if one doesn't already exist — R3 depends on this existing or being trivially extendable; if it requires substantial new infrastructure, that's flagged back as a scope question (§14.2), not silently absorbed into this spec.
- Migrating `getSessionLlmModel()`'s known bug (always returns `DEFAULT_LLM_MODEL`, ignores per-document stored model — noted as pre-existing and out of scope in the Recall mode work). R1.2's LLM fallback path must call the model resolver correctly, but fixing the existing bug itself is not part of this spec.
- Retroactively reclassifying every existing `conceptInventory` entry across all of a user's existing documents — R1's classification applies going forward, to documents processed after this ships. Backfill is a separate, explicit decision (§14.5).

---

## 3. R1 — Deterministic factual question generation

**R1.1.** New field on `conceptInventory` entries: `questionClass: 'factual' | 'conceptual'`, computed at DPP T1.2 (concept indexing) via a cheap deterministic classifier first:
   - Heuristics: contains a date/year pattern, a number with units, a proper-noun-heavy short definition, an enumeration marker, or matches an "X is defined as Y" / "X occurred in Y" structural pattern in the source text near the concept's span.
   - Ambiguous cases (heuristic confidence below a threshold) fall back to a single cheap LLM tagging call — **batched across the whole inventory in one call, not one call per concept** — capped by `MAX_CLASSIFICATION_LLM_CALLS_PER_DOC` (config, default: 1 batched call covering all ambiguous concepts together).

**R1.2.** Factual concepts generate question text via templates (`src/js/rsvp/factual-templates.js`), language-aware per `STUDY_LANG_OPTIONS`: "¿En qué año ocurrió [X]?", "¿Quién/Qué fue [X]?", cloze-blank extraction for definition-pattern sentences. **Zero LLM calls** for the question text itself.

**R1.3.** Conceptual concepts continue through the existing LLM-based question generation prompts (R1-R5 RSVP pedagogy hardening), entirely unchanged.

**R1.4.** Source fidelity check (reuse `fidelity-validation.js`): the deterministically extracted fact must be verifiably present in the source markdown near the concept's location. If extraction can't be confirmed, fall back to the existing LLM generation path for that specific concept rather than risk a fabricated factual question — **never trade accuracy for the cost savings this feature is meant to deliver.**

**R1.5.** Cost tracking: tag `llm_usage_logs` entries (or their absence, for template-generated questions) with `generation_method: 'template' | 'llm'` so the actual savings from this feature are measurable, not assumed.

**R1.6.** This classification (`questionClass`) is the shared input for R2 — built once, consumed twice.

---

## 4. R2 — Comprehension gate before memorization entry

**R2.1.** A concept tagged `questionClass: 'conceptual'` requires a `comprehensionConfirmed: true` flag before it is scheduled as a standard flashcard-style SM-2 item. Set by:
   - a Recall-mode answer referencing this concept graded `knew` or `partial` (not `missed`), or
   - a Socratic question response above the existing grading threshold already used elsewhere in the app.

**R2.2.** Until confirmed, the concept can still appear in any study mode normally (RSVP, Slow, Questions) — the gate only blocks entry into the spaced-repetition queue, not general exposure. This is deliberately narrow: the goal is "don't drill what hasn't been understood yet," not "hide it."

**R2.3.** Factual concepts (`questionClass: 'factual'`) bypass this gate entirely and enter SM-2 exactly as today — flashcard-style repetition is appropriate for atomic facts; the gate exists specifically because it isn't appropriate for conceptual knowledge (the Matuschak finding this principle is based on).

**R2.4.** UI: a pending-confirmation concept shows a subtle "needs deeper understanding first" indicator in vault/review surfaces rather than silently being absent from the queue — avoid the confusing experience of "why isn't this showing up for review."

---

## 5. R3 — Dim familiar content, budget-capped highlighting

**R3.1.** New CSS class for vault-green-mapped text spans: dimmed opacity (~0.55, per the cited CHI 2024 finding on constrained highlighting), applied in Slow Mode reader and RSVP block explanation panes — **not** the RSVP flash overlay itself, where text is too transient for dimming to register meaningfully (R3.4 scope boundary).

**R3.2.** Requires a text-offset-to-conceptId span mapping. **This may already partially exist** (`graph/proximity.js` computes textual proximity between nodes; `slow/annotations.js` likely has some offset handling) — verify before building new infrastructure (§14.2). If it needs to be built from scratch, treat that as a meaningfully larger unit of work than the rest of this spec and flag it back rather than silently absorbing the scope.

**R3.3.** "New/important" highlighting is capped to a configurable word budget per screen (`HIGHLIGHT_WORD_BUDGET`, default 150 words, per the cited research), selecting the highest-novelty spans (using `conceptInventory[i].noveltyScore` from the embedding quality layer) within budget rather than marking every qualifying span.

**R3.4.** Scope: Slow Mode reader and RSVP block explanation panes only.

**R3.5.** Non-goal: purely a rendering feature. No effect on scheduling, packing, or question generation.

---

## 6. R4 — Source-priority weighting in the SM-2 queue

**R4.1.** Tag each `shared.smItems` entry with `sourceType: 'document' | 'gap_fill' | 'mnemonic' | 'vault_curation'` at creation time. **Verify exact current `smItems` schema before adding this field** (§14.1) — the field list in `application-overview.md` doesn't enumerate per-item source provenance explicitly.

**R4.2.** Add a source-type adjustment to `sm2.js`'s existing "time-as-orderer" priority scoring — a **secondary sort key applied within** the existing due-date-driven ordering, not a replacement of it (the existing model's whole point is that due dates are sort keys, not blockers; this spec must not regress that). `gap_fill` items get a configurable priority penalty (`GAP_FILL_PRIORITY_PENALTY`, default placeholder, needs Pith-specific calibration — not copied blindly from Petrarca's `-5.0`, which was tuned for a different scoring scale).

**R4.3.** Session cap: `gap_fill`-sourced items capped at `MAX_GAP_FILL_PER_SESSION` (config, default 3) regardless of due-ness, preventing low-value auto-generated filler from dominating a review session.

**R4.4.** `document`-sourced items always retain priority over `gap_fill` at equal due-ness; `mnemonic` and `vault_curation` sourced items are unaffected by this spec (no penalty, no boost) pending product input on where they should rank (§14.3).

---

## 7. R5 — "Why am I seeing this?" transparency

**R5.1.** New lightweight UI component (e.g. `WhyThisCard`), attachable to review/vault items, computing a one-line explanation from existing data, prioritized:
   1. Explicit recent miss on this exact concept → "you missed this N days ago."
   2. Propagated belief change (`shared.knowledgeBeliefState` / `vault_belief_state`, tagged `source: 'propagated'` from the adaptive probing engine) → "inferred from your answer about [related concept]."
   3. Standard SM-2 due date → "scheduled for review today."
   4. Fallback: generic "part of your regular review."

**R5.2.** Zero new data collection — reads exclusively from data that already exists post-A/B (`assessmentSignals`, `knowledgeBeliefState`, `smItems` scheduling metadata).

**R5.3.** Purely additive UI. Zero risk to scheduling or generation logic — safe to ship at any point once the underlying data sources exist.

---

## 8. R6 — Novelty-biased block packing

**R6.1.** Previously deferred non-goal in both prerequisite specs, now unblocked. Extends `packInventoryToBlocks` / `block-count-recommender.js` to bias block composition toward a target novel/familiar concept ratio (default 70/30, per the cited "zone of proximal development" finding) instead of packing purely by length/structural proximity.

**R6.2.** Signal is a **blend, not a strict fallback**. When both `shared.knowledgeBeliefState` (adaptive probing engine, B) and `conceptInventory[i].noveltyScore` (embedding quality layer, A) are available for a concept, compute a blended familiarity score:

```
familiarity = (1 - NOVELTY_BLEND_WEIGHT) × belief + NOVELTY_BLEND_WEIGHT × (1 - noveltyScore)
```

Belief state dominates (it's a confirmed, post-answer signal), but raw embedding novelty keeps a deliberately small, fixed weight even when belief state exists. **Rationale:** a question answered correctly right after first exposure can reflect short-term recency rather than durable learning — the user just saw it. Embedding-based novelty doesn't know or care that the user just answered correctly; it only reflects how far this concept actually sits from anything already in the vault. Genuinely novel material will likely take longer to consolidate regardless of one early correct answer, so keeping a small novelty weight in the mix is a deliberate corrective against belief state being too optimistic right after first exposure.

When only one signal is available for a concept (no assessment run → no belief state; embeddings unavailable → no `noveltyScore`), use that signal alone at full weight — there's nothing to blend against.

**R6.3.** Concepts with neither signal available (`noveltyScore: null` AND no belief state entry) fall back to current packing logic untouched for that concept — treat missing data as "no bias," never as a default familiarity value in either direction.

**R6.4.** This is a **soft bias on a secondary objective**, not a hard constraint. Existing structural ordering (document hierarchy, dedup, source-fidelity strict mode's sequential constraints) takes priority; novelty mixing only adjusts which concepts land in which block among otherwise-valid groupings, never reorders content in a way that breaks narrative flow or violates strict source fidelity.

**R6.5.** Config: `NOVELTY_BIASED_PACKING_ENABLED` (default **false** — the 70/30 target ratio is an externally-sourced finding, unvalidated for Pith's content and audience; ship disabled, enable for personal testing, evaluate before defaulting on), `TARGET_NOVELTY_RATIO` (default 0.7), `NOVELTY_BLEND_WEIGHT` (default 0.15 — deliberately small; this is a corrective nudge on the belief-state signal, not a co-equal input).

**R6.6.** Highest-risk item in this spec — it modifies the core packing algorithm at the heart of the RSVP/Slow flow. Sequence it last (§9) and ship default-off.

---

## 9. Risk-ordered implementation sequence

1. **R4** — source-priority SM-2 queue. Isolated, no new infra, moderate risk confined to one scoring function.
2. **R1** — deterministic factual classification + templates. Foundational for R2; ship behind a flag; moderate risk since it changes the question-generation path for a meaningful fraction of concepts.
3. **R2** — comprehension gate. Depends on R1's classification existing.
4. **R5** — "why this" transparency. Lowest risk, purely additive, no dependencies beyond data that already exists.
5. **R3** — dim/highlight budget. Gate this on §14.2's answer — if entity-span infrastructure must be built from scratch, treat as larger scope and resequence accordingly.
6. **R6** — novelty-biased packing. Last, default-off, highest risk (core packing algorithm).

---

## 10. Config flags (`config/flags.js`)

```
DETERMINISTIC_FACTUAL_QUESTIONS_ENABLED  // default: true
MAX_CLASSIFICATION_LLM_CALLS_PER_DOC     // default: 1 (batched)
COMPREHENSION_GATE_ENABLED               // default: true
HIGHLIGHT_WORD_BUDGET                    // default: 150
GAP_FILL_PRIORITY_PENALTY                // default: placeholder, calibrate against Pith data
MAX_GAP_FILL_PER_SESSION                 // default: 3
NOVELTY_BIASED_PACKING_ENABLED           // default: false
TARGET_NOVELTY_RATIO                     // default: 0.7
NOVELTY_BLEND_WEIGHT                     // default: 0.15
```

---

## 11. Testing checklist

- [ ] `cursor-tests/20260621_factual-classification.mjs` — hand-built set of concept entries (clear dates/numbers vs. clear arguments/relations) classified correctly by the deterministic heuristic alone, with zero LLM calls.
- [ ] `cursor-tests/20260621_factual-template-fidelity.mjs` — every template-generated question's answer is verifiably present in source markdown (R1.4); inject a concept where the fact can't be confirmed and verify fallback to LLM generation occurs.
- [ ] `cursor-tests/20260621_comprehension-gate.mjs` — a conceptual concept does not appear in `smItems` scheduling until `comprehensionConfirmed`; a factual concept appears immediately regardless.
- [ ] `cursor-tests/20260621_gap-fill-cap.mjs` — a session with more than `MAX_GAP_FILL_PER_SESSION` due gap-fill items surfaces only the cap, document-sourced items unaffected by the cap.
- [ ] `cursor-tests/20260621_time-as-orderer-preserved.mjs` — regression test confirming due-date-driven ordering still dominates; source-type penalty only reorders items with comparable due-ness, never overrides an overdue document-sourced item in favor of a fresh gap-fill item.
- [ ] `cursor-tests/20260621_why-this-priority.mjs` — `WhyThisCard` explanation priority order (miss > propagated > due-date > fallback) verified against synthetic data combinations.
- [ ] `cursor-tests/20260621_novelty-packing-blend.mjs` — confirms blended familiarity formula (R6.2) on synthetic concepts: both signals present → blend matches formula exactly; only one signal present → used at full weight; neither present → falls back to unbiased packing (R6.3).
- [ ] `cursor-tests/20260621_novelty-packing-respects-fidelity.mjs` — with `SOURCE_FIDELITY_STRICT` active, novelty-biased packing never reorders blocks in a way that violates strict sequential constraints.
- [ ] Manual: confirm `NOVELTY_BIASED_PACKING_ENABLED = false` (default) produces byte-identical packing output to pre-spec behavior.

---

## 12. Open questions — must be resolved against the actual codebase before Cursor implements

1. **14.1** Exact current `shared.smItems` entry schema — confirm whether adding `sourceType` is a clean additive field or requires touching existing item-creation call sites across RSVP/Cloze/Recall/mnemonics/vault-curation (likely several files, per the existing review-engine architecture).
2. **14.2** Does any text-offset-to-conceptId span mapping already exist (`graph/proximity.js`, `slow/annotations.js`, or elsewhere)? This determines whether R3 is a small UI feature or requires building new infrastructure — resolve before sequencing R3 (§9).
3. **14.3** Product decision: should `mnemonic` and `vault_curation` sourced SM-2 items get their own priority treatment in R4, or correctly default to neutral (current spec's assumption)?
4. **14.4** Confirm `NOVELTY_BLEND_WEIGHT = 0.15` (R6.2) is a reasonable starting point — this is an unvalidated placeholder like every other threshold in this layer, and the "how much should one early correct answer be discounted by raw novelty" question is genuinely a product judgment call, not something derivable from the cited research (which didn't test this exact blend). Revisit after the first batch of personal-testing sessions with `NOVELTY_BIASED_PACKING_ENABLED` on.
5. **14.5** Should R1's `questionClass` classification be backfilled onto already-processed documents from before this ships, or apply going-forward only (current spec's assumption, §2)? If backfill is wanted, that's additional scope not estimated here.

---

## 13. Glossary additions

| Term | Meaning |
|---|---|
| **questionClass** | `factual` or `conceptual` tag on a concept inventory entry, determining whether question generation is templated or LLM-driven, and whether the comprehension gate applies. |
| **comprehensionConfirmed** | Flag gating a conceptual concept's entry into standard SM-2 flashcard scheduling, set by an elaborative (Recall/Socratic) signal. |
| **sourceType** | Provenance tag on an `smItems` entry (`document`/`gap_fill`/`mnemonic`/`vault_curation`), used to weight review-queue priority. |

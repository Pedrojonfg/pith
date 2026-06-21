# Spec: Adaptive Knowledge Probing Engine

**Status:** Draft
**Date:** 2026-06-21
**Depends on:** `20260619-knowledge-vault-post-a-plus` (typed PREREQUISITE edges), `20260618-holistic-assessment-coverage` (existing question generation), `20260611-rsvp-assessment-reposition` (pre-packing screens), `20260621-vault-embedding-quality-layer` (typed edges, cascade merge ordering)
**Supersedes:** Nothing directly. Replaces the *selection* logic feeding `screenPrePackingAssessment`, not the generation/UI mechanics already built.

---

## 1. Problem statement

The pre-packing assessment currently asks some fixed/heuristic set of N questions to build a knowledge profile before packing RSVP blocks. This has two weaknesses:

- **No targeting.** Every question costs the same LLM call and screen time regardless of how much it actually tells the system about the user. A question about something already obviously known (or obviously unknown) wastes a probe.
- **No propagation.** Confirming the user knows a foundational concept doesn't automatically raise confidence in its prerequisites, even when the concept vault already encodes that prerequisite relationship as a typed edge. Each concept is assessed in isolation.

This spec adds a probe-selection and belief-propagation layer that sits between the existing concept vault graph and the existing question-generation pipeline: it decides **which** concept to probe next (maximizing information gained per question) and **how a single answer should update confidence across the whole graph**, not just the one node asked about.

The math here (expected information gain, Bayesian forward-backward propagation) is pure algorithm — it runs in JavaScript, costs nothing, and is sub-millisecond per operation at the graph sizes Pith deals with (tens to low hundreds of concepts per document). The LLM is only invoked afterward, to phrase the natural-language question for whichever concept the algorithm picked. **This does not add a new LLM cost driver** — it replaces "generate N questions by some existing heuristic" with "generate exactly the N most useful questions," same call budget.

## 2. Non-goals (explicitly out of scope)

- Wiring every study mode's `assessmentSignals` (RSVP, Cloze, Recall, Questions) into this belief engine. **v1 scope is the pre-packing assessment flow only.** Generalizing it into a single belief state fed by all modes is real future value but a separate spec — flagged as fast-follow, not built here.
- Foil-concept overclaiming detection (injecting fake/decoy concepts to catch bluffing). Limbic's own calibration explicitly found that *"post-hoc foil calibration doesn't help; Bayesian constraint propagation is the primary overclaiming defense."* Building the cheaper, evidence-backed mechanism (R3's propagation) and skipping the one with documented low payoff is the correct call here, not corner-cutting.
- Feeding belief state into `block-count-recommender.js` packing bias. Same boundary as `20260621-vault-embedding-quality-layer` §2 — a future spec, once both novelty scoring and belief state exist and can be jointly evaluated.
- Propagation along non-`PREREQUISITE` typed edges (`PART_OF`, `EXEMPLIFIES`, `ASSOCIATED`). Whether "knows the whole" should partially propagate to "knows the parts" is a real modeling question without an obvious default — flagged as an open design question (§14.3), not assumed.
- Replacing the holistic assessment question-generation prompts themselves (`20260618-holistic-assessment-coverage`). This spec only changes *which* concept gets a question; the prompt mechanics that turn a concept into question text are untouched.

## 3. Architecture overview

```
shared.conceptGraph (PREREQUISITE edges only, filtered) ──► R0: build probe DAG, validate, break cycles
                                                                      │
shared.conceptInventory + vault maturity (gray/yellow/green) ──► R1: initialize belief state (priors)
                                                                      │
                                                                      ▼
                                                        R2: nextProbeBatch(graph, state, n)
                                                                      │
                                                  (existing question-generation prompt, unchanged)
                                                                      │
                                                          user answers in screenPrePackingAssessment
                                                                      │
                                                                      ▼
                                                        R3: updateBeliefs(graph, state, nodeId, response)
                                                          (Bayesian forward-backward propagation)
                                                                      │
                                          ┌───────────────────────────┴───────────────────────────┐
                                          ▼                                                         ▼
                              R6: feeds packInventoryToBlocks                          R5: knowledge frontier
                              (existing pre-packing → packing handoff)                  (screenVaultBranch, new)
```

---

## 4. R0 — Probe graph construction

**R0.1.** Build a DAG from `shared.conceptGraph`, filtering to **`PREREQUISITE`-typed edges only**. Other edge types (`CONTRADICTS`, `EXEMPLIFIES`, `PART_OF`, `ASSOCIATED`) are excluded from this graph entirely — they don't represent "knowing A makes B more likely," which is the only relationship this engine reasons about (§2, non-goal on non-prerequisite propagation).

**R0.2.** Node set = `conceptInventory` entries for the active document, plus any vault concepts they're already identity-resolved to (for cross-document prerequisite context, when available).

**R0.3.** **Cycle detection is mandatory, not optional.** Cross-document cascade merges (`20260621-vault-embedding-quality-layer` R3) can introduce a `PREREQUISITE` cycle that didn't exist in either source graph independently. A cyclic graph fed into Bayesian message passing risks non-termination or oscillating beliefs. On cycle detection:
   - Identify the cycle via standard DFS back-edge detection.
   - Break it deterministically by dropping the lowest-weight edge in the cycle (reuses the existing edge-weight field from "connection strength from retrieval co-occurrence" per the concept vault spec).
   - Log the break (concept pair, weight, timestamp) to a `probe_graph_warnings` table — this is a data-quality signal worth surfacing to vault curation later, not a silent fix.

**R0.4.** Reject duplicate node IDs at construction (defensive check; should be unreachable given existing identity resolution, but cheap to assert).

**R0.5.** **Ordering dependency:** R0 must run *after* any pending cascade merges from `20260621-vault-embedding-quality-layer` R3 have been applied, never before. Building the probe graph against a stale pre-merge state risks probing a concept that's about to be merged away mid-session.

---

## 5. R1 — Belief state initialization

**R1.1.** Belief = `P(user knows this concept)`, a float in `[0, 1]`, stored per concept.

**R1.2.** Priors, seeded from existing vault maturity state — **not from scratch**, since the vault already encodes a coarse confidence signal:

| Vault maturity | Prior belief | Rationale |
|---|---|---|
| green | 0.85 | curated/user-authored content exists; high confidence, not certainty |
| yellow | 0.55 | some retrieval signal exists, identity-resolved |
| gray / unseen | `BASE_RATE_PRIOR` (config, default 0.25) | not zero — assuming total ignorance biases EIG toward over-probing trivial concepts; a nonzero floor reflects that some "new" concepts are genuinely easy or already implied by general knowledge |

**R1.3.** Storage: `shared.knowledgeBeliefState` (document-scoped, ephemeral to the assessment session) — `{ [conceptId]: { belief, lastUpdated, source: 'prior' | 'probe' | 'propagated' } }`. Project-scoped persistent state lives separately (R5.2), not conflated with this per-session structure.

---

## 6. R2 — Expected Information Gain probe selection

**R2.1.** `nextProbe(graph, state) -> { conceptId, expectedInformationGain }`:
   - For each un-probed node, simulate both possible answers ("knows" / "doesn't know") weighted by current belief.
   - Compute expected reduction in entropy across the *whole graph* (not just the probed node) accounting for what propagation (R3) would do to each simulated outcome.
   - Return the node maximizing expected information gain.

**R2.2.** `nextProbeBatch(graph, state, n) -> [{ conceptId, expectedInformationGain }]`:
   - Diversity-aware: after selecting the top node, simulate its propagation effect on the graph *before* selecting the next, so the batch doesn't waste probes on near-redundant siblings whose information would already be implied by the first probe's propagation. This is what makes the batch a true 1-round selection rather than n independent top-1 picks.

**R2.3.** This is precomputed in full before `screenPrePackingAssessment` renders — never probe-by-probe with a round trip per question, to preserve the existing `ASSESSMENT_PARALLEL_PACKING` flag's assumption that the question set is known upfront and packing can proceed in parallel.

**R2.4.** Concepts already at belief ≥ `HIGH_CONFIDENCE_SKIP_THRESHOLD` (config, default 0.9) or ≤ `LOW_CONFIDENCE_SKIP_THRESHOLD` (config, default 0.1) after prior-seeding are excluded from probe candidacy — there's nothing left to learn by asking.

---

## 7. R3 — Bayesian belief propagation on update

**R3.1.** `updateBeliefs(graph, state, conceptId, response)`, `response ∈ { knew, partial, missed }` (reuses the existing three-way grading vocabulary already used elsewhere in review/SM-2 flows — do not invent a fourth vocabulary).

**R3.2.** Direct update: set the probed node's belief based on response (`knew → high`, `partial → medium`, `missed → low`), with damping toward but not fully to 0/1 (a single answer is evidence, not proof — avoid a single lucky/unlucky guess swinging belief to an extreme).

**R3.3.** Propagation, forward-backward (Pearl-style message passing) along `PREREQUISITE` edges only:
   - **Upward (to prerequisites):** if a concept is confirmed known, prerequisites' belief increases, but with a **damping factor** (config, default 0.6) — knowing an advanced concept makes prerequisite mastery *likely*, not certain (a learner can have gaps and still pattern-match the advanced material). Do not propagate at full strength.
   - **Downward (to dependents):** if a prerequisite is confirmed *unknown*, dependents' belief decreases more aggressively (config, default 0.8 damping) — lacking a prerequisite is stronger negative evidence about what depends on it than the inverse case above. The asymmetry is intentional, not a bug: prerequisite knowledge is closer to necessary for dependent knowledge than the reverse is sufficient.
   - Propagation distance is bounded (config `MAX_PROPAGATION_HOPS`, default 2) — unbounded propagation across a large graph risks beliefs drifting on weak transitive chains far from any actual evidence.

**R3.4.** Every propagated update is tagged `source: 'propagated'` and records which probe triggered it, for the same auditability reasons as the rest of this codebase's vault changes (so a confusing block-packing decision later can be traced back to "the system inferred you knew X because you answered Y").

---

## 8. R5 — Knowledge frontier

**R5.1.** `computeFringes(graph, state)`:
   - **Outer fringe**: concepts whose `PREREQUISITE` ancestors are all above `HIGH_CONFIDENCE_SKIP_THRESHOLD`, but the concept itself is below it — "ready to learn next."
   - **Inner fringe**: the boundary of the currently-mastered set — concepts just confirmed known, useful as a "you've got a solid base in X" framing.

**R5.2.** Persisted at **project scope**, not just per-document-session: new table `vault_belief_state` (`project_id, concept_id, belief, source, updated_at`). After a pre-packing assessment session ends, the resulting per-document beliefs merge into this persistent project-level state (max-of-existing-and-new, consistent with "knowledge levels only upgrade" — a confirmed lower reading on a later assessment should not silently erase a previously confirmed higher one without an explicit "I've forgotten this" signal, which doesn't exist yet and is out of scope here).

**R5.3.** UI: new section in `screenVaultBranch`, "Ready to learn next" (outer fringe) and "Recently solidified" (inner fringe). Pure read/display feature — lowest risk in this spec, ships independently of R0–R3 being wired into the assessment flow.

---

## 9. R6 — Integration into pre-packing assessment flow

**R6.1.** Replace the existing question-selection step feeding `screenPrePackingAssessment` with `nextProbeBatch`, keeping the existing question-generation prompts and UI entirely unchanged downstream — this spec only changes *which* concept IDs get sent into that existing pipeline.

**R6.2.** Existing `ASSESSMENT_PARALLEL_PACKING` flag behavior must be preserved exactly: R2's full precomputation requirement (R2.3) exists specifically to not break this.

**R6.3.** Stopping criterion, configurable: stop at `n` probes (existing default batch size, unchanged) OR — new optional mode — stop early once `coverage_pct` (fraction of graph above either confidence threshold) exceeds a configured target and the next-best EIG candidate falls under a diminishing-returns floor. Default: **off** (preserve existing fixed-N behavior); enabling early-stop is a config flag for later experimentation, not a v1 default.

---

## 10. Config flags (`config/flags.js`)

```
ADAPTIVE_PROBING_ENABLED          // master switch, default: true
BASE_RATE_PRIOR                   // default: 0.25
HIGH_CONFIDENCE_SKIP_THRESHOLD    // default: 0.9
LOW_CONFIDENCE_SKIP_THRESHOLD     // default: 0.1
UPWARD_PROPAGATION_DAMPING        // default: 0.6
DOWNWARD_PROPAGATION_DAMPING      // default: 0.8
MAX_PROPAGATION_HOPS              // default: 2
ADAPTIVE_PROBING_EARLY_STOP       // default: false
```

All thresholds and damping factors are starting points, not calibrated against real Pith usage data — same caveat as §10 of the embedding quality layer spec applies here. Track calibration as a fast-follow once there's real session data to tune against.

---

## 11. Data model summary

| Table | Scope | Purpose |
|---|---|---|
| `probe_graph_warnings` | new | logs every cycle-break (R0.3) |
| `vault_belief_state` | new, project-scoped, persistent | R5.2 — cross-document knowledge frontier |
| `shared.knowledgeBeliefState` | existing session blob, new field | document-scoped, ephemeral, per-assessment-session belief state |

---

## 12. Risk-ordered implementation sequence

1. **R0** — graph construction + cycle handling. Foundational; depends on `20260621-vault-embedding-quality-layer`'s typed edges already existing in `conceptGraph`.
2. **R1** — belief state schema + priors. Pure data layer, no algorithm risk yet.
3. **R2** — EIG probe selection. Pure algorithm, fully unit-testable against synthetic graphs with zero integration risk — build and test this in complete isolation before touching the assessment screen.
4. **R3** — Bayesian propagation on update. Slightly higher risk due to the damping-factor tuning; test against hand-constructed small graphs with known expected outcomes before trusting it on real data.
5. **R6** — integration into the pre-packing assessment screen. Moderate risk: this is the first point where a regression would be user-visible (assessment screen freezes, wrong questions selected, `ASSESSMENT_PARALLEL_PACKING` breaks).
6. **R5** — knowledge frontier UI. Lowest risk, pure read/display, can ship independently once R0–R3 exist and have run at least once.

---

## 13. Testing checklist

- [ ] `cursor-tests/20260621_probe-graph-cycle-break.mjs` — synthetic graph with an injected cycle resolves to an acyclic graph, lowest-weight edge in the cycle is the one dropped, warning logged.
- [ ] `cursor-tests/20260621_eig-selection-synthetic.mjs` — on a small hand-built graph (e.g., a 5-node chain) with known priors, `nextProbe` selects the node that information theory predicts should be most informative (verify against a manually computed expected value, not just "it ran without error").
- [ ] `cursor-tests/20260621_eig-batch-diversity.mjs` — `nextProbeBatch(n=3)` on a graph with two near-identical sibling concepts under the same parent does not select both siblings if probing one would already raise the other's belief above the skip threshold via simulated propagation.
- [ ] `cursor-tests/20260621_propagation-asymmetry.mjs` — confirm upward and downward propagation use distinct damping factors and that downward propagation (prerequisite missed → dependent belief drops) is stronger than upward (advanced concept known → prerequisite belief rises).
- [ ] `cursor-tests/20260621_propagation-bounded-hops.mjs` — a chain longer than `MAX_PROPAGATION_HOPS` shows zero belief change beyond the configured hop limit.
- [ ] `cursor-tests/20260621_fringe-computation.mjs` — outer/inner fringe correctly computed against a hand-built graph with a known expected frontier.
- [ ] `cursor-tests/20260621_parallel-packing-preserved.mjs` — regression test confirming `ASSESSMENT_PARALLEL_PACKING` still behaves identically with adaptive probing enabled (full batch precomputed before packing starts, no per-probe round trip).
- [ ] Manual: confirm `ADAPTIVE_PROBING_ENABLED = false` reverts cleanly to whatever the prior selection heuristic was, with no half-migrated state.

---

## 14. Open questions — must be resolved against the actual codebase before Cursor implements

1. **14.1** What is the *current* question-selection logic feeding `screenPrePackingAssessment` today? `application-overview.md` confirms the screen and the `ASSESSMENT_BEFORE_PACKING`/`ASSESSMENT_PARALLEL_PACKING` flags exist and are ✅ implemented, but does not document the selection algorithm being replaced. Read `study.js` / `session.js` around the pre-packing assessment entry point before touching R6.
2. **14.2** Does `shared.conceptGraph` reliably exist with `PREREQUISITE`-typed edges at the point pre-packing assessment runs, for every document, or only for documents where DPP T1.3 ("Building concept graph") fully completed? If the graph can be sparse or absent, R0 needs an explicit fallback (e.g., flat/no-propagation probing, equivalent to plain EIG over independent nodes) rather than assuming a populated graph.
3. **14.3** Product decision: should `PART_OF` or `EXEMPLIFIES` edges propagate belief at a reduced weight, or are they correctly excluded entirely (current spec's assumption, §2)? Flagged for product judgment, not an engineering default to assume silently.
4. **14.4** Per project memory: `assessmentSignals` cross-concept co-occurrence tracking is itself flagged as needing verification before weighted-edge reinforcement can be wired. Confirm whether this spec's R0 edge-weight usage (for cycle-breaking, R0.3) depends on that verification being resolved first, or whether it can safely use edge weights as-is in their current (possibly unverified) state for the narrow purpose of picking which edge to drop in a cycle.
5. **14.5** Where exactly should `vault_belief_state` (R5.2) be queried from for `screenVaultBranch` — does that screen already have a data-fetching pattern for project-scoped vault data this should slot into, or does it need a new fetch path?

---

## 15. Glossary additions

| Term | Meaning |
|---|---|
| **Belief** | `P(user knows this concept)`, float in `[0,1]`, the core unit this engine reasons about. |
| **Expected Information Gain (EIG)** | The probe-selection criterion — picks the question that most reduces uncertainty across the whole graph, not just the asked node. |
| **Propagation damping** | Factor < 1 applied when belief change spreads along `PREREQUISITE` edges, reflecting that inference is evidence, not proof. |
| **Outer fringe** | Concepts whose prerequisites are mastered but which are themselves not yet — "ready to learn next." |
| **Inner fringe** | The boundary of the currently-mastered concept set. |

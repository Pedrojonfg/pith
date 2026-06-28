# Spec: Concept-Coverage Assessment Generation

**Folder:** `specs/20260629-assessment-concept-coverage/`  
**Status:** Approved — ready for implementation  
**Supersedes:** truncation-error behavior in `generateHolisticPrePackingAssessmentItems` (commit `07ee581` and prior)

---

## 1. Problem statement

`generateHolisticPrePackingAssessmentItems` asks the LLM to produce N questions in a single JSON response, where N is derived from inventory size (roughly `ceil(inventorySize * 0.67)`). For large inventories (70 concepts → 47 questions), the LLM response is systematically truncated mid-JSON. The current code detects the truncation, attempts partial recovery, then throws `Assessment question count mismatch` when recovered count < expected. This is an unrecoverable hard error that blocks the entire pre-packing flow.

The root design flaw: correctness is measured by question count, not by concept coverage. A 70-concept inventory can produce 39 valid questions covering 39 concepts — that is pedagogically sufficient and should not be an error.

---

## 2. Goals

- G1: The assessment generation never throws a hard error due to truncation. Partial results are always valid.
- G2: Every concept in `conceptInventory` has at most one assessment question assigned to it.
- G3: After generation, the system knows exactly which concepts were assessed and which were not.
- G4: The `knowledge_profile` fed to `packInventoryToBlocks` is keyed by `conceptId`, not by question count or aggregate score.
- G5: Batch size per LLM call is capped to prevent truncation regardless of inventory size.
- G6: Uncovered concepts after all retry rounds are recorded as `"assessed": false` — never a blocking error.

---

## 3. Non-goals

- Do not add relational questions (two `conceptId` fields, `relationshipType`). Single-concept coverage only.
- Do not change the question format (stem, options, correct index) — only add the `conceptId` tag.
- Do not change how `packInventoryToBlocks` consumes the knowledge profile internally — only change what it receives.
- Do not change the SM-2 or vault systems.
- Do not change the UI of `screenPrePackingAssessment` or `screenPrePackingResults`.
- Do not change `generateRecallQuestions` or any Tier-2 generation.

---

## 4. Data model changes

### 4.1 Question shape: add `conceptId`

Every generated assessment question gains a required `conceptId` field referencing a `canonicalId` from `shared.conceptInventory`:

```js
// Before
{
  id: "q_001",
  type: "test",
  stem: "...",
  options: ["A", "B", "C", "D"],
  correct: 0,
  explanation: "..."
}

// After
{
  id: "q_001",
  type: "test",
  conceptId: "c14",          // canonicalId from conceptInventory — REQUIRED
  stem: "...",
  options: ["A", "B", "C", "D"],
  correct: 0,
  explanation: "..."
}
```

`conceptId` is validated on parse: any question with a missing or unrecognized `conceptId` (not present in `conceptInventory`) is silently dropped.

### 4.2 `knowledge_profile` shape: per-concept map

```js
// Before (inferred from holistic batch logic)
{
  masteryByBlock: [...],
  overallMastery: 0.62,
  ...
}

// After
{
  byConceptId: {
    "c14": { assessed: true,  correct: true  },
    "c23": { assessed: true,  correct: false },
    "c07": { assessed: false }               // not covered after all rounds
  },
  assessedCount: 65,
  notAssessedCount: 5,
  correctCount: 42,
  generatedAt: 1719619200000
}
```

`packInventoryToBlocks` receives this map and uses `byConceptId[concept.canonicalId].correct` to determine mastery weighting per concept. Concepts with `assessed: false` are treated as unknown (neutral mastery weight, not penalized).

---

## 5. Rules

### R1 — Batch size cap: max 20 concepts per LLM call

Split `conceptInventory` into batches of at most 20 concepts before calling the LLM. With 70 concepts: 4 batches (20 + 20 + 20 + 10). Run batches in parallel with `Promise.all`.

Rationale: 20 questions at ~200 tokens each = ~4000 tokens of output, well within any model's single-response limit without truncation risk.

```js
const ASSESSMENT_BATCH_SIZE = 20; // max concepts per LLM call
```

### R2 — Each LLM call requests exactly one question per concept in the batch

The prompt for each batch:

```
Given the following concepts from the document, generate exactly one multiple-choice 
question per concept. Each question must include the concept's canonicalId in the 
"conceptId" field.

Concepts:
[{ canonicalId: "c14", label: "...", definition: "..." }, ...]

Return a JSON array of question objects. Each object must have:
- conceptId: string (the canonicalId of the concept this question tests)
- type: "test"
- stem: string
- options: string[] (4 items)
- correct: number (0-indexed)
- explanation: string

Return ONLY the JSON array, no preamble.
```

Temperature: 0.3 (low — structured output).  
`max_tokens`: 6000 per batch call (sufficient for 20 questions × ~250 tokens each, with buffer).

### R3 — Parse, validate, and track coverage after each batch

After each batch resolves:

1. Parse the JSON response. On parse failure, attempt partial recovery (existing logic in `api.js` — reuse as-is).
2. For each recovered question object:
   - Verify `conceptId` is present and exists in `conceptInventory` (by `canonicalId`).
   - Drop questions with invalid/missing `conceptId`.
   - Drop duplicate questions for the same `conceptId` (keep first).
3. Add valid questions to the coverage map: `covered.add(conceptId)`.

### R4 — Retry round for uncovered concepts (max 2 retry rounds)

After all initial batches complete, compute `uncoveredConcepts = conceptInventory.filter(c => !covered.has(c.canonicalId))`.

If `uncoveredConcepts.length > 0` and `retryRound < 2`:
- Re-batch uncovered concepts (same batch size cap of 20).
- Run retry batches with the same prompt.
- Merge results into the coverage map.
- Increment `retryRound`.

After round 2, any still-uncovered concepts are recorded as `assessed: false`. **No error is thrown.**

Maximum total LLM calls = `ceil(N/20) × 3` (initial + 2 retry rounds). For 70 concepts: max 12 calls (4 initial + up to 8 retries). In practice retry rounds are needed only for LLM failures or malformed responses, not for truncation (eliminated by R1).

### R5 — Assemble `knowledge_profile` from user responses + coverage map

After the user completes the assessment in `screenPrePackingAssessment`:

```js
function buildKnowledgeProfile(questions, userResponses, conceptInventory) {
  const byConceptId = {};

  // Initialize all concepts as not assessed
  for (const concept of conceptInventory) {
    byConceptId[concept.canonicalId] = { assessed: false };
  }

  // Mark assessed concepts
  for (const q of questions) {
    if (!q.conceptId || !byConceptId[q.conceptId]) continue;
    const response = userResponses[q.id];
    if (response === undefined) continue; // question not shown (edge case)
    byConceptId[q.conceptId] = {
      assessed: true,
      correct: response === q.correct
    };
  }

  const assessedEntries = Object.values(byConceptId).filter(v => v.assessed);
  return {
    byConceptId,
    assessedCount: assessedEntries.length,
    notAssessedCount: conceptInventory.length - assessedEntries.length,
    correctCount: assessedEntries.filter(v => v.correct).length,
    generatedAt: Date.now()
  };
}
```

### R6 — `packInventoryToBlocks` consumes `byConceptId`

In `packInventoryToBlocks`, when building the per-concept mastery weight:

```js
function getMasteryWeight(concept, knowledgeProfile) {
  if (!knowledgeProfile?.byConceptId) return 0.5; // no assessment — neutral
  const entry = knowledgeProfile.byConceptId[concept.canonicalId];
  if (!entry || !entry.assessed) return 0.5;       // not assessed — neutral
  return entry.correct ? 0.2 : 0.9;               // known → deprioritize; unknown → prioritize
}
```

This replaces any existing holistic mastery weight lookup. The rest of the packing logic is unchanged.

### R7 — Remove the question-count validator

Delete or disable `normalizePrePackingAssessmentQuestions`'s count-mismatch throw. The function should return whatever questions were successfully parsed and validated against `conceptInventory`, without requiring a minimum count.

If zero questions are returned after all retries (e.g. total LLM outage), the assessment is skipped entirely and `knowledge_profile` is `null`. `packInventoryToBlocks` already handles `null` knowledge profile — neutral weights for all concepts.

### R8 — No UI changes required

The assessment screen (`screenPrePackingAssessment`) renders questions from whatever array is returned. It does not know or care about concept coverage — that is internal to the generation and profile-building logic. The results screen (`screenPrePackingResults`) shows aggregate stats; it can optionally show "X of Y concepts assessed" using `profile.assessedCount / conceptInventory.length` if that field is available, but this is not required for v1.

---

## 6. File-by-file changes

| File | Change |
|------|--------|
| `api.js` | Add `ASSESSMENT_BATCH_SIZE = 20`. Rewrite `generateHolisticPrePackingAssessmentItems`: split inventory into batches, run parallel LLM calls, parse+validate with `conceptId` check, retry uncovered, return flat question array. Add `conceptId` to prompt template. |
| `api.js` | Delete count-mismatch throw from `normalizePrePackingAssessmentQuestions` (R7). Keep partial recovery logic. |
| `study.js` | Replace `buildKnowledgeProfile` (or equivalent) with R5 implementation. |
| `session.js` | Update `packInventoryToBlocks` to use `byConceptId` mastery map (R6). Replace old holistic mastery lookup. |
| `session-types.js` | Add `KnowledgeProfile` type: `{ byConceptId: Record<string, {assessed: boolean, correct?: boolean}>, assessedCount: number, notAssessedCount: number, correctCount: number, generatedAt: number }`. |

---

## 7. Implementation sequence (risk-ordered)

1. **R7 first** — Remove the count-mismatch throw. This alone stops the hard error. Confirm assessment flow reaches `screenPrePackingResults` with truncated responses. No other changes yet.

2. **R1 + R2** — Rewrite generation to batch by 20 concepts. Add `conceptId` to prompt. Run with 70-concept inventory and confirm all batches return valid JSON without truncation.

3. **R3 + R4** — Add coverage tracking and retry logic. Confirm `covered` set is complete after initial + retry rounds.

4. **R5** — Replace knowledge profile builder. Confirm `byConceptId` map is populated correctly from user responses.

5. **R6** — Wire new profile shape into `packInventoryToBlocks`. Confirm packing still produces correct block count and ordering.

---

## 8. Testing checklist

- [ ] Upload `large-sample.md` (110 KB, ~70 concepts). Assessment generation completes without error.
- [ ] All batches return parseable JSON (no truncation with batch size 20).
- [ ] Every question in the final array has a valid `conceptId` present in `conceptInventory`.
- [ ] No two questions share the same `conceptId`.
- [ ] `knowledge_profile.assessedCount + knowledge_profile.notAssessedCount === conceptInventory.length`.
- [ ] A concept answered correctly has `byConceptId[id].correct === true`.
- [ ] A concept answered incorrectly has `byConceptId[id].correct === false`.
- [ ] A concept with no question has `byConceptId[id] === { assessed: false }`.
- [ ] `packInventoryToBlocks` runs without error when `knowledge_profile` is the new shape.
- [ ] `packInventoryToBlocks` runs without error when `knowledge_profile` is `null` (LLM outage path).
- [ ] Upload `philosophy-sample.md` (~9 concepts). Single batch, no retries needed, completes in one LLM call.
- [ ] If all LLM calls fail (simulated), assessment is silently skipped and packing proceeds with neutral weights.

---

## 9. Open questions for Cursor before implementing

1. **Where exactly is `buildKnowledgeProfile` (or equivalent) called?** Search `study.js` for where user responses from `screenPrePackingAssessment` are converted into the object passed to `packInventoryToBlocks`. This is the replacement point for R5.

2. **Does `packInventoryToBlocks` currently receive a `knowledge_profile` argument directly, or does it read from `shared`?** Confirm the call signature before rewriting R6.

3. **Is `normalizePrePackingAssessmentQuestions` the only place the count-mismatch error is thrown?** Search `api.js` for all `throw` statements inside assessment-related functions before removing (R7).

4. **Does the existing partial recovery logic in `api.js` return an array or an object?** R3 assumes it returns an array of question objects — confirm this before wiring the `conceptId` validation step.

5. **What is the current `max_tokens` value for holistic assessment calls?** Compare against the proposed 6000 per batch to confirm it's sufficient and not a regression.

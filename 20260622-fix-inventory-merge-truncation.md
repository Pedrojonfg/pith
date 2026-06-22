# Spec: Fix Concept Inventory Merge Truncation

**ID:** `20260622-fix-inventory-merge-truncation`  
**Status:** Approved  
**Priority:** A — Urgent & Important (blocks all study modes)  
**Supersedes:** none  
**Must be implemented before:** `20260622-fix-dpp-recalculation-guard` (that spec reads `preparation.status` values defined here)

---

## Problem Statement

`deepSeekMergeConceptInventories` in `api.js` receives JSON responses truncated mid-object from DeepSeek. The response literally stops in the middle of a field value (visible in logs as `"modu` — the start of a word that never completes). This is a hard output token limit being hit during JSON generation.

The current retry loop makes **12+ identical LLM calls**, all of which fail the same way (same input → same truncation point → same result). This burns API budget with zero benefit.

After all retries fail, the code falls back to a stub result of exactly **3 synthetic concepts** with fabricated data. This stub is stored as `shared.conceptInventory` and `preparation.status` is set to `'ready'` — indistinguishable from a valid result. All downstream consumers (RSVP packing, mode recommendation, question generation) receive garbage and produce garbage.

For a 27-page document, the merge response needs to encode 40–60 concept objects. At ~100 tokens per object, that is 4,000–6,000 output tokens minimum. If `max_tokens` is set below this, truncation is guaranteed for every document of this length.

---

## Root Causes

1. **`max_tokens` too low** in the merge LLM call — DeepSeek hits the limit mid-JSON.
2. **No partial recovery** — when JSON is truncated, all successfully generated objects are discarded.
3. **Retry loop is wasteful** — retries identical input, identical truncation, 12 times.
4. **Stub fallback poisons status** — 3 synthetic concepts stored as `'ready'` propagates silently.
5. **Merge prompt may allow preamble** — if DeepSeek outputs any reasoning text before the JSON, it consumes output tokens that should go to concept data.

---

## Rules

### R1 — Raise `max_tokens` to 8192

In `deepSeekMergeConceptInventories`, set `max_tokens: 8192` on the LLM call. This is the maximum output token limit for `deepseek-chat`. Do not set it lower for "efficiency" — the merge step is a one-time upload cost and correctness matters more than marginal token savings here.

### R2 — Force JSON-only output in the merge prompt

The merge system prompt must include the following instruction verbatim:

```
Output ONLY valid JSON. No preamble, no explanation, no markdown code fences.
The first character of your response must be `{` and the last must be `}`.
```

This ensures zero output tokens are spent on reasoning text before the JSON begins.

### R3 — Implement `recoverPartialConceptArray(rawText)`

Add this function in `api.js` (or a shared utility imported by `api.js`). It extracts complete, individually-valid concept objects from a truncated JSON string using bracket counting, without relying on `JSON.parse` of the full response:

```javascript
/**
 * Extracts complete concept objects from a potentially truncated
 * JSON response. Uses bracket counting so it tolerates truncation
 * at any point after at least one complete object.
 *
 * @param {string} rawText — raw LLM response text
 * @returns {Object[]} array of parsed concept objects (may be empty)
 */
function recoverPartialConceptArray(rawText) {
  const conceptsMatch = rawText.match(/"concepts"\s*:\s*\[/);
  if (!conceptsMatch) return [];

  const arrayStart = conceptsMatch.index + conceptsMatch[0].length;
  const text = rawText.slice(arrayStart);

  const recovered = [];
  let depth = 0;
  let inString = false;
  let escape = false;
  let objectStart = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        try {
          const obj = JSON.parse(text.slice(objectStart, i + 1));
          recovered.push(obj);
        } catch (_) { /* skip malformed */ }
        objectStart = -1;
      }
    }
  }

  return recovered;
}
```

### R4 — Run partial recovery BEFORE each retry, not after all retries fail

Current loop structure (pseudocode):
```
attempt 1 → parse fails → retry
attempt 2 → parse fails → retry
...
attempt 12 → parse fails → use 3-stub fallback
```

New loop structure:
```
attempt 1 → parse fails → run recoverPartialConceptArray
  → recovered >= MIN_VIABLE_CONCEPTS? → accept, STOP
  → recovered < MIN_VIABLE_CONCEPTS? → retry (attempt 2)
attempt 2 → parse fails → run recoverPartialConceptArray
  → recovered >= MIN_VIABLE_CONCEPTS? → accept, STOP
  → recovered < MIN_VIABLE_CONCEPTS? → FAIL (no more retries)
```

**Maximum total LLM calls for the merge step: 3** (initial + 2 retries). Never more.

### R5 — Define `MIN_VIABLE_CONCEPTS(charCount)`

```javascript
// In config/flags.js — add these two constants:
export const MIN_CONCEPTS_ABSOLUTE = 5;
export const MIN_CHARS_PER_CONCEPT = 5000;

// Usage:
function minViableConcepts(charCount = 0) {
  return Math.max(MIN_CONCEPTS_ABSOLUTE, Math.floor(charCount / MIN_CHARS_PER_CONCEPT));
}
```

For a 27-page document (~54,000 chars): `max(5, 10)` = **10 concepts minimum**. This correctly rejects the 3-stub fallback. For a 1-page document (~2,000 chars): `max(5, 0)` = 5. The absolute floor prevents false negatives on very short documents.

`charCount` is available from `shared.docMeta.charCount`, which is set during DPP T0.2 (text metrics) before the inventory phase runs.

### R6 — Remove the 3-stub fallback entirely

Locate the code that generates the 3 synthetic concept objects when all retries fail. **Delete it.** Replace with:

```javascript
// On total merge failure:
console.warn('[inventory-merge] All attempts failed. Marking DPP as failed.');
return { concepts: [], failReason: 'MERGE_TRUNCATED' };
```

The caller (`document-preparation.js` or wherever DPP phase T1.2 runs) must handle a `concepts: []` result by setting:
```javascript
session.shared.conceptInventory = [];
session.shared.preparation.status = 'failed';
session.shared.preparation.failReason = 'INVENTORY_MERGE_FAILED';
```

**Never set `preparation.status = 'ready'` when `conceptInventory.length < minViableConcepts(charCount)`.**

### R7 — Validate concept count before setting status `'ready'`

After any successful (non-truncated, fully parsed) merge result, add a final sanity check before marking the session ready:

```javascript
const minRequired = minViableConcepts(session.shared.docMeta?.charCount ?? 0);
if (mergedConcepts.length < minRequired) {
  // Semantically empty result — treat as failure
  session.shared.preparation.status = 'failed';
  session.shared.preparation.failReason = 'INVENTORY_TOO_SPARSE';
  session.shared.conceptInventory = mergedConcepts; // keep what we have for debug
  return;
}
// Only now:
session.shared.conceptInventory = mergedConcepts;
session.shared.preparation.status = 'ready'; // or 'partial' if other phases pending
```

### R8 — Log partial recovery attempts

At INFO level (console.log), log each partial recovery attempt:
```
[inventory-merge] Parse failed. Running partial recovery on N chars of raw response.
[inventory-merge] Partial recovery: extracted M complete objects.
[inventory-merge] Partial recovery accepted (M >= minRequired K). Proceeding without retry.
```
or:
```
[inventory-merge] Partial recovery insufficient (M < minRequired K). Retrying LLM call (attempt 2/3).
```

---

## Non-Goals

- Do NOT change the chunk-splitting logic upstream (how the document is divided before inventory extraction on each chunk). That is a separate concern.
- Do NOT change `max_tokens` on per-chunk inventory calls — only the merge call.
- Do NOT change the concept schema or field names.
- Do NOT add a UI affordance for retrying DPP — that is handled in spec `20260622-fix-dpp-recalculation-guard` R7.
- Do NOT tune `MIN_CHARS_PER_CONCEPT` based on observed data — these are unvalidated placeholders to be calibrated post-launch, same policy as all other numeric thresholds in the codebase.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/js/api.js` | Increase `max_tokens` in merge call; add `recoverPartialConceptArray`; restructure retry loop (R1–R4) |
| `src/js/document-preparation.js` | Remove 3-stub fallback; handle `concepts: []` result; add post-merge count validation before setting `'ready'` (R6–R7) |
| `src/js/config/flags.js` | Add `MIN_CONCEPTS_ABSOLUTE` and `MIN_CHARS_PER_CONCEPT` (R5) |

**Cursor:** search `api.js` for the string `"trying next attempt"` to locate the retry loop. Search `document-preparation.js` and `session.js` for arrays of exactly 3 hardcoded stub concept objects to locate the fallback. The stub likely looks like `[{ id: 'c1', title: '...', ... }, { id: 'c2', ... }, { id: 'c3', ... }]` or similar. Verify location before modifying.

---

## Implementation Sequence (risk order)

1. Add `MIN_CONCEPTS_ABSOLUTE` and `MIN_CHARS_PER_CONCEPT` to `config/flags.js`.
2. Implement `recoverPartialConceptArray` in `api.js` and unit-test it in isolation with a truncated JSON string.
3. Restructure the merge retry loop in `api.js` (R4) — cap at 3 total calls, run recovery between attempts.
4. Set `max_tokens: 8192` and add the JSON-only instruction to the merge prompt (R1–R2).
5. Remove 3-stub fallback in `document-preparation.js` / wherever it lives (R6).
6. Add post-merge count validation before setting `'ready'` (R7).
7. Verify that `preparation.status` is correctly `'failed'` when inventory is empty.

---

## Testing Checklist

- [ ] Upload a document ≥ 20 pages. Open DevTools → Network. Count calls to `api.deepseek.com` during DPP. Total merge calls must be ≤ 3 (was 12+).
- [ ] After upload completes, inspect `session.shared.conceptInventory` in DevTools console. For a 20+ page document, `length` must be ≥ 10.
- [ ] After upload completes, inspect `session.shared.preparation.status`. Must be `'ready'`, not `'failed'`, for a normal document.
- [ ] Simulate truncation: temporarily lower `max_tokens` to 500 in the merge call. Verify that partial recovery extracts some concepts and does NOT fall back to 3-stub. Restore `max_tokens` after test.
- [ ] Simulate total failure: lower `max_tokens` to 50. Verify `preparation.status` is `'failed'` and `conceptInventory` is `[]`, not the 3-stub array.
- [ ] Confirm no `"trying next attempt"` log appears more than 2 times per upload.
- [ ] `recoverPartialConceptArray` unit test: pass it a string that is a valid concepts array truncated after the second complete object. Verify it returns exactly 2 objects.

---

## Open Questions for Cursor

1. Is the 3-stub fallback generated inside `api.js` (`deepSeekMergeConceptInventories`) itself, or in `document-preparation.js` after the merge call returns? The fix location depends on this — verify before modifying.
2. What is the current `max_tokens` value in the merge call? Log it before changing so we know the baseline.
3. Does the merge prompt currently contain any instruction about output format, or does it assume the model will output JSON without being told? If no format instruction exists, adding R2 may produce the largest improvement by itself.

# Contract: Source Fidelity Rules (Prompt Layer)

**Module**: `src/js/source-fidelity.js` (NEW), consumed by `src/js/api.js`, `src/js/guide-chat.js`

## Exports

```javascript
export const SOURCE_FIDELITY_RULES = `...`;  // markdown prompt block

export function buildSourceFirstRsvpStructure({ isVocabularyBlock, requireConnection });

export function mergeFidelityIntoSystemPrompt(basePrompt, { strictMode, extractedClaims });
```

## SOURCE_FIDELITY_RULES (semantic requirements)

The constant MUST instruct the model to:

1. Treat uploaded material as supreme authority for definitions, classifications, taxonomies, examples.
2. Paraphrase for RSVP length — never substitute encyclopedic/domain-default definitions.
3. NOT introduce concepts, authors, dates, or categories absent from: source chunk + block title + block inventory scope.
4. Omit example/contrast sections when source is silent (no invented "real-world case").
5. On conflict between generic knowledge and author usage, **author wins**.
6. Questions and feedback must be answerable only from chunk + generated explanation grounded in chunk.

## EXPLANATION structure replacement

Replace `EXPLANATION_RSVP_THOROUGH` anti-source clauses:

| Remove | Replace with |
|--------|----------------|
| "explain to a smart 16-year-old" | "preserve the author's technical sense in plain RSVP prose" |
| "Concrete example — real instance" (mandatory) | "Example paragraph only if the source chunk contains one" |
| "Contrast — common confusions" (mandatory) | "Contrast only if the source mentions confusion or opposition" |
| "Do NOT copy source prose" | "Do NOT contradict or replace source definitions; paraphrase short sentences" |

Vocabulary blocks: definitions MUST track chunk wording for each term in `signature`.

## Surfaces that MUST include SOURCE_FIDELITY_RULES

- `buildBlockGenerationSystemPrompt`
- `buildQuestionsOnlySystemPrompt`
- `buildConceptInventoryPrompt` (+ require `source_phrase`)
- `buildPrePackingAssessmentSystemPrompt`
- `buildSplitBlocksPrompt` — remove "Design for learning—not for mirroring the document"
- `buildGuidePrompt` / guide system string
- `CONCEPT_DICTIONARY_EXTRACTION_RULES` — align with enrichment (no "scope hint" that invites invention)

## strictMode branch

When `strictMode === true` and `extractedClaims` provided:

- System prompt: "Write explanation ONLY from extracted claims JSON; omit empty claim types."
- MUST NOT add pedagogical sections not represented in claims.

## Tests (no LLM)

- `SOURCE_FIDELITY_RULES` length > 200 chars, contains "supreme" or equivalent authority phrase
- `buildBlockGenerationSystemPrompt({...})` output includes fidelity marker substring
- `buildSplitBlocksPrompt` output does NOT contain "not for mirroring"

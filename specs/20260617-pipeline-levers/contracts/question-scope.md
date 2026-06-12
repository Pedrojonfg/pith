# Contract: Question Scope by Block Type (L14, L18)

**Feature**: `20260617-pipeline-levers` | **Levers**: L14, L18 | **Priority**: P1

## Block type detection

Derive `block_type` from title prefix:

| Title prefix | block_type |
|--------------|------------|
| Key terms: | key_terms |
| Overview: / Course map: | overview |
| (default development titles) | development |

## Allowed / forbidden question types

| block_type | ALLOWED | FORBIDDEN |
|------------|---------|-----------|
| key_terms | definition, classification, etymology, term contrast | application, argument analysis, consequences |
| overview | (none — n_test=0 via L15) | all |
| development | application, contrast, argument, consequence, example | definition of terms in preceding Key terms of same module |
| excursus | connection to main concept, implication | standalone definition |

## Prompt section (questions only)

```text
QUESTION TYPE RESTRICTION for block type "{block_type}":
- ALLOWED: {allowed.join(", ")}
- FORBIDDEN: {forbidden.join(", ")}

ALREADY QUESTIONED in previous blocks:
{alreadyQuestionedTerms.join(", ")}

Rules:
1. Do NOT ask "what is X?" or "define X" for any term in ALREADY QUESTIONED.
2. You MAY ask about relationships, contrasts, or implications involving those terms.
3. At least {ceil(n_test * 0.4)} questions must cover material NOT in ALREADY QUESTIONED.

{if development && precedingKeyTerms}
Do NOT ask "what is X?" for terms defined in preceding Key terms block:
{precedingKeyTermsSignature.join(", ")}
{/if}
```

## precedingKeyTermsSignature

Build from previous block in same `module` with `block_type === key_terms`:
- `signature[]` + concept titles from `concept_ids`

## Modules

- `src/js/api.js` — question generation prompts
- `src/js/study.js` or `session.js` — helper `buildQuestionScopeContext(blockIndex)`

## Tests

- Development block after Key terms → prompt contains FORBIDDEN list with Key terms signatures
- `alreadyQuestionedTerms` populated from prior block question stems (heuristic, no LLM)

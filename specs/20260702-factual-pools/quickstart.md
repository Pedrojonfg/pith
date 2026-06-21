# Quickstart QA: Factual Question Stem Pools

## Prerequisites

- `DETERMINISTIC_FACTUAL_QUESTIONS_ENABLED: true` in flags
- DeepSeek API key configured
- Document with multiple dates and numeric values

## Manual checks

1. Upload a history PDF with several dates → start RSVP → verify date questions use varied phrasing across blocks.
2. Upload a science doc with km and kg values → inspect MCQ options; no kg option on a km question.
3. Upload a 1-page doc with single date → that concept should still get a question (LLM path).
4. Check llm_usage_logs: one `distractor_validation` entry per block with templated factuals, not per concept.

## Automated

```bash
node cursor-tests/20260621_stem-pool-rotation.mjs
node cursor-tests/20260621_distractor-unit-matching.mjs
node cursor-tests/20260621_distractor-pool-insufficient-fallback.mjs
node cursor-tests/20260621_validation-rejects-ambiguous.mjs
node cursor-tests/20260621_validation-batch-not-per-concept.mjs
node cursor-tests/20260621_post-validation-fallback.mjs
node cursor-tests/20260621_definitions-enumerations-unaffected.mjs
```

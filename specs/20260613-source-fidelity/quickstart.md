# Quickstart QA: Study Source Fidelity

**Feature**: `20260613-source-fidelity`

## Prerequisites

- API key configured (DeepSeek or Gemini)
- PDF or MD fragment with **non-standard definition** of a technical term (e.g. course-specific sense of a ethics term)
- Branch `20260613-source-fidelity` with implementation complete

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260613_source-fidelity.mjs
```

## Manual QA checklist

### QA-SF-A1 — Block definition matches source (Phase A)

- [x] Upload ethics/philosophy fragment where author defines term non-encyclopedically
- [x] Generate blocks + study first relevant block
- [x] RSVP explanation uses author's classification, not generic textbook definition
- [x] No invented "real-world example" when source has none

### QA-SF-A2 — Guide chat grounded (Phase A)

- [x] Ask tutor about term from current block
- [x] Answer aligns with PDF chunk, does not contradict
- [x] Ask about topic absent from material → one-sentence "text does not cover this"

### QA-SF-B1 — Chunk alignment (Phase B)

- [x] Material where pedagogical block order ≠ document order (long PDF)
- [x] Inspect block_index chunks (dev tools / export): block titled X contains passages about X
- [x] Weak anchor blocks show banner when term match poor

### QA-SF-B2 — Validation warn (Phase B)

- [x] (Dev) force weak chunk + observe fidelity retry or warn banner after generation
- [x] `fidelity_status: warn` blocks show UI message

### QA-SF-C1 — Strict mode (Phase C)

- [x] Enable "Modo estricto" on create
- [x] Generated block has no entities absent from source (spot-check vs PDF)
- [x] Standard mode still works with fidelity rules but without extract pass

### QA-SF-C2 — Guide document search (Phase C)

- [x] Ask definitional question about term in later section before studying that block
- [x] Tutor cites/paraphrases from document
- [x] Ask synthetic question about unread block → spoiler-safe decline

### QA-SF-REG — Regression

- [x] Questions mode block generation still works
- [x] Pre-packing assessment still generates
- [x] Offline mode unaffected
- [x] Block split fallback mono still assigns chunks (with alignment or explicit fallback)

## Success criteria

All QA-SF-* pass; cursor-tests green; SC-001..006 from spec spot-checked on real material.

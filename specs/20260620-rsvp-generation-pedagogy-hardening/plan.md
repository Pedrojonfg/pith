# Implementation Plan: RSVP Generation Pedagogy Hardening

**Branch**: `20260620-rsvp-generation-pedagogy-hardening` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

## Summary

Wire pre-packing `learning_goal` into block `_config`, restore global Strict/Standard fidelity in Settings, add bounded question-count retry with diagnostics, insert analogy Rule D, and add structured bold section headers for development RSVP blocks with downstream validation fixes.

## Technical Context

**Language/Version**: JavaScript ES modules (browser + Node cursor-tests)  
**Primary Dependencies**: `study.js`, `session.js`, `api.js`, `source-fidelity.js`, `explanationParagraphs.js`, `rsvp.js`, `pipeline-levers.js`, `config/flags.js`  
**Storage**: localStorage (`LS_SOURCE_FIDELITY_STRICT_KEY`), session `blocks[i]._config`  
**Testing**: `cursor-tests/20260620_rsvp-pedagogy-hardening.mjs`  
**Constraints**: English internal; one retry max for questions; SW bump on ship; no new LLM paths for mnemonics

## Constitution Check

| Principle | Status |
|-----------|--------|
| English UI / internal | PASS |
| PWA versioning on src/js + index.html | PASS (T06) |
| LLM max_tokens where applicable | PASS (no new large JSON calls) |
| No silent degradation | PASS (diagnostics on short questions) |

## Project Structure

```text
src/js/session.js              # mapKnowledgeProfileToBlockConfig, normalizeGapFocus
src/js/study.js                # runPrePackingPack, ensureBlockGenerated, connection hook
src/js/api.js                  # relational_compressed, headers prompt, gap formatting
src/js/source-fidelity.js      # Rule D
src/js/rsvp-section-headers.js # header pool + prompt fragment (new)
src/js/explanationParagraphs.js # header-aware validation
src/js/config/flags.js         # setter already exists
index.html                     # Settings Standard/Strict control
src/js/ui.js                   # fidelity settings UI
cursor-tests/20260620_rsvp-pedagogy-hardening.mjs
sw-update.js, sw.js, index.html ?v=
```

## Phase 0 Output

See [research.md](./research.md).

## Phase 1 Output

See [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md).

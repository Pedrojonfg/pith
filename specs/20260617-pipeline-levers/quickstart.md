# Quickstart QA: RSVP Pipeline Levers

**Feature**: `20260617-pipeline-levers`

## Prerequisites

- API key configured
- Documento de prueba: apuntes de ética (~60 páginas o fragmento representativo) con delimitadores ❖ y ➔
- Modo estricto activado (`source_fidelity_mode: strict`)
- Branch `20260617-pipeline-levers` con Sprint 0+ implementado

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260617_pipeline-levers.mjs
```

## Manual QA checklist

### QA-PL-0 — Sprint 0 quick wins

- [x] Key terms block generates explanation but **zero** test/socratic questions
- [x] Overview block has zero questions
- [x] Dedup in strict mode merges blocks with 2 shared signature terms (not only 3)
- [x] `deepSeekRegenerateBlockQuestions` accepts `coverageManifest` param (empty array OK)

### QA-PL-1 — Overlap reduction

- [x] After Key terms + development blocks in same module, development questions do NOT ask "what is X?" for Key terms vocabulary
- [x] `alreadyQuestionedTerms` appears in question prompt for block 3+
- [x] Overlap audit triggers retry when explanations repeat prior blocks (spot-check dev mock)

### QA-PL-2 — Content density

- [x] 15k-word dense doc produces inventory ≥ 30 concepts (target dynamic)
- [x] Block explanation covers ≥60% of extracted claims OR retries once
- [x] Plain-text ❖ sections appear in docHierarchy

### QA-PL-3 — Advanced (Sprint 2+)

- [x] coverageManifest grows after each studied block
- [x] Chunks snap to section boundaries when hierarchy present
- [x] Two-pass inventory adds level-2 concepts for dense docs

### QA-PL-4 — Glossary lateral (Sprint 3)

- [x] Key terms block skipped in linear study sequence
- [x] Glossary/reference UI shows Key terms definitions

### QA-PL-REG — Regression

- [ ] Non-strict RSVP still generates blocks normally
- [ ] Pre-packing assessment unaffected
- [ ] Questions mode unaffected
- [ ] Offline mode unaffected

## Success criteria spot-check

| Criterion | How to verify |
|-----------|---------------|
| SC-001 80% overlap reduction | Compare question stems Key terms vs dev (manual count) |
| SC-002 ≥1.5 concepts/page | inventory.length / pageCount |
| SC-003 70% blocks claim coverage | Export fidelity metrics from 10 blocks |
| SC-004 ≤2 duplicate questions in 10-block session | User study session |
| SC-005 ≤40% latency Sprint 0–1 | Time generate 5 blocks before/after |

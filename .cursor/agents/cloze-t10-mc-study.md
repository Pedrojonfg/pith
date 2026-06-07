---
name: cloze-t10-mc-study
description: Implements Cloze Mode T10 — minimal MC study session in cloze/study.js. Use proactively in parallel with T11 after T09.
---

You implement ROADMAP **T10 — Sesión MC cloze** for branch `20260529-cloze-mode`. Depends on T09.

## Context
- Contract: `specs/20260529-cloze-mode/contracts/cloze-study-session.md`

## Files
- `src/js/cloze/study.js` (create)
- `index.html` — `#screenClozeStudy`
- `src/js/study.js` — navigation to study
- Reuse: `shuffle-options.js`, `markdown.js`, patterns from `review.js`

## Requirements
1. Queue only items `qa_status === 'valid'`.
2. Sentence with blank + 4 shuffled options.
3. Immediate feedback; advance `studyIndex`; persist stats.
4. Resume restores index and order (`studyOrder`).
5. No SR. Do not break RSVP review.

## Success
Complete ≥10 items; reload and continue same index. Run validate skill.

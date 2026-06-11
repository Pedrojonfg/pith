# Quickstart: Mode Continuity

**Feature**: `20260612-mode-continuity`

## Prerequisites

- Branch `20260612-mode-continuity`
- API key configured for RSVP generate + Cloze pipeline tests
- Dev server: `npx serve` or project default

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260612_mode-continuity.mjs
```

## Manual QA checklist

> Automated coverage: `cursor-tests/20260612_mode-continuity.mjs` (assessment, bootstrap, sync, cloze order, applyModeEntry smoke). Manual steps below validate UI end-to-end.

### QA-MC-1 — Recommend → RSVP sin re-upload

1. Mode select → upload PDF via **Recommend flow** button
2. Wait for recommendation panel
3. Click **Start** (first recommended step) or override to RSVP
4. **Expect**: Create screen shows “Document ready” banner; no empty file upload required
5. Click **Generate blocks** — uses loaded material

### QA-MC-2 — Recommend → Cloze bootstrap

1. Upload via recommend; choose Cloze from override
2. **Expect**: Cloze panel with loaded material, no re-upload
3. Generate items — pipeline runs on shared markdown

### QA-MC-3 — RSVP → shared inventory → Cloze skip phase 0

1. Complete RSVP generate with API (inventory in shared)
2. Return to mode select → Continue Cloze from flow panel
3. **Expect**: Cloze generation skips epistemic LLM phase 0 when inventory ≥ 5

### QA-MC-4 — Wrong answers → Cloze priority

1. RSVP session: answer several block questions incorrectly
2. Open Cloze on same document; generate items
3. **Expect**: First ~60% study items map to weak concepts (check study order / first items)

### QA-MC-5 — Mode switch manual

1. Active doc with RSVP in progress
2. Select Slow from mode radio without new upload
3. **Expect**: Slow scope screen with same document

### QA-MC-6 — New session in mode only

1. Cloze with saved session → **New session** → confirm
2. **Expect**: Cloze slice reset; RSVP/shared inventory intact

### QA-MC-7 — Persistence

1. Complete QA-MC-1 through step 4
2. Reload browser
3. Reopen document from library or active session
4. **Expect**: Same doc, recommendation progress, no re-upload

## Done criteria

- [x] Automated: assessment unit (10+), bootstrap (8+), sync inventory + signals, cloze prioritize ≥60% weak-first
- [x] Automated: `applyModeEntry` + resolve bootstrap smoke (T08)
- [ ] Manual: QA-MC-1 through QA-MC-7 in browser (API key required for generate paths)
- [x] cursor-tests suite green (`node --import ./cursor-tests/register.mjs cursor-tests/20260612_mode-continuity.mjs`)
- [x] No regression on legacy upload path (no active doc → `upload_required` / file input shown)

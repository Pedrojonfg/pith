# Quickstart — RSVP Embedded Assessment Signals

## Automated

```bash
node cursor-tests/20260621_rsvp-embedded-assessment.mjs
node cursor-tests/20260620_rsvp-shared-consumption.mjs
node cursor-tests/20260606_validate-sw-update-flow.mjs
```

## Manual smoke

1. Load a document with generated blocks.
2. RSVP mode → complete a block → answer Test MCQ → check Vault gray→yellow for block concept.
3. Same document → Questions mode → answer Test MCQ → verify `assessmentSignals` merges (no duplicate keys).
4. RSVP → Socratic sub-screen → submit answer → verify `smItems` gains `{blockId}:socratic:{qi}` entry.
5. Re-answer same question → signal weight merges, no duplicate registry concept.

## Checklist (spec §6)

- [ ] MCQ RSVP → signals + smItems + promotion
- [ ] MCQ Questions → same downstream shape
- [ ] Socratic RSVP → signals + smItems + promotion
- [ ] Socratic Questions → same
- [ ] Re-answer dedup
- [ ] No new LLM in signal path
- [ ] Mode recommendation unchanged (automated fixture)

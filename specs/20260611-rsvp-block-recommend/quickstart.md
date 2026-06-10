# Quickstart: RSVP Block Count Recommendation

**Feature**: `20260611-rsvp-block-recommend`

## Prerequisites

- Branch `20260611-rsvp-block-recommend` o `.specify/feature.json` apuntando a este spec
- API key LLM configurada (inventario requiere LLM)
- `20260609-flow-recommendation` operativo (analyzer + meta)

## Automated tests

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260611_rsvp-block-recommend.mjs
```

## QA checklist status

- [x] **QA-REC-1** — Recommend pre-fill (automated DOM/wiring smoke + manual)
- [x] **QA-REC-2** — Single inventory on generate (study.js cache branch + manual)
- [x] **QA-REC-3** — Manual path regression (session exports + manual)
- [x] **QA-REC-4** — Invalidation on notes (cache fingerprint tests + manual)
- [x] **QA-REC-5** — Invalidation on file (cache fingerprint tests + manual)
- [x] **QA-REC-6** — Re-recommend without changes (cache valid-on-match + manual)
- [x] **QA-REC-7** — RSVP scope only (DOM/wiring smoke + manual)

## Manual QA

### QA-REC-1 — Recommend pre-fill (FR-001, FR-004, FR-005)

1. Mode select → RSVP → create screen
2. Upload medium PDF (~8k words)
3. Click **Recommend block count** (do not generate yet)
4. **Expect**: `Indexing concepts…` then Blocks field updates (5–60); `#recommendBlocksWhy` shows reasoning

### QA-REC-2 — Single inventory (SC-001, FR-006)

1. Complete QA-REC-1
2. Note recommended N; optionally tweak ±2
3. Click **Generate blocks**
4. **Expect**: Progress shows **Packing** without second **Indexing concepts…**; block list screen loads

### QA-REC-3 — Manual path regression (FR-008, SC-005)

1. Upload new file; **skip** Recommend
2. Set Blocks = 20; Generate
3. **Expect**: Full pipeline works as before (indexing + packing)

### QA-REC-4 — Invalidation on notes (FR-007, SC-004)

1. Recommend successfully
2. Edit study focus notes
3. **Expect**: Why text cleared / stale state; next Generate does full split OR next Recommend re-indexes

### QA-REC-5 — Invalidation on file (FR-007)

1. Recommend on file A
2. Replace with file B
3. **Expect**: Cache cleared; old recommendation not shown as valid

### QA-REC-6 — Re-recommend without changes (edge)

1. Recommend twice without changing file/notes
2. **Expect**: Second click fast; no duplicate indexing message

### QA-REC-7 — RSVP scope only (FR-009)

1. Switch create mode to Questions or Slow
2. **Expect**: `#recommendBlocksBtn` hidden

## Sanity samples (SC-002)

| Material | Expect N range (rough) |
|----------|------------------------|
| 2-page handout (~1.5k words, ~8 concepts) | 5–8 |
| Medium chapter (~12k words, ~35 concepts) | 10–20 |
| Long dense philosophy (~40k words, ~70 concepts) | 25–45 |

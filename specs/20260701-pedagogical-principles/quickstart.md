# Quickstart: Pedagogical Principles Layer

## Verify flags

Open devtools → import flags:
```js
import { PEDAGOGICAL_FLAGS } from './src/js/config/flags.js';
console.log(PEDAGOGICAL_FLAGS);
```

## R4 — Review priority

1. Create session with mixed smItems (document + gap_fill provenance).
2. Open Review → confirm document items appear before gap_fill at equal due-ness.
3. With >3 gap_fill due, confirm cap applies.

## R1 — Factual templates

1. Upload doc with dated facts.
2. After DPP, inspect `conceptInventory[].questionClass`.
3. Generate RSVP blocks → factual concepts use template questions.

## R2 — Comprehension gate

1. Find conceptual concept without `comprehensionConfirmed`.
2. Answer MCQ → no SM-2 item.
3. Complete Recall with partial+ → item enters queue.

## R5 — Why this

1. Open review item → see one-line explanation.

## R3 — Dim/highlight

1. Slow Mode reader with vault-mapped concepts → familiar text dimmed.

## R6 — Novelty packing (opt-in)

1. Set `NOVELTY_BIASED_PACKING_ENABLED: true` in flags.
2. Re-pack → blocks skew toward novel concepts.

## Tests

```bash
node cursor-tests/20260621_factual-classification.mjs
node cursor-tests/20260621_gap-fill-cap.mjs
node cursor-tests/20260621_time-as-orderer-preserved.mjs
node cursor-tests/20260621_why-this-priority.mjs
node cursor-tests/20260621_novelty-packing-blend.mjs
```

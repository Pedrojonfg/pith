# Quickstart QA — Document Preparation Front-Load

## Prerequisites

- Valid DeepSeek/Gemini API key in settings
- 12k-char markdown or PDF fixture

## Scenario 1 — Upload once, ready document (P1)

1. Upload fixture from Session Hub or create flow
2. Observe unified "Preparing document…" progress with phase labels
3. Wait until library shows **Ready** badge
4. Open mode select — no empty upload form
5. Assert in devtools: `shared.preparation.status === 'ready'`, `conceptInventory.length > 0`

## Scenario 2 — RSVP recommended N (P1)

1. After prep ready, enter RSVP create
2. Blocks field shows recommended N + rationale within 1s (no Recommend click)
3. Click **Generate blocks** — progress shows pack only, not "concept indexing"
4. Network/devtools: no inventory LLM call

## Scenario 3 — Cloze pre-generated (P1)

1. After prep ready, enter Cloze
2. Valid item count > 0; **Study** enabled without Generate
3. EDGE-type items exist when fixture is argumentative

## Scenario 4 — Resume prep (edge)

1. Start upload prep; navigate away mid-wave
2. Return to document — prep resumes from last completed phase

## Scenario 5 — Partial failure

1. Simulate cloze phase failure (mock or broken fixture)
2. Document shows **Partial**; RSVP/Recall still usable
3. Retry runs cloze phases only

## Automated

```bash
node cursor-tests/20260618_document-preparation-frontload.mjs
```

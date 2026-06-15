# Quickstart: Cross-Document Concept Vault

**Feature**: `20260626-cross-doc-vault`

## Prerequisites

- API key configured
- At least one document with concept inventory (full study or ingest-only)

## Scenario 1 — Gray to yellow via RSVP

1. Open Sessions → select document → RSVP mode.
2. Answer one MCQ tagged to concept "Foo".
3. Open browser devtools → `localStorage.getItem('mylearning_concept_registry')`.
4. **Expect**: One concept with `canonicalName` matching Foo, `maturity: "yellow"`, `facets` containing `recognition`.
5. **Expect**: Document `shared.conceptInventory` entry for Foo has `globalConceptId` set.

## Scenario 2 — Global review queue (no duplicate)

1. Study concept "Foo" in document A (RSVP).
2. Open same concept in document B inventory; answer one question in document B.
3. Run Review from Vault branch.
4. **Expect**: One recognition-facet item for Foo globally, not two.

## Scenario 3 — Yellow to green via Recall

1. From Vault graph, click yellow node "Foo" → Study this (Recall).
2. Submit synthesis response that passes tutor quality (≥ 2).
3. Open concept page for Foo.
4. **Expect**: `maturity: "green"`, visible content block, supersession history expandable.

## Scenario 4 — Vault cold vs document context graph

1. App Home → Vault → graph view (no document focused).
2. **Expect**: Only yellow/green nodes.
3. Navigate to document → Vault with document context.
4. **Expect**: Gray neighbors from that document's inventory appear.

## Scenario 5 — Ingest-only upload

1. Sessions → upload file via ingest path (inventory only).
2. **Expect**: Document in library; inventory populated; no mode slices; all `globalConceptId: null`.
3. Open Vault with document context → gray nodes visible.

## Scenario 6 — No curation gate

1. Complete RSVP session with studied concepts.
2. Open Session Hub.
3. **Expect**: No "Upload to vault" curation screen; concepts already in registry if engaged.

## Regression

- Run `node cursor-tests/20260626_cross-doc-vault.mjs`
- Run `node cursor-tests/20260620_sm2-priority-queue.mjs`
- Run `node cursor-tests/20260606_validate-sw-update-flow.mjs` after SW bump

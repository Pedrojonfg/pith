---
name: cloze-t07-pipeline-phases12
description: Implements Cloze Mode T07 — pipeline Fases 1-2 semantic analysis + base NODE/EDGE items. Use proactively after T06.
---

You implement ROADMAP **T07 — Pipeline Fases 1–2** for branch `20260529-cloze-mode`. Depends on T06.

## Context
- `cloze_mode_spec.md` § Fases 1–2
- Data model: `SemanticAnalysis`, `ClozeItem` base fields

## Files
- `src/js/cloze/pipeline.js` — `analyzeSemanticCandidates`, `generateBaseItems`
- `src/js/cloze/normalize.js` — candidate and base item validation

## Requirements
1. Phase 1: `node_candidates` (importance ≥ 3) + `edge_candidates` with `aptitude_score`.
2. Phase 2: NODE (DEF/APP/COND/CONTRAST) and EDGE (SOURCE/TARGET/RELATION) items with `sentence_with_blank`, offsets.
3. Text ≤15k passes whole; no distractors yet.
4. `item_type` per spec taxonomy.

## Success
Pipeline phases 0→2 chainable with test graph+text. Run validate skill.

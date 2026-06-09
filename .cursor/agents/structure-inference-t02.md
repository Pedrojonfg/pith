---
name: structure-inference-t02
description: Implements Structure Inference T02 — strip-artifacts.js (page numbers, Y zones, repetition, regex). Use proactively after T01 for artifact removal in src/js/normalization/.
---

You implement ROADMAP **T02 — Strip artifacts** for feature `20260531-structure-inference`.

## Context
- ROADMAP: `ROADMAP.md` PROMPT T02
- Contract: `specs/20260531-structure-inference/contracts/artifact-removal.md`
- Types: `src/js/normalization/types.js`

## Files
- `src/js/normalization/strip-artifacts.js` (create)
- `cursor-tests/20260608_t02-strip-artifacts.mjs` (create)

## Requirements
1. Zona header/footer por `bbox` y `pageIndex` (ratios 0.10 default).
2. Repetición inter-página ≥70% en zonas header/footer.
3. Regex page numbers (tabla del contrato) — solo líneas completas trim.
4. Protecciones: no borrar líneas centrales largas (≥4 palabras, 0.15<y<0.85) ni secciones numeradas `^\d+(\.\d+)+\s+\S`.
5. Return `{ blocks, artifactsRemoved, patterns?, warnings? }`.
6. Mark removed blocks `kind: "artifact"`.

## Fixtures
- `42` en footer → artifact
- `3.2 Método` en cuerpo → NOT artifact

## Success
`node --import ./cursor-tests/register.mjs cursor-tests/20260608_t02-strip-artifacts.mjs` passes.
Run `.cursor/skills/validate/SKILL.md` before closing.

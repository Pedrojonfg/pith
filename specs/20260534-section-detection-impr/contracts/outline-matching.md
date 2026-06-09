# Contract: Outline Matching with Tolerant Normalization

**Feature**: `20260534-section-detection-impr` | **Module**: `pdf-outline.js`

## Purpose

Matchear entradas `doc.getOutline()` a bloques extraídos aunque el texto del bloque tenga encoding corrupto o diacríticos distintos.

## API

```js
export function normalizeForComparison(str: string): string
export function applyEncodingFixups(str: string): string
export function matchScore(outlineTitle: string, blockText: string): number
export function matchScoreFallback(outlineTitle: string, blockText: string): number
export function matchOutlineToBlocks(outline, blocks): OutlineMatch[]
```

## normalizeForComparison (MUST)

1. `toLowerCase()`
2. `normalize('NFD')` + remove `[\u0300-\u036f]`
3. Replace punctuation with space: `[^\w\s]` → space (unicode word chars)
4. Collapse whitespace, trim

## applyEncodingFixups (MUST)

Replace in comparison string only (not persisted text):

| Char | Replacement |
|------|-------------|
| `6` | `o` (first of table) |
| `0` | `o` |
| `1` | `i` |

## matchScore (MUST)

1. `normOutline = normalizeForComparison(outlineTitle)`
2. `normBlock = normalizeForComparison(applyEncodingFixups(blockText))`
3. Return existing `similarity(normOutline, normBlock)` (0–100)

**Accept threshold**: score ≥ 50 → match

## matchScoreFallback (MUST)

If primary score < 50:

1. `prefix = normalizeForComparison(outlineTitle).slice(0, 15)`
2. If `normalizeForComparison(applyEncodingFixups(blockText)).startsWith(prefix)` → return 60
3. Else return 0

## matchOutlineToBlocks output

Each match MUST include:

- `source: "outline"`
- `outlineLevel` from PDF tree depth
- `label` from outline title (not corrupted block text)
- `blockId`, `charStart`, `charEnd` after emission mapping

## Short-circuit input

Export `computeOutlineCoverage(matches, outline): number` for `infer-headings.js`.

## Acceptance

- FR-001, SC-001
- `"Introducción"` outline + `"Introducci6n"` block → match accepted
- 19/19 entries for *Primates y Filósofos* fixture

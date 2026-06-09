# Contract: Front Matter Detection & Artifact Stripping

**Feature**: `20260534-section-detection-impr` | **Modules**: `front-matter-detector.js`, `infer-headings.js`, `strip-artifacts.js`

## Purpose

Excluir portada, créditos, TOC y ornamentos de la inferencia de headings y del scope picker.

## API — front-matter-detector.js

```js
export function getFrontMatterPageRange(outline): { skip: number, source: 'outline' }
export function detectFrontMatterPages(blocks, totalPages): number
```

### getFrontMatterPageRange (outline present)

1. Filter outline entries where title matches `/cubierta|portada|datos|sumario|contracubierta/i` → skip
2. Sort remaining by `page` ascending
3. `firstContentPage = first.page` (0-indexed per pdf-outline convention)
4. Return `{ skip: firstContentPage - 1 }` — pages `0..skip` are front matter

### detectFrontMatterPages (no outline)

For pages `0..min(14, totalPages-1)`:

| Signal | Threshold |
|--------|-----------|
| Sparse page | `totalChars < 300` |
| Short blocks | `shortBlockRatio > 0.6` (blocks with `text.length < 20`) |

Scan forward; increment `lastFrontMatterPage` while sparse; **break** on first dense page.

Return `lastFrontMatterPage` inclusive.

## Pipeline integration (infer-headings.js)

```js
const frontMatterEnd = outline.length > 0
  ? getFrontMatterPageRange(outline).skip
  : detectFrontMatterPages(blocks, totalPages);

const contentBlocks = blocks.filter(b => b.pageIndex > frontMatterEnd);
```

Blocks in front matter MUST NOT enter `scoreBlock` or outline block search.

## strip-artifacts.js extensions

```js
const ORNAMENT_PATTERN = /^[\s\W]{1,20}$/u;
const ISOLATED_ALLCAPS = /^[A-ZÁÉÍÓÚÑÜ]{3,15}$/;

function isArtifact(block, frontMatterEnd): boolean
```

| Rule | Condition |
|------|-----------|
| Ornament | `ORNAMENT_PATTERN.test(block.text)` |
| Isolated all-caps | `pageIndex <= frontMatterEnd` AND `ISOLATED_ALLCAPS.test(trim)` |

Matched blocks: `kind = 'artifact'`; excluded from heading inference.

## Examples (MUST mark artifact)

- `~II~`, `•• ••`, `PAIDOS`, `ATE`

## Acceptance

- FR-002, FR-005
- No headings from pages 1–9 (*Primates y Filósofos*)
- Scope picker free of labels `ATE`, `~II~`, `PAIDOS`

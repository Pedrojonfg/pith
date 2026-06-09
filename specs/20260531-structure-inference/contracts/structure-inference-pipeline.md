# Contract: Structure Inference Pipeline

## Purpose

Orquestar extracción, limpieza, inferencia y emisión de material normalizado con headings explícitos.

## Entry

```javascript
import { normalizeDocumentStructure } from "../normalization/index.js";

normalizeDocumentStructure({
  rawContent: string | ArrayBuffer,
  format: "pdf" | "html" | "txt" | "md",
});
```

## Response

```javascript
{
  blocks: TextBlock[],
  headings: HeadingCandidate[],
  structure: StructureReport,
}
```

## Pipeline order (MUST)

1. `extractBlocks(rawContent, format)` — formato-específico
2. `stripArtifacts(blocks, { format })` — in-place filter/mutate `kind: "artifact"`
3. `inferHeadings(blocks, { format, outline? })` — produce candidates
4. `validateHeadingHierarchy(headings)` — anti-stacking, monotonic levels
5. `emit(blocks, headings, format)` → `{ markdown }` o `{ htmlMin }`

## Integration point

`input-normalization.js::normalizeStudyMaterial` MUST call this pipeline for all v1 formats before returning.

## Non-goals

- OCR / scanned PDF
- LLM inference
- Table structure recovery (future)

## Acceptance mapping

- FR-001, FR-003, FR-006, FR-009

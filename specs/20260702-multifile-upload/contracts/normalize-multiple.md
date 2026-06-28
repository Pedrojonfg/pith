# Contract: normalizeMultipleFiles

**Module**: `src/js/input-normalization.js`

## Signature

```js
async function normalizeMultipleFiles(
  files: File[],
  readFile: (file: File) => Promise<{ raw: string|ArrayBuffer, format: string }>
): Promise<{
  markdown: string,
  files: SourceFileMeta[],
  sourceMap: Record<number, string>,
  pendingImages: PendingImage[],
  warnings: string[],
}>
```

## Behavior

1. Reject `files.length < 1` or `> 5`.
2. Assign `fileId` as `f1`…`fN` in order.
3. Call `normalizeStudyMaterial` per file (unchanged).
4. Concatenate with `buildSourceFileBreak(fileId)` between files.
5. Single file: equivalent to one normalize + tag all content as `f1`.

## Errors

- `UnsupportedFormatError` — unknown extension
- `NormalizationError` — empty after normalize

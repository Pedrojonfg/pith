# Quickstart — HTML Structure Extraction Hardening

## Validate

```bash
node cursor-tests/20260708_html-structure-extraction.mjs
node cursor-tests/20260608_t03-infer-headings.mjs
node cursor-tests/20260608_t07-extract-html-blocks.mjs
```

## Manual smoke

1. Upload browser-saved Wikipedia HTML.
2. Check console for `[infer-headings.inferHeadings] Done` with `headingCount > 0`.
3. Confirm no `[normalization.normalizeDocumentStructure] Equal-length section fallback`.
4. Inspect `shared.rawMarkdown` for `| Born |` style infobox table rows.

## Key files

- `src/js/normalization/extract-html-blocks.js`
- `src/js/normalization/infer-headings.js`
- `src/js/normalization/table-markdown.js`
- `cursor-tests/fixtures/wikipedia-export-synthetic.html`

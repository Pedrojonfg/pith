# Contract: buildScopedHierarchy

```text
buildScopedHierarchy(
  fullHierarchy: DocHierarchy,
  chosenSectionIds: string[],
  scopedMarkdown: string
) → DocHierarchy
```

## Preconditions

- `scopedMarkdown` was built by `buildScopedMarkdown` (document-order sections + `SCOPE_SECTION_DELIMITER`).
- `chosenSectionIds` identifies selectable nodes present in `fullHierarchy.tree`.

## Postconditions

- Output `tree` contains only chosen section nodes (subset structure or flattened siblings).
- Every node `startOffset`/`endOffset` is relative to `scopedMarkdown` (including delimiter gaps).
- Offsets cover the concatenated parts in document order.
- `pedagogical_meta` copied from full hierarchy when present.

## Non-goals

- Does not mutate `fullHierarchy`.
- Does not re-run LLM hierarchy inference.

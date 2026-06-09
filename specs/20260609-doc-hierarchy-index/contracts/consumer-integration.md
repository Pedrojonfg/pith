# Contract: Consumer Integration Hooks

## 1. Upload pipeline (`study.js`)

After `normalizeStudyMaterial` succeeds:

```js
session.docHierarchy = await buildDocumentHierarchyWithUi(markdown, llmFn, { useCache: true })
// or null if no API key and LLM mode required
```

**UI**: Show non-blocking loading indicator on scope picker area during LLM mode (~1–3s).

## 2. Scope picker (`slow/headings.js` — `buildScopeOptions`)

```js
if (session.docHierarchy?.tree?.length) {
  const flat = flattenHierarchy(session.docHierarchy.tree, 2)
  return flat.map(node => scopeOptionFromHierarchyNode(node))
}
// else: existing parseHeadings path
```

**Fallback**: `docHierarchy === null` → current heuristics unchanged.

## 3. Pagination (`slow/pagination.js`)

New option:

```js
computePageBreakpoints(scopeText, containerEl, typography, {
  sectionBoundaries: [{ charStart, charEnd }], // from flattenHierarchy, scope-relative
  sectionSnapSlack: 200,
})
```

When natural page end `cut` has a section `startOffset` in `(cut, cut + 200]`, snap page end to that offset.

## 4. Phase 0 (`slow/phase0.js`)

- Replace arbitrary char chunks with `getChunksFromHierarchy(docHierarchy.tree, scopeText, PHASE0_MAX_CHUNK_CHARS)`
- Add tree JSON summary to `buildPhase0UserPrompt` / map-reduce chunk prompts

## 5. Session (`session.js`)

- Add `docHierarchy: null` to default session shape
- Include in export/import if session serialization lists top-level fields

## Backward compatibility

| Condition | Behavior |
|-----------|----------|
| Old session, no `docHierarchy` | All consumers use legacy paths |
| LLM unavailable | `docHierarchy = null` |
| Invalid LLM tree | Deterministic fallback stored |

# Quickstart: Hierarchical Scope Selection UX

## Manual QA

1. Upload / open a document with ≥2 L1 sections and L2 children (or a fixture hierarchy).
2. After T1.1, land on **Scope selection**.
3. Confirm L2 rows are hidden; expand an L1 → children appear indented.
4. Check the L1 → children show checked; Continue → session has parent id only in `scopeSelection.sectionIds` (devtools / debug); scoped text length ≈ parent span.
5. Re-enter gate if available, or new doc: expand, check one L2 only → parent indeterminate; Continue → only that child id persisted; scoped text matches child span.
6. Check remaining siblings → parent becomes fully checked; Continuing stores parent id.
7. **Entire document** → `scopeSelection === null`.
8. Phone-width: list scrolls; Continue / Entire document remain usable.

## Automated

```bash
node cursor-tests/20260807_scope-hierarchy-tree.mjs
node cursor-tests/20260807_scope-hierarchy-normalize.mjs
node cursor-tests/20260807_scope-hierarchy-ui.mjs
```

(Exact filenames follow task prompts; all related `20260807_scope-hierarchy*.mjs` must pass.)

## SW

After JS/CSS/HTML changes: bump `SW_VERSION`, matching `?v=` on `sw-update.js` and `main.js`; run `cursor-tests/20260606_validate-sw-update-flow.mjs`.

# Quickstart: Scope-Gated Generation

## Dev verification

1. Hard-refresh after SW bump (`SW_VERSION` / `CACHE_NAME` / `index.html ?v=` aligned).
2. Upload a multi-section markdown/PDF on create-session.
3. Confirm scope screen appears shortly after hierarchy (before long inventory wait).
4. Choose two non-contiguous sections → confirm.
5. Spot-check Cloze / Recall / Slow orientation content stays inside those sections.
6. Open guide chat → ask about out-of-scope chapter → dual-context still works.
7. Enter Slow → no Slow-only scope screen; reader shows section jump index.
8. Export → scope label lists section titles.
9. New session → choose entire document → generation completes end-to-end.
10. Run focused cursor-tests for this feature + `20260606_validate-sw-update-flow.mjs` after SW bump.

## Automated

```bash
# Feature unit/smoke suite (T01–T11 + T12 integration)
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t01-stop-after-scope-gate.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t02-scoped-markdown-resolve.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t03-hard-gate-fingerprint.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t04-scoped-hierarchy.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t05-mini-tree-consumers.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t06-hardcoded-flip.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t07-cloze-scope.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t08-slow-scope-removed.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t09-slow-modifiers.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t10-slow-nav.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_t11-export-scope-label.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260806_scope-gated-generation.mjs

# After any SW bump
node --import ./cursor-tests/register.mjs cursor-tests/20260606_validate-sw-update-flow.mjs
```

## SC coverage (smoke)

| SC | Covered by |
|----|------------|
| SC-001 early gate | `20260806_t01-*.mjs`, T12 |
| SC-002 hard gate | `20260806_t03-*.mjs`, T12 |
| SC-003 scoped output / mini-tree | `20260806_t04/t05-*.mjs`, T12 |
| SC-004 dual-context chat | `20260806_t02-*.mjs`, T12 |
| SC-005 entire vs unresolved | `20260806_t02-*.mjs`, T12 |
| SC-006 no Slow scope screen | `20260806_t08-*.mjs`, T12 |
| SC-007 Slow nav index | `20260806_t10-*.mjs`, T12 |
| SC-008 auto modifiers | `20260806_t09-*.mjs`, T12 |
| SC-009 export label | `20260806_t11-*.mjs`, T12 |

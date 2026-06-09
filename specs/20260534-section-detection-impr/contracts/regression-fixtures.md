# Contract: Regression Fixtures

**Feature**: `20260534-section-detection-impr`

## Fixture 1 — PDF outline completo (*Primates y Filósofos*)

**Input**: PDF con 19 bookmark entries nivel 1/2

**Assertions**:

- [ ] `parseHeadings(normalizedTextFull).length === 19`
- [ ] All headings `source === 'outline'` (metadata or inference tag)
- [ ] No label matching `/\d{1,2}n/` (encoding artifact)
- [ ] No scope option (except Full) with `charCount < MIN_SCOPE_CHARS`
- [ ] No heading labels in `['ATE', '~II~', 'PAIDOS']`
- [ ] `outlineCoverage === 1.0` → zero `source: heuristic` headings

## Fixture 2 — PDF sin outline (paper académico)

**Input**: Selectable-text paper PDF, no bookmarks

**Assertions**:

- [ ] Headings `source === 'heuristic'`
- [ ] Section titles align with known paper structure (≥3 sections)
- [ ] `low_heading_confidence` NOT emitted when ≥ 3 sections detected

## Fixture 3 — TXT plano sin estructura

**Input**: Plain text > 5k chars, no heading patterns

**Assertions**:

- [ ] `warnings` includes `low_heading_confidence`
- [ ] Scope options: Full document + fallback sections ~5k
- [ ] No uncaught exceptions in pipeline

## Fixture 4 — HTML semántico

**Input**: HTML with `<h1>`–`<h3>`

**Assertions**:

- [ ] All headings `source === 'html_tag'`
- [ ] No level skips (H1→H3 corrected to H1→H2)

## Non-regression

- [ ] `migrate-html-min` sessions load correctly
- [ ] `buildMapReduceChunks` for scopes > 60k unchanged
- [ ] Phase 1 checkpoints fire at section boundaries

## cursor-tests layout

```text
cursor-tests/20260609_t01-outline-normalize.mjs      # FIX-01 unit
cursor-tests/20260609_t02-front-matter.mjs           # FIX-02, FIX-05
cursor-tests/20260609_t03-outline-short-circuit.mjs  # FIX-03
cursor-tests/20260609_t04-scope-min-chars.mjs        # FIX-04
cursor-tests/20260609_t05-dehyphenate.mjs            # FIX-07
cursor-tests/20260609_t06-regression-integration.mjs # Fixtures 1–4 mocks
```

## Dehyphenation assertion

```js
assert(!/\w-\n[a-záéíóúüñ]/u.test(normalizedTextFull));
```

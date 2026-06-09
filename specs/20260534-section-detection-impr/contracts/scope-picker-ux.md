# Contract: Scope Picker UX (Filter, Hierarchy, Overrides)

**Feature**: `20260534-section-detection-impr` | **Modules**: `slow/headings.js`, `study.js`

## buildScopeOptions

```js
export function buildScopeOptions(headings, fullText, options?): ScopeOption[]
```

### Options

| Key | Default | Description |
|-----|---------|-------------|
| `minScopeChars` | 200 | Override MIN_SCOPE_CHARS |
| `documentType` | `'auto'` | `'paper' \| 'book' \| 'auto'` |
| `headingOverrides` | `[]` | From session |

### Rules (MUST)

1. First option always: `{ label: 'Full document', start: 0, end: fullText.length }`
2. Skip heading if `(nextStart - h.charStart) < MIN_SCOPE_CHARS`
3. Apply `headingOverrides` before building options:
   - `remove` → omit option
   - `rename` → use `newLabel`
   - `split` → two headings at `charStart` and `charStart + splitAt`
   - `merge` → combine range with next heading
4. Set `parentLabel` = nearest prior heading with `level < h.level` (walk back)
5. `displaySize` = human format: `formatCharCount(n)` → `~420k`, `~9k`, `~1.2M`

### MIN_SCOPE_CHARS resolution

- `paper`: 200
- `book`: 500
- `auto`: book if `headings.length >= 10` OR `fullText.length > 200_000`

## renderSlowScopeScreen (study.js)

### Hierarchy (FIX-08)

- Group L2+ under nearest L1 parent
- L1 rows: expand toggle `▶` / `▼`; collapsed by default for L2
- Selecting L1 sets scope to full L1 range (includes all child sections)
- Char count uses `displaySize`, not raw integer

### Edit mode (FIX-09)

- Button "Editar secciones" toggles edit mode
- Actions per row: Renombrar, Eliminar, Dividir (prompt exact cut text), Fusionar (with next)
- Persist to `session.slow.headingOverrides`; call `storeActiveSession()`

### low_heading_confidence (FIX-10)

When `warnings.includes('low_heading_confidence')`:

1. Show banner: *"No se detectaron secciones automáticamente. Puedes añadir divisiones manualmente o estudiar el documento completo."*
2. Auto-enable edit mode
3. Include `fallbackSections` from `buildEqualLengthSections(text, { targetChunkSize: 5000, labelPrefix: 'Sección' })`
4. Optional button: "Dividir automáticamente por longitud"

## buildEqualLengthSections

```js
export function buildEqualLengthSections(text, { targetChunkSize, labelPrefix }): ScopeOption[]
```

Non-overlapping chunks of ~`targetChunkSize` chars on paragraph boundaries when possible.

## Acceptance

- FR-004, FR-008, FR-009, FR-010, SC-002
- Hierarchical UI for *Primates y Filósofos* (6 L1 + L2 appendices)
- Overrides survive page reload (session persistence)

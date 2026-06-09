# Research: Markdown Canonical Normalization

**Feature**: `20260532-markdown-canonical` | **Date**: 2026-06-08

## R1 — Motivación: bifurcación html_min sin beneficio real

**Decision**: Eliminar `html_min` como formato de salida; markdown único para todos los inputs v1.

**Rationale**:
- Slow reader usa `textContent` → tags HTML visibles al usuario.
- RSVP/Cloze no convierten `html_min` a plain text de forma consistente.
- Doble parser en `headings.js`, doble emisor en pipeline, doble suite de tests.
- IA en Phase 0 necesita `htmlMinToPlainText` solo por la bifurcación.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Mantener html_min y arreglar reader con `innerHTML` | Más superficie XSS/sanitización; no unifica IA/RSVP |
| Convertir html_min→markdown solo al guardar sesión | Sigue duplicación en pipeline y tests |
| Plain text único | Pierde headings markdown y estructura para scope picker |

## R2 — Mantener extracción HTML rica, cambiar solo emisión

**Decision**: No tocar `extract-html-blocks.js`; cambiar `normalization/index.js` para siempre llamar `emitMarkdown`.

**Rationale**: La señal valiosa está en la inferencia pre-strip (clases Word, aria-level, font-size inline). La emisión a markdown preserva headings como `#` sin perder el trabajo de structure-inference.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Re-parsear HTML con turndown/npm | Nueva dependencia; contradice constitution del proyecto |
| Volver a `toMinimalHtml` + regex | Pierde inferencia de headings ya implementada |

## R3 — Conversión HTML bloques → markdown

**Decision**: Extender `emit-markdown.js` (o nuevo `blocks-to-markdown.js`) para:
- Headings ya en `HeadingCandidate[]` → `#`.repeat(level)
- Párrafos → bloques separados por `\n\n`
- Listas: prefijo `- ` por línea si `kind === "list-item"`
- Enlaces/imágenes: regex sobre HTML original solo si bloque trae markup (fase 2 opcional)
- Tablas: GFM simple si estructura detectable; si no, texto plano + `html_structure_simplified`

**Rationale**: Reutiliza `TextBlock[]` existente; conversión incremental sin parser HTML completo.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| marked / turndown | Dependencia externa |
| Serializar HTML min y luego convertir | Dos pasos innecesarios |

## R4 — Compatibilidad sesiones legacy

**Decision**: Al `loadSession` / `createSlowSession`, si `normalizedFormat === "html_min"`:
1. Intentar `htmlMinToPlainText` + re-parse headings desde tags con parser legacy, **o**
2. Función `migrateHtmlMinSessionToMarkdown(session)` one-shot al abrir.

**Rationale**: Usuarios con localStorage no pierden sesiones; migración lazy evita batch job.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Romper sesiones legacy | Mala UX |
| Mantener dual path indefinido | Deuda permanente |

## R5 — Contrato input-normalization v3

**Decision**: Nuevo contrato `input-normalization-v3.md` reemplaza bifurcación de v1; v2 structure fields (`warnings`, `structure`) se mantienen.

**Rationale**: Breaking change documentado; consumidores que ignoran `normalized_format` siguen recibiendo string legible.

## R6 — headings.js simplificación

**Decision**: `parseHeadings` usa solo markdown por defecto; `parseHtmlMinHeadings` queda como `@deprecated` para legacy hasta eliminar en v2.

**Rationale**: Reducción de complejidad; compat acotada.

## R7 — Testing

**Decision**: Actualizar `20260608_t01-structure-inference.mjs` (expectativas HTML→markdown), añadir `20260608_t01-markdown-canonical.mjs`, fixture sesión legacy en `cursor-tests/fixtures/`.

**Rationale**: Patrón existente del repo.

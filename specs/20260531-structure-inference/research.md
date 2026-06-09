# Research: Structure Inference (Headings & Artifact Removal)

**Feature**: `20260531-structure-inference` | **Date**: 2026-06-08

## R1 — Causa raíz: normalización sin estructura

**Decision**: El problema no está en `headings.js` sino en `input-normalization.js`: `plainTextToMarkdown` solo divide párrafos y `extractPdfPlainText` destruye metadatos de fuente/posición.

**Rationale**: `parseHeadings` solo lee `#` o `<h1>` ya presentes; sin inferencia upstream, Slow Mode no puede ofrecer scope por capítulos.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Mejorar solo `headings.js` | No crea headings que no existen en el texto normalizado |
| LLM post-proceso | No determinístico; contradice FR-013 y coste tokens |

## R2 — Pipeline multicapa (extracción → limpieza → inferencia → emisión)

**Decision**: Nuevo módulo `src/js/normalization/` con pipeline de 4 capas: (1) extracción rica por formato, (2) `strip-artifacts`, (3) `infer-headings` con scoring, (4) `emit-markdown` / `emit-html-min`.

**Rationale**: Separación testeable; cada capa tiene contrato propio; `input-normalization.js` queda como fachada.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Monolito en `input-normalization.js` | >1500 LOC, difícil de testear |
| Integrar `@pdf2md/core` | Nueva dep; versión pdf.js distinta (5.x vs 4.4.168) |

## R3 — PDF: font size histogram + umbral 15%

**Decision**: Calcular **body font size** como moda ponderada por caracteres; bloques con tamaño ≥ body × 1.15 son candidatos a heading; mapear tamaños únicos a niveles H1–H6.

**Rationale**: Patrón probado en [MarkItDown PR #1659](https://github.com/microsoft/markitdown/pull/1659), [PyMuPDF markdown](https://artifex.com/blog/rag-llm-and-pdf-conversion-to-markdown-text-with-pymupdf), [@pdf2md/core](https://www.npmjs.com/package/@pdf2md/core).

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Solo regex en texto plano | Pierde señal tipográfica en PDF |
| Umbral fijo en puntos (ej. >14pt) | No escala entre documentos |

## R4 — PDF: extracción por líneas con clustering Y

**Decision**: Agrupar `TextItem` de `getTextContent()` por proximidad en `transform[5]` (Y); altura = `Math.hypot(c, d)` del matrix; reconstruir líneas antes de bloques.

**Rationale**: [pdf.js TextItem](https://mozilla.github.io/pdf.js/api/draft/api.js.html) expone `transform`, `height`, `fontName`; join plano actual es la causa de pérdida de estructura.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| `getTextContent` con join por página | Sigue sin líneas ni tamaños por bloque |

## R5 — PDF outline como fuente autoritativa

**Decision**: Llamar `doc.getOutline()` al inicio; si existe, insertar headings en offsets de página resueltos vía `getDestination` + `getPageIndex`; heurística de font size como fallback y validación cruzada.

**Rationale**: Bookmarks son semántica explícita del autor cuando existe; recall máximo con coste bajo.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Solo outline | Muchos PDFs académicos no tienen bookmarks |
| Ignorar outline | Desperdicia señal de alta confianza |

## R6 — Eliminación de page numbers y headers/footers

**Decision**: Tres niveles combinados: (A) zona Y — top 8–10% / bottom 8–10%; (B) repetición inter-página ≥70%; (C) regex para `^\d{1,4}$`, `Page N`, `p. N`, romanos aislados, DOI/copyright en márgenes.

**Rationale**: [pypdf visitor pattern](https://pypdf.readthedocs.io/en/stable/user/extract-text.html); [gist PyMuPDF académico](https://gist.github.com/HubertusWeber/fb7e0ed718cab04ed1b64f176d4c36ef).

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Solo regex post-hoc | Falsos positivos en listas numeradas |
| Solo zona Y | Headers con mismo font que cuerpo se cuelan |

## R7 — Scoring multi-señal para headings

**Decision**: Puntuación por bloque (font ratio, bold, longitud ≤12 palabras, sin punto final, patrones numerados, ALL CAPS, keywords académicas, penalización zona header/footer); umbral ≥35; post-proceso jerárquico anti-stacking.

**Rationale**: [pdf_heading_extractor](https://github.com/PR4NJAL/pdf_heading_extractor) demuestra que reglas combinadas superan una sola heurística.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Solo ALL CAPS | Papers modernos usan sentence case en títulos |

## R8 — HTML: inferir antes de strip

**Decision**: Nueva fase `inferHtmlHeadings(dom)` antes de `toMinimalHtml`: leer `h1–h6`, `role=heading`+`aria-level`, clases `Heading1`/`title`/`chapter`, y `style` inline (font-size, font-weight) antes de eliminarlo.

**Rationale**: Quitar `style` primero destruye la señal visual en exportaciones Word.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| `getComputedStyle` obligatorio | Requiere render; inline + clases cubren mayoría de exports |

## R9 — TXT/MD: patrones y preservación

**Decision**: Patrones `^\d+(\.\d+)*`, `^[IVXLC]+\.`, keywords (`Introducción`, `Abstract`, …); MD existente con `#` se conserva; solo promover líneas sin `#` que pasen scoring.

**Rationale**: Bajo coste, alto recall en apuntes y papers copiados como texto.

## R10 — Warnings y confianza

**Decision**: `warnings[]` estructurados: `low_heading_confidence`, `scanned_pdf_no_text`, `layout_complex`, `outline_partial`; emitir si doc >5k chars y `headingCount === 0`.

**Rationale**: Transparencia sin bloquear upload; alinea con filosofía fail-soft del proyecto.

## R11 — headings.js ampliación

**Decision**: Extender regex markdown a `#{1,6}` y html a `<h([1-6])>`; mantener `chapter`/`section` kind: h1→chapter, h2→chapter (html), resto→section.

**Rationale**: Coherencia con emisión H1–H6; cambio acotado en un archivo.

## R12 — Testing sin browser para lógica pura

**Decision**: Tests `cursor-tests/20260608_t*.mjs` con fixtures sintéticos de bloques `TextBlock[]`; PDF real opcional en fixture binario pequeño o mock de `getTextContent`.

**Rationale**: Patrón existente del repo; lógica de inferencia testeable en Node con jsdom solo para HTML.

# Feature Specification: Structure Inference (Headings & Artifact Removal)

**Feature Branch**: `20260531-structure-inference`

**Created**: 2026-06-08

**Status**: Draft

**Input**: Mejorar de forma exhaustiva la detección de encabezados al convertir material de estudio (pdf/html/txt/md) a markdown o html_min, y eliminar números de página, headers/footers recurrentes y artefactos similares. El objetivo es maximizar recall de headings para Slow Mode scope picker, checkpoints y chunking IA, sin depender de LLM en la normalización.

## Clarifications

### Session 2026-06-08

- Q: ¿Integrar librería externa (@pdf2md/core) o módulo propio? → A: **Módulo propio** en `src/js/normalization/` reutilizando pdf.js ya presente; sin nueva dependencia npm en v1.
- Q: ¿Usar LLM para inferir headings cuando heurísticas fallan? → A: **No** — normalización determinística; warnings en `normalizeStudyMaterial` si confianza baja.
- Q: ¿Alcance de niveles de heading? → A: Detectar y emitir **H1–H6**; `headings.js` ampliado para parsear los seis niveles.
- Q: ¿PDF escaneado (sin texto seleccionable)? → A: Fuera de alcance v1; devolver warning `scanned_pdf_no_text` sin headings.
- Q: ¿Romper contrato FR-013 existente? → A: **Extender** `input-normalization.md` — misma bifurcación html_min vs markdown, más campos opcionales en `warnings` y metadatos de estructura.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - PDF académico con números de página (Priority: P1)

Como estudiante que sube un paper en PDF, quiero que la normalización produzca markdown con `#`/`##` en secciones reales y sin números de página en el cuerpo, para poder elegir capítulos en Slow Mode.

**Why this priority**: PDF es el formato más problemático y el más usado en material académico.

**Independent Test**: Subir PDF de paper con footer numérico; verificar que `normalizedContent` contiene `#` o `##` en títulos conocidos y no contiene líneas aisladas `42` en footers.

**Acceptance Scenarios**:

1. **Given** PDF con texto seleccionable y headings por font size, **When** normalizo, **Then** `normalized_format === "markdown"` y al menos un heading `#` o `##` aparece donde el documento tiene sección.
2. **Given** PDF con número de página en footer en todas las páginas, **When** normalizo, **Then** el número no aparece como línea suelta en el cuerpo.
3. **Given** PDF con outline/bookmarks, **When** normalizo, **Then** los títulos del outline se reflejan como headings en el texto (prioridad sobre heurística de font size).

---

### User Story 2 - TXT y MD con secciones numeradas (Priority: P1)

Como estudiante con apuntes en TXT o MD exportado sin `#`, quiero que líneas como `1. Introducción` o `II. Contexto` se conviertan en headings markdown.

**Why this priority**: Bajo esfuerzo, alto impacto; desbloquea scope picker sin PDF.

**Independent Test**: `plainTextToMarkdown("1. Introducción\n\nTexto...")` → `# Introducción` o `## 1. Introducción` según contrato.

**Acceptance Scenarios**:

1. **Given** TXT con patrón `^\d+(\.\d+)*\.?\s+[A-Z]`, **When** normalizo, **Then** la línea se emite como heading markdown.
2. **Given** MD con `#` ya presentes, **When** normalizo, **Then** headings existentes se conservan sin degradar.
3. **Given** línea numérica que es contenido (`3 metodologías aplicadas`), **When** normalizo, **Then** no se promueve a heading (penalización por longitud / no mayúscula inicial).

---

### User Story 3 - HTML sin tags semánticos (Priority: P2)

Como estudiante con HTML exportado de Word/LibreOffice (`<p class="Heading1">`), quiero html_min con `<h1>`–`<h6>` inferidos antes de eliminar estilos.

**Why this priority**: HTML ya tiene pipeline; falta inferencia previa a strip.

**Independent Test**: HTML con `<div style="font-size:24px;font-weight:bold">Capítulo 1</div>` → `<h1>Capítulo 1</h1>` en html_min.

**Acceptance Scenarios**:

1. **Given** HTML con `h1`–`h6` nativos, **When** normalizo, **Then** se conservan tras `toMinimalHtml`.
2. **Given** HTML con clases `Heading1`/`title`/`chapter`, **When** normalizo, **Then** se promueven a `<hN>` apropiados.
3. **Given** HTML con `role="heading"` y `aria-level`, **When** normalizo, **Then** se respeta el nivel indicado.

---

### User Story 4 - Warnings y confianza (Priority: P2)

Como sistema, quiero reportar cuando la inferencia de estructura es débil, para que el usuario sepa que el scope picker puede estar incompleto.

**Independent Test**: PDF uniforme (todo mismo font size) → `warnings` incluye `low_heading_confidence`.

**Acceptance Scenarios**:

1. **Given** documento >5000 chars sin ningún heading detectado, **When** normalizo, **Then** `warnings` contiene código estructurado de baja confianza.
2. **Given** PDF sin texto extraíble, **When** normalizo, **Then** error o warning `scanned_pdf_no_text` según contrato.

---

### Edge Cases

- PDF multicolumna: orden de lectura puede fallar; warning `layout_complex`.
- Línea `42` en lista numerada del cuerpo: no eliminar.
- Capítulo `3 Metodología` al inicio de sección: heading, no page number.
- Running header con autor en todas las páginas: eliminar por repetición inter-página.
- Headings consecutivos sin cuerpo: fusionar o degradar segundo (anti-stacking).
- MD con números de página pegados al copiar de PDF: strip en post-proceso.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El pipeline DEBE extraer bloques de texto con metadatos (font size, posición Y, bold) para PDF vía pdf.js `getTextContent`, no `join(" ")`.
- **FR-002**: El sistema DEBE eliminar números de página mediante zona Y (header/footer), repetición inter-página y patrones regex documentados.
- **FR-003**: El sistema DEBE inferir headings en PDF/TXT usando scoring multi-señal (font size vs moda, bold, patrones, longitud, keywords).
- **FR-004**: Si `pdf.getOutline()` devuelve árbol, el sistema DEBE usarlo como fuente autoritativa de headings (resolver `dest` → página).
- **FR-005**: Para HTML, el sistema DEBE inferir `<h1>`–`<h6>` **antes** de eliminar estilos inline en `toMinimalHtml`.
- **FR-006**: `plainTextToMarkdown` DEBE emitir headings markdown (`#`–`######`) cuando la inferencia lo determine.
- **FR-007**: `normalizeStudyMaterial` DEBE extender `warnings[]` con códigos: `low_heading_confidence`, `scanned_pdf_no_text`, `layout_complex`, `outline_partial`.
- **FR-008**: `parseHeadings` en `headings.js` DEBE soportar `h1`–`h6` / `#`–`######`.
- **FR-009**: La normalización DEBE permanecer determinística (sin LLM).
- **FR-010**: Tests en `cursor-tests/` DEBEN cubrir PDF simulado (bloques), TXT patrones, HTML inferencia, strip page numbers, y regresión de `20260527_t18`.

### Key Entities

- **TextBlock**: unidad con `text`, `fontSize`, `fontWeight`, `bbox`, `pageIndex`, `lineIndex`.
- **HeadingCandidate**: bloque con `score`, `level` (1–6), `label`, `charStart`/`charEnd` proyectados.
- **ArtifactPattern**: regla de eliminación (zona, regex, repetición).
- **StructureReport**: `{ headingCount, bodyFontSize, confidence, warnings }` adjunto a normalización.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En corpus de prueba (≥5 fixtures), recall de headings vs gold manual ≥90% en PDF académico con font differentiation.
- **SC-002**: Precision de headings ≥85% (falsos positivos ≤15%).
- **SC-003**: Eliminación de page numbers aislados en footer ≥95% en fixtures con footer numérico.
- **SC-004**: Running headers repetidos eliminados ≥80% cuando aparecen en ≥70% de páginas.
- **SC-005**: Slow Mode scope picker muestra ≥1 opción de capítulo/sección en ≥90% de uploads de prueba con estructura visible.
- **SC-006**: Tiempo de normalización PDF 50 páginas <10s en navegador desktop medio (sin bloquear UI >500ms por chunk).

## Assumptions

- pdf.js 4.4.168 sigue siendo el motor PDF (CDN actual).
- Sin OCR en v1.
- Corpus de prueba se construye con fixtures sintéticos + 1–2 PDFs reales pequeños embebidos o mockeados.
- Slow Mode, Cloze y RSVP reutilizan el mismo `input-normalization.js`.

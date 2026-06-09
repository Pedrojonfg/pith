# Feature Specification: Section Detection & Normalization Improvements

**Feature Branch**: `20260534-section-detection-impr`

**Created**: 2026-06-09

**Status**: Draft

**Input**: Mejoras en detección de secciones y normalización de documentos. El scope picker de Slow Mode produce resultados incorrectos en PDFs reales (caso *Primates y Filósofos*, De Waal). Corregir 10 fixes en capas del pipeline de normalización y UX del scope picker.

**Módulos afectados:** `input-normalization.js`, `extract-pdf-blocks.js`, `strip-artifacts.js`, `infer-headings.js`, `pdf-outline.js`, `emit-markdown.js`, `slow/headings.js`, `study.js`

**Prioridad global:** P0 (scope picker incorrecto en PDFs con outline)

## Clarifications

### Session 2026-06-09

- Q: ¿Alcance vs `20260531-structure-inference`? → A: **Extensión** del pipeline existente; no reescribir extracción base, solo corregir fallos documentados en producción.
- Q: ¿Fixture de regresión principal? → A: PDF *Primates y Filósofos* con 19 entradas de outline nivel 1/2.
- Q: ¿FIX-09 edita `normalizedTextFull`? → A: **No** — overrides en `session.slow.headingOverrides` aplicados al parse, no destructivo.
- Q: ¿LLM para headings? → A: **No** — determinístico; FIX-10 ofrece fallback por longitud.

## User Scenarios & Testing

### User Story 1 — PDF con outline completo (Priority: P1)

Como estudiante que sube un libro PDF con bookmarks, quiero que el scope picker muestre solo las secciones reales del contenido (capítulos/partes), sin portada ni sumario, para estudiar un capítulo sin ruido.

**Acceptance**: Con *Primates y Filósofos*, 19 headings `source: outline`; ningún heading de páginas 1–9; scope sin opciones < 200 chars.

### User Story 2 — PDF con encoding corrupto (Priority: P1)

Como sistema, debo matchear títulos del outline aunque pdf.js extraiga caracteres corruptos (`Introducci6n` vs `Introducción`).

**Acceptance**: Todas las entradas del outline matchean tras normalización tolerante.

### User Story 3 — Documento sin estructura (Priority: P2)

Como estudiante con TXT plano, quiero un scope picker usable aunque no haya headings detectados.

**Acceptance**: Warning `low_heading_confidence` + mensaje accionable + secciones fallback ~5k chars.

### User Story 4 — Scope jerárquico y edición manual (Priority: P2)

Como estudiante de un libro con partes y apéndices, quiero ver L1 agrupando L2 y poder renombrar/eliminar secciones incorrectas.

**Acceptance**: Picker jerárquico; overrides persisten en sesión.

## Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-001 | `matchOutlineToBlocks` MUST normalizar ambos lados (diacríticos, encoding fixups, prefijo 15 chars) antes de score |
| FR-002 | Bloques de front matter MUST excluirse de inferencia (outline-first o heurística de densidad) |
| FR-003 | Si outline coverage ≥ 80 %, MUST omitir scoring heurístico global |
| FR-004 | `buildScopeOptions` MUST filtrar secciones con `charCount < MIN_SCOPE_CHARS` (200 papers / 500 libros) |
| FR-005 | `strip-artifacts` MUST marcar ornamentos y all-caps aislados en front matter como `artifact` |
| FR-006 | `extract-pdf-blocks` SHOULD detectar layout bicolumna y agrupar por columna |
| FR-007 | Pipeline MUST dehyphenar `\w-\n[a-z]` antes de persistir `normalizedTextFull` |
| FR-008 | Scope picker MUST mostrar jerarquía L1/L2 con expand/collapse |
| FR-009 | Usuario MUST poder renombrar/eliminar/dividir/fusionar secciones vía `headingOverrides` |
| FR-010 | `low_heading_confidence` MUST mostrar mensaje accionable y secciones fallback |

## Success Criteria

- SC-001: *Primates y Filósofos* → exactamente 19 headings, todos `source: outline`
- SC-002: Ninguna opción del scope picker con `charCount < MIN_SCOPE_CHARS` (salvo "Full document")
- SC-003: Fixtures 1–4 de regresión (ver spec detallado) pasan en cursor-tests
- SC-004: Sin regresión en migración `html_min` → markdown ni `buildMapReduceChunks`

## Key Entities

- `HeadingCandidate` (extendido con `source`, `outlineLevel`)
- `FrontMatterRange` (`skipThroughPageIndex`)
- `ScopeOption` (`label`, `level`, `parentLabel`, `charCount`, `start`, `end`)
- `HeadingOverride` (`originalCharStart`, `action`, `newLabel?`, `splitAt?`)
- `StructureReport.warnings` (`low_heading_confidence`, `fallbackSections`)

## Assumptions

- Pipeline `src/js/normalization/` de `20260531-structure-inference` ya desplegado
- pdf.js 4.4.168 sin cambio de versión
- Fixture PDF disponible en `cursor-tests/fixtures/` o path documentado en quickstart

## Out of Scope

- OCR para PDFs escaneados
- LLM para inferir headings
- Re-diseño completo del pipeline de extracción

---

## Detalle técnico por FIX (referencia implementación)

Ver secciones FIX-01 … FIX-10 y criterios de regresión en el documento fuente `spec_sectdect_impr.md` en raíz del repo (copiado íntegramente en plan/contracts).

### Root cause (resumen)

```
Scope picker incorrecto
├── (A) matchOutlineToBlocks sin normalización → outline descartado
├── (B) Front matter genera headings falsos
├── (C) Heurística corre con outline completo → duplicados
├── (D) buildScopeOptions sin filtro mínimo
├── (E) Layout bicolumna mezcla columnas
└── (F) Guiones de silabeo en texto normalizado
```

### FIX-01 — Normalización en `matchOutlineToBlocks` (`pdf-outline.js`)

P0. `normalizeForComparison` + `applyEncodingFixups` + `matchScoreFallback` prefijo 15 chars.

### FIX-02 — Front matter (`front-matter-detector.js` + `infer-headings.js`)

P0. Estrategia A (outline) o B (densidad primeras 15 páginas).

### FIX-03 — Short-circuit outline ≥ 80 % (`infer-headings.js`)

P1. Sin headings `source: heuristic` cuando coverage = 100 %.

### FIX-04 — Filtro mínimo en `buildScopeOptions` (`slow/headings.js`)

P1. `MIN_SCOPE_CHARS` configurable por tipo documento.

### FIX-05 — Artefactos en `strip-artifacts.js`

P1. Ornamentos `~II~`, all-caps aislados en front matter.

### FIX-06 — Multi-columna (`extract-pdf-blocks.js`)

P2. `detectColumnLayout` + agrupación por columna.

### FIX-07 — Dehiphenation (`emit-markdown.js` / `input-normalization.js`)

P2. Regex `\w-\n[a-z]` únicamente.

### FIX-08 — Scope picker jerárquico (`slow/headings.js` + `study.js`)

P2. `parentLabel`, expand L2, formato `~420k`.

### FIX-09 — Feedback manual (`headingOverrides`)

P3. rename/remove/split/merge sin tocar `normalizedTextFull`.

### FIX-10 — Warning accionable (`infer-headings.js` + `study.js`)

P3. Mensaje + modo edición + `buildEqualLengthSections` fallback.

### Criterios de regresión (fixtures)

1. PDF outline completo — 19 headings, sin encoding artifacts, sin front matter
2. PDF sin outline — heurística, sin `low_heading_confidence` si ≥ 3 secciones
3. TXT plano — warning + fallback ~5k
4. HTML semántico — `source: html_tag`, jerarquía sin saltos
5. No regresión migración html_min, map-reduce, checkpoints

# Research: Section Detection & Normalization Improvements

**Feature**: `20260534-section-detection-impr` | **Date**: 2026-06-09

## R1 — Causa raíz dominante: outline match silencioso

**Decision**: El fallo P0 en *Primates y Filósofos* es **(A)** — `matchOutlineToBlocks` compara strings sin normalizar; pdf.js con Custom font encoding produce `Introducci6n` vs outline `Introducción`; score < 50 → entrada descartada → caída total a heurística sobre texto corrupto.

**Rationale**: El PDF tiene 19 bookmarks perfectos; si el match funcionara, el resto del pipeline sería estable. Diagnóstico en `spec_sectdect_impr.md` §1.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Subir umbral de score sin normalizar | Falsos positivos en bloques de cuerpo |
| Re-extraer PDF con otra librería | Nueva dep; pdf.js ya integrado |
| LLM para alinear títulos | No determinístico; contradice FR-013 |

## R2 — Orden del pipeline tras FIX-01

**Decision**: Secuencia: (1) extraer bloques → (2) detectar front matter → (3) `strip-artifacts` con `frontMatterEnd` → (4) `matchOutlineToBlocks` normalizado → (5) short-circuit si coverage ≥ 0.8 → (6) emit + dehyphenate.

**Rationale**: Front matter debe definirse antes de filtrar all-caps aislados (FIX-05 depende de FIX-02). Short-circuit (FIX-03) requiere matches fiables (FIX-01).

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Short-circuit antes de front matter | Headings espurios de portada contaminan coverage |
| Heurística siempre en páginas sin match | Aceptable en v1 solo para coverage 40–79 % (opcional) |

## R3 — Normalización tolerante y encoding fixups

**Decision**: `normalizeForComparison`: lowercase, NFD, strip combining marks, colapsar espacios, quitar puntuación final. `applyEncodingFixups`: tabla `6→o`, `0→o`, `1→i/l` solo en comparación. Fallback: prefijo 15 chars normalizado → score 60 si `startsWith`.

**Rationale**: Caso documentado `ó→6` en fuentes PDF embebidas; tabla extensible sin NLP.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Levenshtein puro sin fixups | No corrige patrones sistemáticos de encoding |
| Re-encode con fuente del PDF | pdf.js no expone mapping Custom→Unicode fiable |

## R4 — Front matter sin outline

**Decision**: `FrontMatterDetector` en primeras 15 páginas: marcar páginas con `totalChars < 300` OR `shortBlockRatio > 0.6` hasta primera página densa (break).

**Rationale**: Portadas/TOC tienen baja densidad y muchos bloques cortos; heurística barata y testeable.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Fijo páginas 1–9 | No escala entre libros |
| ML clasificador | Overkill; sin training data |

## R5 — Outline-first front matter (con outline)

**Decision**: Primera entrada outline nivel 1 cuyo título no matchee `SKIP_TITLES` (cubierta, portada, datos, sumario) define `firstContentPage`; páginas anteriores = front matter.

**Rationale**: Aprovecha señal autoritativa cuando existe; trivial si outline ya matchea.

## R6 — Multi-columna PDF

**Decision**: Detectar gap > 8 % ancho de página en zona central 40–60 % de X; si existe, particionar glyphs en left/right antes de `groupByY`.

**Rationale**: TOC y créditos bicolumna mezclan texto en join por Y; gap bimodal es señal geométrica estándar.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| OCR por columna | Fuera de alcance |
| Siempre ordenar por X global | Rompe lectura single-column |

## R7 — Scope picker: overrides no destructivos

**Decision**: `session.slow.headingOverrides[]` aplicado en `parseHeadings` / `buildScopeOptions` antes de render; no mutar `normalizedTextFull`.

**Rationale**: Split/merge en texto rompería offsets de anotaciones existentes; overrides son reversibles y session-scoped.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Editar markdown directamente | Invalida charStart de anotaciones |
| Re-normalizar tras edit | Costoso; pierde historial |

## R8 — MIN_SCOPE_CHARS por tipo documento

**Decision**: Default 200 (papers); 500 para libros detectados por `headingCount >= 10` OR `normalizedTextFull.length > 200000` OR outline depth ≥ 2 niveles.

**Rationale**: Spec pide configurable; heurística simple evita UI de configuración en v1.

## R9 — Dehyphenation

**Decision**: Post-`emitMarkdown`: `text.replace(/(\w)-\n([a-záéíóúüñ])/gu, '$1$2')` — solo salto simple, no `\n\n`, no mayúscula tras guión.

**Rationale**: Preserva nombres propios partidos (`Korsgaard-\nMueller`).

## R10 — Testing strategy

**Decision**: Golden test con metadatos del PDF De Waal (19 headings); mocks de bloques para front matter y encoding; fixture HTML/TXT para regresión structure-inference.

**Rationale**: PDF completo puede ser pesado; combinar unit tests de funciones puras + integración con snapshot reducido.

# ROADMAP — Section Detection & Normalization Improvements

**Feature**: `20260534-section-detection-impr` | **Spec**: `specs/20260534-section-detection-impr/spec.md` | **Plan**: `specs/20260534-section-detection-impr/plan.md`

## Tabla de tareas

| ID | FIX | Descripción | Deps | Complejidad | Estado |
|----|-----|-------------|------|-------------|--------|
| T01 | 01 | Normalización tolerante en `matchOutlineToBlocks` (`pdf-outline.js`) | — | S | [x] |
| T02 | 02 | Front matter: `front-matter-detector.js` + integración `infer-headings.js` | — | M | [x] |
| T03 | 03 | Short-circuit outline ≥80 % (`infer-headings.js`) | T01 | S | [x] |
| T04 | 05 | Artefactos ornamentos/all-caps (`strip-artifacts.js`) | T02 | S | [x] |
| T05 | 04 | Filtro `MIN_SCOPE_CHARS` en `buildScopeOptions` | T03, T04 | S | [x] |
| T06 | 06 | Layout multi-columna (`extract-pdf-blocks.js`) | — | L | [x] |
| T07 | 07 | Dehiphenation post-emisión (`emit-markdown.js`) | — | S | [x] |
| T08 | 08 | Scope picker jerárquico L1/L2 + formato `~420k` | T05 | M | [x] |
| T09 | 09 | Modo edición + `headingOverrides` en sesión | T08 | L | [x] |
| T10 | 10 | Warning `low_heading_confidence` accionable + fallback | T09 | M | [x] |
| T11 | — | cursor-tests unitarios FIX-01–07 | T01–T07 | M | [x] |
| T12 | — | QA integración + quickstart closure | T08–T11 | M | [x] |

## Diagrama de dependencias

```text
T01 → T03 → T05 → T08 → T09 → T10 → T12
T02 → T04 ↗
T06 → T11
T07 → T11
T05, T08, T09, T10 → T12
T11 → T12
```

**Paralelizables desde inicio**: T01, T02, T06, T07 (hasta 4 agentes)

**Secuenciales críticos**: T01 antes T03; T02 antes T04; T05 antes T08; T08 antes T09

## Orden de ejecución recomendado

### Ola 1 (paralelo — 4 agentes)
- **T01** outline matching
- **T02** front matter
- **T06** multi-columna
- **T07** dehyphenation

### Ola 2 (paralelo — 2 agentes, tras Ola 1 parcial)
- **T03** (necesita T01)
- **T04** (necesita T02)

### Ola 3 (1 agente)
- **T05** scope min chars

### Ola 4 (1 agente)
- **T08** picker jerárquico

### Ola 5 (secuencial)
- **T09** overrides
- **T10** low confidence UX

### Ola 6 (cierre)
- **T11** tests (puede empezar tras T07 para tests unitarios)
- **T12** QA final

---

## PROMPT T01 — Outline text normalization

Implementa **T01** (FIX-01) del ROADMAP Section Detection.

**Contexto**: PDF *Primates y Filósofos* tiene outline perfecto pero `matchOutlineToBlocks` falla porque pdf.js extrae `Introducci6n` vs `Introducción`. Ver `specs/20260534-section-detection-impr/contracts/outline-matching.md`.

**Archivos**:
- `src/js/normalization/pdf-outline.js` — añadir `normalizeForComparison`, `applyEncodingFixups`, `matchScoreFallback`; aplicar en `matchScore` / `matchOutlineToBlocks`

**Criterio de éxito**: Con fixture mock outline+block corrupto, match score ≥50; prefijo 15 chars acepta bloques truncados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Front matter detection

Implementa **T02** (FIX-02) del ROADMAP Section Detection.

**Contexto**: Páginas 1–9 generan headings basura (ATE, ~II~). Ver `contracts/front-matter-detection.md`.

**Archivos**:
- `src/js/normalization/front-matter-detector.js` — **nuevo**: `getFrontMatterPageRange`, `detectFrontMatterPages`
- `src/js/normalization/infer-headings.js` — filtrar `contentBlocks` con `pageIndex > frontMatterEnd` al inicio del pipeline
- `src/js/normalization/index.js` — export si necesario

**Criterio de éxito**: Bloques con `pageIndex <= frontMatterEnd` no entran en inferencia; outline strategy salta portada/sumario. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Outline short-circuit

Implementa **T03** (FIX-03) tras **T01**.

**Archivos**:
- `src/js/normalization/infer-headings.js` — calcular `outlineCoverage`; si ≥0.8, usar solo `outlineMatches` sin `scoreAllBlocks`; siempre `validateHeadingHierarchy`

**Criterio de éxito**: coverage=100% → cero headings `source: heuristic`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Strip artifacts ornaments

Implementa **T04** (FIX-05) tras **T02**.

**Archivos**:
- `src/js/normalization/strip-artifacts.js` — `ORNAMENT_PATTERN`, `ISOLATED_ALLCAPS`, `isArtifact(block, frontMatterEnd)`; marcar `kind: artifact`
- `src/js/normalization/infer-headings.js` — pasar `frontMatterEnd` a strip phase

**Criterio de éxito**: `~II~`, `PAIDOS`, `ATE` → `kind: artifact`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — MIN_SCOPE_CHARS filter

Implementa **T05** (FIX-04) tras **T03** y **T04**.

**Archivos**:
- `src/js/slow/headings.js` — `MIN_SCOPE_CHARS`, resolución paper/book; filtrar en `buildScopeOptions`; "Full document" siempre primero

**Criterio de éxito**: Ninguna opción con `charCount < MIN_SCOPE_CHARS` excepto Full. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Multi-column PDF layout

Implementa **T06** (FIX-06) — paralelo desde Ola 1.

**Archivos**:
- `src/js/normalization/extract-pdf-blocks.js` — `detectColumnLayout`, particionar left/right antes de `groupByY`

**Criterio de éxito**: Página bicolumna mock no mezcla texto izquierda/derecha en mismo bloque. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Dehyphenation

Implementa **T07** (FIX-07) — paralelo desde Ola 1.

**Archivos**:
- `src/js/normalization/emit-markdown.js` — `dehyphenate(text)` con regex `\w-\n[a-záéíóúüñ]`
- `src/js/normalization/index.js` o `input-normalization.js` — aplicar como última fase antes de persistir

**Criterio de éxito**: `intrinseca-\nmente` → `intrinsecamente`; `Korsgaard-\nMueller` intacto. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Hierarchical scope picker

Implementa **T08** (FIX-08) tras **T05**.

**Archivos**:
- `src/js/slow/headings.js` — `parentLabel`, `formatCharCount` → `displaySize`
- `src/js/study.js` — `renderSlowScopeScreen`: agrupar L1/L2, expand/collapse, selección L1 = rango completo
- CSS mínimo si hace falta en `main.css`

**Contratos**: `contracts/scope-picker-ux.md`

**Criterio de éxito**: Picker muestra partes L1 con sub-secciones colapsables; tamaños `~420k`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T09 — Manual heading overrides

Implementa **T09** (FIX-09) tras **T08**.

**Archivos**:
- `src/js/slow/headings.js` — `applyHeadingOverrides`, tipos rename/remove/split/merge
- `src/js/study.js` — botón "Editar secciones", UI acciones, persist `session.slow.headingOverrides`

**Criterio de éxito**: Renombrar/eliminar no muta `normalizedTextFull`; overrides persisten en sesión. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T10 — low_heading_confidence UX

Implementa **T10** (FIX-10) tras **T09**.

**Archivos**:
- `src/js/slow/headings.js` — `buildEqualLengthSections`
- `src/js/normalization/infer-headings.js` — attach `fallbackSections` en resultado
- `src/js/study.js` — banner explicativo, auto-edit mode, botón dividir por longitud

**Criterio de éxito**: TXT >5k sin headings → Full + Sección 1..N + mensaje claro. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T11 — cursor-tests

Implementa **T11** tras T01–T07.

**Archivos** (crear):
- `cursor-tests/20260609_t01-outline-normalize.mjs`
- `cursor-tests/20260609_t02-front-matter.mjs`
- `cursor-tests/20260609_t03-outline-short-circuit.mjs`
- `cursor-tests/20260609_t04-scope-min-chars.mjs`
- `cursor-tests/20260609_t05-dehyphenate.mjs`
- `cursor-tests/20260609_t06-regression-integration.mjs`

**Contratos**: `contracts/regression-fixtures.md`

**Criterio de éxito**: Todos los tests nuevos pasan con `node --import ./cursor-tests/register.mjs`. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T12 — QA closure

Implementa **T12** tras T08–T11.

**Tareas**:
- Completar checklist `specs/20260534-section-detection-impr/quickstart.md`
- Regresión `20260608_t01-structure-inference.mjs`
- Marcar ROADMAP T01–T11 en [x]

**Criterio de éxito**: Quickstart manual verificado; sin regresión migración html_min. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanza primero en paralelo** (4 chats): **T01, T02, T06, T07**
2. **Cuando T01 termine**: **T03** | **Cuando T02 termine**: **T04** (paralelo entre sí)
3. **Cuando T03+T04 terminen**: **T05**
4. **Cuando T05 termine**: **T08**
5. **Secuencial**: **T09** → **T10**
6. **T11** puede iniciar tras T07 (tests unitarios); integración tras T10
7. **Cierre**: **T12**

**Tiempo mínimo estimado**: 4 olas (Ola1 paralelo → Ola2-3 pipeline → Ola4-5 UX → Ola6 QA).

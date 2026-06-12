# ROADMAP — RSVP Pipeline Levers (Strict Mode)

**Feature**: `20260617-pipeline-levers` | **Spec**: `specs/20260617-pipeline-levers/spec.md` | **Plan**: `specs/20260617-pipeline-levers/plan.md`

**Objetivo**: Eliminar overlapping estructural de preguntas y bloques thin en RSVP modo estricto mediante 25 palancas del pipeline (L1–L25), implementadas por sprints de impacto/esfuerzo.

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | L15 — `n_test=0` en Key terms, Overview, Course map | — | S | [x] |
| T02 | L11 — Umbral dedup firma configurable (strict=2) | — | S | [x] |
| T03 | L22 — `coverageManifest` param en regen (stub vacío) | — | S | [x] |
| T04 | L2 — Densidad dinámica inventario (`wordCount/300*2`) | — | M | [x] |
| T05 | L14 — Scope de preguntas por tipo de bloque | T01 | M | [x] |
| T06 | L18 — Instrucción anti-reteaching en preguntas | T05 | S | [x] |
| T07 | L17+L23 — Cablear `deepSeekAuditBlockOverlap` + retry | T05 | M | [x] |
| T08 | L20+L21 — `chunk_coverage` + claim coverage retry | — | M | [x] |
| T09 | L16 — `coverageManifest` activo en session + extracción | T03 | L | [x] |
| T10 | L1 — Delimitadores jerarquía (❖ ➔ ➢) en normalización | — | M | [x] |
| T11 | L9+L8+L10 — Snap obligatorio + penalización términos + min words | T10 | M | [x] |
| T12 | L3 — Inventario dos pasadas (macro + micro) | T10 | L | [x] |
| T13 | L13 — Separar generación explanation vs questions | T09 | M | [x] |
| T14 | L5-D — Key terms fuera de secuencia lineal (glosario lateral) | T01 | M | [x] |
| T15 | L4+L6+L7 — Tipología conceptos + ratio Key terms + fusión módulos | T04 | M | [x] |
| T16 | L19 — Pregunta de conexión tipificada | T06 | S | [x] |
| T17 | L24+L25 — Nodos grises grafo + prerequisites entre bloques | T15 | M | [x] |
| T18 | L12 — Dedup semántico por embedding (opcional P5) | T02 | M | [x] |
| T19 | Sprint 4 misc — flags `pipelineLevers` en session meta | T02 | S | [x] |
| T20 | Suite tests + quickstart QA closure | T01–T14 mínimo | M | [x] |

## Diagrama de dependencias

```text
T01 ──┬──→ T05 ──→ T06 ──→ T16
      │         └──→ T07
      └──→ T14

T02 ──┬──→ T18
      └──→ T19

T03 ──→ T09 ──→ T13

T04 ──→ T15 ──→ T17

T08 (independiente)

T10 ──→ T11 ──→ T12

T01–T14 ──→ T20
T15–T19 ──→ T20 (opcional)
```

**Paralelizables desde inicio**: T01 + T02 + T03 + T04 + T08 + T10 (hasta 6 agentes)

**Paralelizables ola 2**: T05 + T11 (tras T01 y T10 respectivamente)

**Paralelizables ola 3**: T06 + T07 + T09 (tras T05/T03)

**Paralelizables ola 4**: T12 + T13 + T14 (Sprint 3)

## Orden de ejecución recomendado

### Ola 0 — Sprint 0 (3 agentes en paralelo)
- **T01** Key terms sin preguntas
- **T02** Dedup threshold
- **T03** Manifest en regen stub

### Ola 1 — Fundación contenido (3 agentes en paralelo)
- **T04** Densidad inventario
- **T08** Claim coverage
- **T10** Delimitadores jerarquía

### Ola 2 — Overlap preguntas (2–3 agentes)
- **T05** Question scope (tras T01)
- **T11** Chunk alignment levers (tras T10)

### Ola 3 — Anti-overlap avanzado (3 agentes)
- **T06** Anti-reteaching (tras T05)
- **T07** Audit overlap (tras T05)
- **T09** Manifest activo (tras T03)

### Ola 4 — Sprint 3 (3 agentes, tras ola 3)
- **T12** Two-pass inventory (tras T10)
- **T13** Split explain/questions (tras T09)
- **T14** Glosario lateral (tras T01)

### Ola 5 — Sprint 4 opcional
- **T15**, **T16**, **T17**, **T18**, **T19**

### Ola 6 — Cierre
- **T20** Tests + QA

**MVP mínimo útil**: T01 + T02 + T04 + T05 — elimina overlap inmediato y mejora densidad.

---

## PROMPT T01 — Key terms sin preguntas (L15)

Implementa **T01** del ROADMAP RSVP Pipeline Levers.

**Contexto**: Overlapping garantizado entre Key terms y desarrollo del mismo módulo. Spec: `specs/20260617-pipeline-levers/spec.md`. Contrato: `specs/20260617-pipeline-levers/contracts/key-terms-no-questions.md`.

**Archivos**:
- `src/js/session.js` — `resolveBlockQuestionConfig(blockIndex)`: leer título de `block_index` o `session.blocks`; si match `/^Key terms:/i`, `/^Overview:/i`, `/^Course map:/i` → `{ n_test: 0, n_socratic: 0, include_connection_questions: false }`

**Reglas**:
- Check de título ANTES de merge con `_config` per-block
- No eliminar bloques Key terms del pack

**Criterio de éxito**: Key terms y Overview resuelven 0 preguntas. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Dedup threshold configurable (L11)

Implementa **T02** del ROADMAP. Independiente.

**Contexto**: Contrato `chunk-alignment-levers.md` sección L11. Umbral ≥3 demasiado alto para vocabulario especializado.

**Archivos**:
- `src/js/session.js` — `findDeterministicDuplicateMerges`: umbral desde `session._meta.pipelineLevers?.dedupSignatureOverlapThreshold` o `strict ? 2 : 3`; regla secundaria: ≥1 `concept_id` compartido Y ≥2 términos firma → merge

**Criterio de éxito**: strict mode merge con 2 términos compartidos; normal sigue en 3. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — coverageManifest en regen (L22)

Implementa **T03** del ROADMAP. Independiente.

**Contexto**: Contrato `coverage-manifest.md`. `deepSeekRegenerateBlockQuestions` debe aceptar manifest aunque esté vacío.

**Archivos**:
- `src/js/api.js` — añadir param `coverageManifest = []` a `deepSeekRegenerateBlockQuestions`; incluir en prompt vía `renderCoverageManifestForPrompt`
- `src/js/study.js` — pasar `session._meta?.coverageManifest ?? []` en llamadas a regen

**Criterio de éxito**: regen recibe y renderiza manifest (vacío no rompe). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Densidad dinámica inventario (L2)

Implementa **T04** del ROADMAP. Independiente.

**Contexto**: Contrato `inventory-density.md`. 30 conceptos en 60 páginas = thin blocks.

**Archivos**:
- `src/js/session.js` — `runConceptInventory`: calcular `estimatedConceptTarget = clamp(round(wordCount/300)*2, 30, 120)`
- `src/js/api.js` — prompt inventario con target dinámico

**Criterio de éxito**: doc 15k palabras → target ~100; prompt incluye expectativa. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Scope preguntas por tipo (L14)

Implementa **T05** del ROADMAP. Depende de **T01**.

**Contexto**: Contrato `question-scope.md`. Tabla ALLOWED/FORBIDDEN por block_type.

**Archivos**:
- `src/js/session.js` o nuevo helper — `deriveBlockType(title)`, `buildQuestionScopeContext(blockIndex)`
- `src/js/api.js` — inyectar sección QUESTION TYPE RESTRICTION en prompt de preguntas; `precedingKeyTermsSignature` del Key terms previo del mismo módulo

**Criterio de éxito**: bloque desarrollo tras Key terms tiene FORBIDDEN con términos del glosario. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Anti-reteaching preguntas (L18)

Implementa **T06** del ROADMAP. Depende de **T05**.

**Contexto**: Contrato `question-scope.md` sección ALREADY QUESTIONED.

**Archivos**:
- `src/js/api.js` — construir `alreadyQuestionedTerms` desde preguntas de bloques anteriores (stems + opciones, heurística local)
- Añadir reglas 1–3 al prompt de preguntas

**Criterio de éxito**: bloque 3+ incluye lista de términos ya preguntados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Audit overlap + retry (L17, L23)

Implementa **T07** del ROADMAP. Depende de **T05**.

**Contexto**: Contrato `overlap-audit.md`. `deepSeekAuditBlockOverlap` existe en api.js pero no se llama.

**Archivos**:
- `src/js/study.js` — `ensureBlockGenerated`: tras `validateBlockFidelity`, invocar audit si `blockIndex > 0` y no Key terms/Overview; retry con `avoidOverlapWith`
- `src/js/api.js` — soporte `avoidOverlapWith` en generación explanation + questions

**Criterio de éxito**: audit wired; max 1 retry; skip Key terms. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Claim coverage + chunk_coverage (L20, L21)

Implementa **T08** del ROADMAP. Independiente.

**Contexto**: Contrato `claim-coverage.md`.

**Archivos**:
- `src/js/fidelity-validation.js` — añadir `chunk_coverage`, `claimCoverageRatio`, `uncoveredClaims`; thresholds strict/normal
- `src/js/study.js` — retry loop en `ensureBlockGenerated` si `claimCoverageRatio < 0.6` (max 1)

**Criterio de éxito**: explanation omitiendo claims dispara retry. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T09 — coverageManifest activo (L16)

Implementa **T09** del ROADMAP. Depende de **T03**.

**Contexto**: Contrato `coverage-manifest.md`.

**Archivos**:
- `src/js/session.js` — init `session._meta.coverageManifest = []`; helpers `appendCoverageClaims`, `replaceCoverageForBlock`
- `src/js/study.js` — tras generar preguntas, extraer claims heurísticamente y append; pasar manifest a generador bloque N+1
- `src/js/api.js` — asegurar `renderCoverageManifestForPrompt` en generación bloque idx≥1

**Criterio de éxito**: manifest crece por bloque; bloque 2+ recibe slice(-20). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T10 — Delimitadores jerarquía (L1)

Implementa **T10** del ROADMAP. Independiente.

**Contexto**: Contrato `chunk-alignment-levers.md` L1. Apuntes ética usan ❖ y ➔.

**Archivos**:
- `src/js/normalization/infer-headings.js` o `src/js/hierarchy.js` — detectar ❖ (L1), ➔/➢ (L2) como secciones con offsets
- Integrar en pipeline normalización existente (doc-hierarchy feature)

**Criterio de éxito**: texto plano con ❖ produce `docHierarchy` con ≥1 sección. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T11 — Snap + penalización + min words (L9, L8, L10)

Implementa **T11** del ROADMAP. Depende de **T10**.

**Contexto**: Contrato `chunk-alignment-levers.md` L8–L10.

**Archivos**:
- `src/js/chunk-alignment.js` — snap obligatorio si `docHierarchy.length > 0`; `OVERLAP_PENALTY_TERM_THRESHOLD = 0.4`; `MIN_CHUNK_WORDS = 400` con expand a límite de sección

**Criterio de éxito**: chunks alinean a secciones; penalización por términos compartidos activa. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T12 — Inventario dos pasadas (L3)

Implementa **T12** del ROADMAP. Depende de **T10**.

**Contexto**: `research.md` R6. Fase macro + micro por sección docHierarchy.

**Archivos**:
- `src/js/session.js` — `runConceptInventoryPhase2(section, existingConcepts)`; trigger si `inventory.length < target*0.8 && wordCount > 8000`
- `src/js/api.js` — prompt fase 2 con lista conceptos fase 1

**Criterio de éxito**: conceptos level:2 con `secondary: true` en inventario fusionado. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T13 — Split explanation/questions (L13)

Implementa **T13** del ROADMAP. Depende de **T09**.

**Contexto**: `research.md` R7. Dos LLM calls por bloque.

**Archivos**:
- `src/js/api.js` — `deepSeekGenerateBlockExplanation`, `deepSeekGenerateBlockQuestions`; `deepSeekGenerateBlockJson` orquesta ambas
- Paso 2 recibe `coverageManifest`, scope (L14), `avoidOverlapWith`

**Criterio de éxito**: questions generadas con explanation previa como input separado. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T14 — Glosario lateral Key terms (L5-D)

Implementa **T14** del ROADMAP. Depende de **T01**.

**Contexto**: Key terms fuera de secuencia lineal pero accesible como referencia.

**Archivos**:
- `src/js/session.js` — flag `study_sequence: false` en block_index para Key terms
- `src/js/study.js` — skip Key terms en navegación lineal; UI referencia términos (barra lateral o modal)
- `index.html` + CSS mínimo si hace falta mount

**Criterio de éxito**: sesión lineal salta Key terms; glosario accesible. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T15 — Tipología + pack tuning (L4, L6, L7)

Implementa **T15** del ROADMAP. Depende de **T04**.

**Contexto**: `spec-pipeline-levers.md` L4, L6, L7.

**Archivos**:
- `src/js/api.js` — prompt inventario con `concept_type`; prompt pack: Key terms solo si módulo ≥4 conceptos; fusión módulos <3 conceptos
- `src/js/session.js` — `packInventoryDeterministic` fallback con umbrales

**Criterio de éxito**: inventario incluye `concept_type`; módulos pequeños sin Key terms propio. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T16 — Pregunta conexión tipificada (L19)

Implementa **T16** del ROADMAP. Depende de **T06**.

**Contexto**: `spec-pipeline-levers.md` L19. Conexión debe referenciar claim específico de bloque N-1/N-2.

**Archivos**:
- `src/js/api.js` — sección REQUIRED CONNECTION QUESTION con `prevBlockSummaryForConnection`

**Criterio de éxito**: primera pregunta de bloque >1 referencia claim previo explícito. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T17 — Grafo grises + prerequisites (L24, L25)

Implementa **T17** del ROADMAP. Depende de **T15**.

**Contexto**: `spec-pipeline-levers.md` L24, L25.

**Archivos**:
- `src/js/session.js` o módulo grafo — `buildRsvpMaterialGraph`: nodos `grey` para gaps; aristas `prerequisite` entre bloques
- `src/js/study.js` — warning si bloque prerequisite no estudiado

**Criterio de éxito**: grafo muestra nodos grey; warning en navegación. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T18 — Dedup semántico (L12, opcional)

Implementa **T18** del ROADMAP. Depende de **T02**. Prioridad P5.

**Contexto**: Embedding similarity >0.85 entre summaries de bloques; solo si nBlocks > expected*1.2.

**Archivos**:
- Nuevo helper o `session.js` — post `applyDeterministicDedup` embedding pass opcional
- Flag en `pipelineLevers` para activar

**Criterio de éxito**: pares similares flaggeados o merged cuando flag on. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T19 — pipelineLevers session meta

Implementa **T19** del ROADMAP. Depende de **T02**.

**Contexto**: `data-model.md` PipelineLeversConfig.

**Archivos**:
- `src/js/session.js` — init `session._meta.pipelineLevers` con defaults; merge on session create strict mode

**Criterio de éxito**: strict session tiene defaults dedup=2, claimCoverageMin=0.6. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T20 — Tests + QA closure

Implementa **T20** del ROADMAP. Depende de **T01–T14** mínimo.

**Contexto**: `specs/20260617-pipeline-levers/quickstart.md`

**Archivos**:
- `cursor-tests/20260617_pipeline-levers.mjs` — tests: resolveBlockQuestionConfig titles, inventory target formula, dedup threshold, manifest append, block type scope (sin LLM live)
- `cursor-tests/loader.mjs` — registrar si aplica
- `specs/20260617-pipeline-levers/quickstart.md` — marcar QA checklist
- `ROADMAP.md` — marcar tareas completadas

**Casos mínimos**:
- Key terms → n_test=0
- estimatedConceptTarget formula
- strict dedup threshold=2
- coverageManifest passed to regen

**Criterio de éxito**: suite pasa; QA-PL-0..PL-REG documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (hasta 6 chats): **PROMPT T01**, **T02**, **T03**, **T04**, **T08**, **T10**
2. **Esperar** ola 0+1
3. **Lanzar en paralelo**: **PROMPT T05**, **T11**
4. **Esperar** T05
5. **Lanzar en paralelo**: **PROMPT T06**, **T07**, **T09**
6. **Esperar** T09
7. **Lanzar en paralelo** (Sprint 3): **PROMPT T12**, **T13**, **T14**
8. **Opcional Sprint 4**: T15–T19
9. **Lanzar** **PROMPT T20**

**Tiempo total estimado**: 6 olas; máximo 6 agentes en ola 0.

**Prioridad si hay prisa**: T01 → T04 → T05 (MVP overlap + densidad).

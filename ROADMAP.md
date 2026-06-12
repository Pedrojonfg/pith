# ROADMAP — Study Source Fidelity (A + B + C)

**Feature**: `20260613-source-fidelity` | **Spec**: `specs/20260613-source-fidelity/spec.md` | **Plan**: `specs/20260613-source-fidelity/plan.md`

**Objetivo**: El LLM traduce la fuente subida (definiciones, taxonomías, ejemplos del profesor) — no inventa pedagogía genérica. Tres fases en un release: **A** reglas + tutor, **B** chunks alineados + validación, **C** modo estricto + tutor documental.

## Tabla de tareas

| ID | Fase | Descripción | Deps | Complejidad | Estado |
|----|------|-------------|------|-------------|--------|
| T01 | A | `source-fidelity.js` — `SOURCE_FIDELITY_RULES` + `buildSourceFirstRsvpStructure` | — | S | [x] |
| T02 | A | `api.js` — prompts bloque RSVP + vocabulario + split (invertir anti-mirror) | T01 | M | [x] |
| T03 | A | `api.js` — questions, assessment, inventario `source_phrase` | T01 | M | [x] |
| T04 | A | `guide-chat.js` — chunk de bloque + reglas fidelidad | T01 | M | [x] |
| T05 | B | `chunk-alignment.js` — `assignAlignedChunks` | — | L | [x] |
| T06 | B | `session.js` — wire alignment en pack + metadata `anchor_quality` | T05 | M | [x] |
| T07 | B | Jerarquía doc — snap ventanas a secciones (enhance) | T05, T06 | S | [x] |
| T08 | B | `fidelity-validation.js` + hook retry en `deepSeekGenerateBlockJson` | T02, T06 | M | [x] |
| T09 | B | UI banner fidelidad (`study.js`, `index.html`, CSS) | T08 | S | [x] |
| T10 | C | `api.js` — `deepSeekExtractSourceClaims` + strict rewrite | T02 | L | [x] |
| T11 | C | `flags.js` + checkbox modo estricto create UI | T10 | S | [x] |
| T12 | C | `guide-chat.js` — `resolveGuideDocumentExcerpt` + spoiler policy | T04, T06 | M | [x] |
| T13 | — | Tests + quickstart QA closure | T01–T12 | M | [x] |

## Diagrama de dependencias

```text
T01 ──→ T02 ──┐
T01 ──→ T03 ──┼──→ T08 ──→ T09 ──→ T13
T01 ──→ T04 ──┘
T05 ──→ T06 ──→ T07
T06 ──→ T08
T02 ──→ T10 ──→ T11 ──→ T13
T06 ──→ T12 ──→ T13
```

**Paralelizables desde inicio (tras T01)**: T02 + T03 + T05 (3 agentes)

**Paralelizables ola 3**: T04 + T06 + T07 (T04 solo necesita T01; T06 necesita T05)

**Paralelizables ola 5**: T09 + T10 (T10 necesita T02)

**Paralelizables ola 6**: T11 + T12

## Orden de ejecución recomendado

### Ola 0 — Fundación (1 agente)
- **T01** módulo `source-fidelity.js`

### Ola 1 — Fase A core (3 agentes en paralelo)
- **T02** prompts bloque RSVP
- **T03** prompts questions/assessment/inventario
- **T05** chunk alignment (puede empezar en paralelo con T01 hecho — no depende de T01)

> Nota: T05 es independiente de T01; puedes lanzar **T01 + T05** en paralelo al inicio (2 agentes), luego T02+T03.

### Ola 2 — Integración A + B (3 agentes)
- **T04** guide chat Phase A
- **T06** session wiring
- **T07** hierarchy snap (opcional, no bloquea T08)

### Ola 3 — Validación (1 agente)
- **T08** fidelity validation + retry

### Ola 4 — UI + C extract (2 agentes)
- **T09** banner UI
- **T10** strict extract→rewrite

### Ola 5 — C flags + guide doc (2 agentes)
- **T11** strict toggle
- **T12** guide document search

### Ola 6 — Cierre (1 agente)
- **T13** tests + QA

**MVP mínimo útil**: T01 + T02 + T05 + T06 — reglas + chunks alineados (A parcial + B core).

---

## PROMPT T01 — Source fidelity module

Implementa **T01** del ROADMAP Study Source Fidelity.

**Contexto**: Feature `20260613-source-fidelity` Fase A. El LLM inventa definiciones porque los prompts premian pedagogía genérica. Necesitamos un módulo único de reglas. Contrato: `specs/20260613-source-fidelity/contracts/source-fidelity-rules.md`.

**Archivos**:
- `src/js/source-fidelity.js` (NUEVO) — exportar `SOURCE_FIDELITY_RULES`, `buildSourceFirstRsvpStructure({ isVocabularyBlock, requireConnection, strictMode, extractedClaims })`, `mergeFidelityIntoSystemPrompt(base, opts)`
- `cursor-tests/20260613_source-fidelity.mjs` (NUEVO esqueleto) — smoke: rules length, split prompt must not contain anti-mirror cuando se testee desde T02

**Reglas clave**:
- Fuente suprema; autor prevalece sobre conocimiento genérico
- Ejemplo/contraste solo si la fuente los tiene
- Sin dependencias de DOM ni LLM

**Criterio de éxito**: módulo importable; tests smoke pasan. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Block generation prompts (Phase A)

Implementa **T02** del ROADMAP Study Source Fidelity. Depende de **T01**.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/source-fidelity-rules.md`.

**Archivos**:
- `src/js/api.js` — importar `source-fidelity.js`; reemplazar `EXPLANATION_RSVP_THOROUGH`, `EXPLANATION_VOCABULARY_BLOCK`, `EXPLANATION_BRIEF_DEEP`; inyectar reglas en `buildBlockGenerationSystemPrompt`; limpiar `buildSplitBlocksPrompt` (quitar "not for mirroring"); alinear `CONCEPT_DICTIONARY_EXTRACTION_RULES`

**Reglas clave**:
- `buildBlockGenerationUserContent` mantiene chunk verbatim — no cambiar wiring
- Vocabulary: definiciones desde chunk, no plain-language genérico

**Criterio de éxito**: `buildBlockGenerationSystemPrompt` incluye fidelity marker; tests smoke en cursor-tests. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Questions, assessment, inventory (Phase A)

Implementa **T03** del ROADMAP Study Source Fidelity. Depende de **T01**.

**Contexto**: Mismas reglas en todas las superficies LLM RSVP.

**Archivos**:
- `src/js/api.js` — `buildQuestionsOnlySystemPrompt`, `buildPrePackingAssessmentSystemPrompt`, `buildConceptInventoryPrompt`, `parseConceptInventoryFromModelResponse` (campos `source_phrase`, `anchor_type`)

**Reglas clave**:
- Inventario: exigir `source_phrase` cuando el término aparece en el material; `anchor_type: inferred` solo si esencial
- Assessment: preguntas respondibles solo desde excerpt + inventario anclado

**Criterio de éxito**: parser acepta `source_phrase`; prompts incluyen SOURCE_FIDELITY. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Guide chat Phase A

Implementa **T04** del ROADMAP Study Source Fidelity. Depende de **T01**.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/guide-chat-grounding.md` (Phase A).

**Archivos**:
- `src/js/guide-chat.js` — `buildSessionContext` añade `getBlockChunkFromIndex` por bloque estudiado (cap 8000 chars); `buildGuidePrompt` incluye `SOURCE_FIDELITY_RULES` y declinación sin conocimiento externo

**Import**: usar `getBlockChunkFromIndex` desde `session.js` (dynamic import o patrón existente del proyecto).

**Criterio de éxito**: prompt del tutor contiene chunk del bloque activo. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Chunk alignment module

Implementa **T05** del ROADMAP Study Source Fidelity.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/chunk-alignment.md`. Causa raíz: `splitMaterialIntoBlockChunks` corta por posición lineal.

**Archivos**:
- `src/js/chunk-alignment.js` (NUEVO) — `assignAlignedChunks(materialText, blockIndex, inventory, opts)`
- `cursor-tests/20260613_source-fidelity.mjs` — tests alineación con fixture reordenado

**Reglas clave**:
- `anchor_quality`: strong | weak | proportional_fallback
- `chunk_match_terms` en metadata
- Overview bloque 1 = intro slice

**Criterio de éxito**: ≥4 tests deterministas de alignment. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Session pack wiring

Implementa **T06** del ROADMAP Study Source Fidelity. Depende de **T05**.

**Contexto**: Contrato chunk-alignment; data-model `BlockIndexEntry` extendido.

**Archivos**:
- `src/js/session.js` — `packInventoryToBlocks`, `twoPhaseConceptSplit` fallback paths: reemplazar `splitMaterialIntoBlockChunks` directo por `assignAlignedChunks`; pasar `inventory` y `docHierarchy` si disponible en state/doc session

**Reglas clave**:
- Fallback proporcional solo vía `assignAlignedChunks` con flag explícito
- Persistir `anchor_quality` en block_index localStorage

**Criterio de éxito**: tras pack, block_index entries tienen anchor_quality. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Hierarchy section snap (enhance)

Implementa **T07** del ROADMAP Study Source Fidelity. Depende de **T05**, **T06**.

**Contexto**: FR-B02 — cuando `docHierarchy` existe, snap cortes a límites de sección.

**Archivos**:
- `src/js/chunk-alignment.js` — integrar offsets desde `doc.shared.docHierarchy` o helper de `normalization/hierarchy.js`
- Tests adicionales en cursor-tests

**Criterio de éxito**: con fixture hierarchy, chunk no parte mitad de sección cuando hay match. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Fidelity validation + retry

Implementa **T08** del ROADMAP Study Source Fidelity. Depende de **T02**, **T06**.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/fidelity-validation.md`.

**Archivos**:
- `src/js/fidelity-validation.js` (NUEVO) — `validateBlockFidelity`, `extractKeyTermsFromBlockMeta`
- `src/js/api.js` — hook en `deepSeekGenerateBlockJson` retry + `fidelity_status` / `fidelity_issues` en bloque

**Criterio de éxito**: ≥6 tests validación; bloque envenenado falla. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T09 — Fidelity UI banner

Implementa **T09** del ROADMAP Study Source Fidelity. Depende de **T08**.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/fidelity-ui.md`.

**Archivos**:
- `index.html` — `#blockFidelityBanner`
- `src/js/study.js` — `syncBlockFidelityBanner`
- `src/css/main.css` — `.block-fidelity-banner`

**Criterio de éxito**: bloque weak/warn muestra banner en estudio RSVP. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T10 — Strict extract→rewrite (Phase C)

Implementa **T10** del ROADMAP Study Source Fidelity. Depende de **T02**.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/strict-extract-rewrite.md`.

**Archivos**:
- `src/js/api.js` — `deepSeekExtractSourceClaims`, branch en `deepSeekGenerateBlockJson` cuando strict; persistir `extracted_claims` en bloque

**Criterio de éxito**: strict path llama extract antes de rewrite; standard path sin extract. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T11 — Strict mode flag + UI

Implementa **T11** del ROADMAP Study Source Fidelity. Depende de **T10**.

**Contexto**: Opt-in modo estricto en create RSVP.

**Archivos**:
- `src/js/config/flags.js` — `SOURCE_FIDELITY_STRICT`, `isSourceFidelityStrictEnabled()`
- `index.html` + `study.js` — checkbox create; persistir `session._meta.source_fidelity_mode`

**Criterio de éxito**: checkbox activa extract pass en generación. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T12 — Guide document search (Phase C)

Implementa **T12** del ROADMAP Study Source Fidelity. Depende de **T04**, **T06**.

**Contexto**: Contrato `specs/20260613-source-fidelity/contracts/guide-chat-grounding.md` Phase C.

**Archivos**:
- `src/js/guide-chat.js` — `resolveGuideDocumentExcerpt`; spoiler policy definicional vs sintética; usar material completo de sesión

**Criterio de éxito**: pregunta definicional encuentra pasaje en doc completo; sintética unread declina. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T13 — Tests + QA closure

Implementa **T13** del ROADMAP Study Source Fidelity.

**Contexto**: Cerrar feature. Ver `specs/20260613-source-fidelity/quickstart.md`.

**Archivos**:
- `cursor-tests/20260613_source-fidelity.mjs` — suite completa (alignment, validation, prompt smoke, parser source_phrase, guide excerpt)
- `cursor-tests/loader.mjs` — registrar si aplica
- `specs/20260613-source-fidelity/quickstart.md` — marcar QA checklist

**Casos mínimos**:
- 4+ chunk alignment
- 6+ fidelity validation
- 3+ prompt smoke
- 2+ guide excerpt

**Criterio de éxito**: suite pasa; QA-SF-A1..C2 documentados. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar en paralelo** (2 chats): **PROMPT T01**, **PROMPT T05**
2. **Esperar** T01 y T05
3. **Lanzar en paralelo** (3 chats): **PROMPT T02**, **PROMPT T03**, **PROMPT T06** (T06 tras T05)
4. **Lanzar en paralelo** (2 chats): **PROMPT T04**, **PROMPT T07** (T07 opcional)
5. **Lanzar** **PROMPT T08**
6. **Lanzar en paralelo** (2 chats): **PROMPT T09**, **PROMPT T10**
7. **Lanzar en paralelo** (2 chats): **PROMPT T11**, **PROMPT T12**
8. **Lanzar** **PROMPT T13**

**Tiempo total estimado**: 8 olas; máximo 3 agentes en paralelo en olas 1 y 2.

**Prioridad si hay prisa**: T01 → T02 → T05 → T06 → T08 (MVP fidelidad real) antes de C.

# Research: Study Source Fidelity

**Feature**: `20260613-source-fidelity`  
**Date**: 2026-06-13

## R1 — Causa raíz (confirmada en código)

**Decision**: El problema es **doble**: (1) prompts RSVP piden pedagogía genérica y prohíben copiar la fuente; (2) `splitMaterialIntoBlockChunks` asigna trozos por posición lineal 1/N, desalineados del orden pedagógico del inventario.

**Rationale**: Análisis previo + `specs/20260526-block-split-dedup/research.md` R4 documenta la deuda de alineación chunk↔concepto.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Solo prompts (Fase A) | Techo bajo si chunk no contiene el pasaje |
| Solo alineación (Fase B) | Sigue generando definiciones genéricas si prompts no cambian |
| Embeddings en cliente | Peso/latencia; v1 usa búsqueda léxica + jerarquía |

## R2 — Reglas de fidelidad unificadas

**Decision**: Nuevo módulo `src/js/source-fidelity.js` exporta `SOURCE_FIDELITY_RULES` (string prompt) y helpers puros. Se inyecta en: `buildBlockGenerationSystemPrompt`, `buildQuestionsOnlySystemPrompt`, `buildConceptInventoryPrompt`, `buildPrePackingAssessmentSystemPrompt`, `buildSplitBlocksPrompt` (invertir anti-mirror), `buildGuidePrompt`, `CONCEPT_DICTIONARY_ENRICHMENT_RULES` (alinear redacción).

**Rationale**: Una sola fuente de verdad; testeable sin LLM; evita drift entre superficies.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Duplicar párrafos en cada builder | Divergencia inevitable |
| Solo post-validación | No corrige explicación ya inventada sin retry |

## R3 — Reescritura EXPLANATION_RSVP

**Decision**: Sustituir esquema Hook/16-year-old/ejemplo inventado por **Source-first RSVP structure**:
1. Definición/uso según la fuente (parafraseo cercano)
2. Capa técnica con términos del autor
3. Ejemplo **solo si está en el chunk**
4. Contraste **solo si el texto lo menciona**
5. Puente al bloque anterior (mantener para preview)

Mantener reglas RSVP (frases cortas, párrafos, sin headings visibles).

**Rationale**: Cumple FR-A03/A04 sin perder legibilidad RSVP.

## R4 — Inventario con `source_phrase`

**Decision**: Extender `ConceptInventoryItem` con `source_phrase` (≤25 palabras, cita del documento) y `anchor_type`: `quoted` | `inferred`. Parser acepta campo opcional; prompt fase 1 lo exige cuando el término aparece en el texto.

**Rationale**: Ancla barata para alineación de chunks y validación.

## R5 — Alineación de chunks (Fase B)

**Decision**: Nuevo `assignAlignedChunks(materialText, blockIndex, inventory, { docHierarchy? })` en `src/js/chunk-alignment.js`:

1. Por bloque, construir query terms: `title`, `signature[]`, títulos de `concept_ids` en inventario, `source_phrase` de conceptos ligados.
2. Buscar ventanas en `materialText` (case/accent tolerant) que maximicen hits de términos.
3. Si `docHierarchy` en sesión: preferir cortes en `startOffset`/`endOffset` de nodos que contienen hits.
4. Ventana objetivo: ~`materialLength / blockCount` palabras, centrada en mejor match; permitir solapamiento controlado.
5. Overview bloque 1: primer ~10 % del material o resumen de secciones raíz.
6. Sin match suficiente: `anchor_quality: "weak"` + fallback proporcional **explícito** (`proportional_fallback`).

**Rationale**: Sin backend; determinista; testeable con fixtures; cierra deuda R4 block-split-dedup.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| LLM asigna offsets | Tokens + parse frágil |
| Un chunk por concepto del inventario | No mapea 1:1 tras merges |

## R6 — Validación post-generación

**Decision**: `validateBlockFidelity({ blockTitle, signature, chunk, explanation, concepts })` determinista:
- Extraer términos clave de título + signature (stopwords ES/EN).
- Cada término ≥4 chars debe aparecer en `chunk` (normalizado) O en `explanation` con ratio de overlap lexical con chunk ≥ umbral (0.15 Jaccard en tokens significativos).
- Fallo → retry user message append; segundo fallo → `fidelity_status: "warn"` en bloque + UI banner.

**Rationale**: SC-004; sin LLM extra en path estándar.

## R7 — Modo estricto extract→rewrite (Fase C)

**Decision**: Flag `SOURCE_FIDELITY_STRICT` (default off). Pipeline en `deepSeekGenerateBlockJson`:
1. `deepSeekExtractSourceClaims({ chunk, blockTitle })` → JSON `{ claims: [{ type, text, terms[] }] }`
2. `buildBlockGenerationSystemPrompt` con `strictMode: true` recibe claims como única fuente de hechos; omite apartados vacíos.
3. Persistir `extracted_claims` en bloque (opcional, para auditoría/export).

**Rationale**: FR-C01/C02; una llamada LLM extra solo cuando usuario opta.

## R8 — Tutor lateral

**Decision Fase A**: `buildSessionContext` incluye `getBlockChunkFromIndex(current)` sin truncar agresivamente (cap 8000 chars por bloque estudiado). System prompt con reglas slow-mode.

**Decision Fase C**: `resolveGuideDocumentExcerpt(query, fullMaterial, studiedBlockChunks)` — ventana de ~4000 chars alrededor del mejor match de tokens de la query en material completo. Política spoiler:
- **Definicional** (pregunta contiene término del inventario o "qué es"/"define"): puede citar pasaje de cualquier parte del PDF.
- **Sintética** (relaciones, implicaciones de bloques no vistos): responder "Aún no has estudiado el bloque que desarrolla esto" + opcionalmente indicar número de bloque si existe en `blocks_list_text`.

**Rationale**: Resuelve Assumption spec sobre spoilers.

## R9 — UI de fidelidad

**Decision**: Badge en barra de bloque (`#blockFidelityBanner`) cuando `anchor_quality === "weak"` o `fidelity_status === "warn"`. Copy ES: "Anclaje débil al PDF" / "Fidelidad reducida — revisa con la fuente".

**Rationale**: FR-B03, FR-C04 visibilidad sin bloquear estudio.

## R10 — Tests

**Decision**: Suite `cursor-tests/20260613_source-fidelity.mjs`:
- `assignAlignedChunks` con material reordenado vs bloques
- `validateBlockFidelity` positivo/negativo/envenenado
- `SOURCE_FIDELITY_RULES` presente en exports de builders (smoke strings)
- Parser `source_phrase` en inventario

Fixtures: fragmento ética con definición no estándar de término análogo a «amoralismo».

**Rationale**: NFR-005; SC medibles sin LLM live.

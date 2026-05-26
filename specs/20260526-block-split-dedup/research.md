# Research: Block Split Deduplication

**Feature**: `20260526-block-split-dedup` | **Date**: 2026-05-26

## R1 — Causa raíz del overlap actual

**Decision**: El overlap es estructural: (1) prompt exige exactamente N bloques, (2) chunks se rellenan con `splitMaterialIntoBlockChunks` por palabras sin alinear conceptos, (3) audit LLM es explícitamente conservador y no ve chunks.

**Rationale**: Confirmado en `buildSplitBlocksPrompt`, `buildAuditPayload` (solo metadata), y `deepSeekAuditBlockIndex` (“if in doubt, KEEP SEPARATE”).

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Solo endurecer prompt monofásico | Ya dice “Never duplicate”; no reduce overlap en práctica |
| Audit menos conservador sin fase 1 | Sigue partiendo el mismo concepto en N slots |
| Embedding similarity en cliente | Dependencia/peso; fuera de v1 |

## R2 — Pipeline de dos fases

**Decision**: Llamada 1 → `ConceptInventory[]`. Llamada 2 → `BlockIndexEntry[]` con reglas de overview, Key terms, fusión si conceptos > N, menos bloques si conceptos < N.

**Rationale**: Alineado con clarificación D/A/B/A/C. Separa “qué enseñar” de “cómo empaquetar en N”.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Una sola llamada con inventario inline | Contexto largo; más fallos de parse |
| Inventario determinista (TF-IDF) | No captura prerequisitos ni módulos |

## R3 — Overview como bloque 1

**Decision**: Fase 2 MUST emitir bloque `id: 1` con título reconocible (`Overview`, `Mapa del curso`, `Course map`) y summary con módulos/hitos; cuenta dentro de N.

**Rationale**: Clarificación A + nota usuario sobre estructura subyacente del estudio.

**Validation**: Regex en normalizer: `/^(overview|mapa del curso|course map)/i` en título del bloque 1.

## R4 — Asignación de `chunk` local

**Decision**: v1 mantiene `splitMaterialIntoBlockChunks(cleanedText, finalBlockCount)` **después** de conocer `finalBlockCount`; opcional v1.1: mapear rangos si fase 2 devuelve `concept_ids[]` por bloque.

**Rationale**: FR-010 pide no copiar PDF en JSON; el fallback proporcional ya existe y es estable. Mejorar asignación por concepto es mejora incremental sin bloquear anti-overlap.

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| LLM pega chunk verbatim | Rompe límites de tokens y duplica material |
| Un chunk por concepto del inventario | Requiere alineación texto↔concepto no trivial en v1 |

## R5 — Dedup determinista (sustituye audit LLM)

**Decision**: `findDeterministicDuplicateMerges(blockIndex)` → pares con `|signatureA ∩ signatureB| ≥ 3` (normalizado lowercase trim) **o** títulos normalizados idénticos. Aplicar `mergeChunks` existente solo para esos pares. **No** llamar `deepSeekAuditBlockIndex` en el flujo nuevo.

**Rationale**: Clarificación C; barato; evita falsos positivos temáticos (FR-009).

**Alternatives considered**:
| Opción | Descartada porque |
|--------|-------------------|
| Mantener audit LLM + dedup | Latencia triple; audit sigue sin fusionar |
| Merge solo local sin LLM post-merge | Pierde deduplicación de texto en chunk |

## R6 — Fallback monofásico

**Decision**: Si parse de inventario o pack falla tras reintentos (misma política que `deepSeekSplitIntoBlocks`: 3 intentos), ejecutar `deepSeekSplitIntoBlocks` + mensaje en status “Usando split clásico (fallback)”.

**Rationale**: FR-012; no bloquear sesión.

## R7 — UI M vs N

**Decision**: Tras split, si `finalBlockCount < requestedN`, mostrar en `#splitMergeSummary` o `generateBlocksStatus`: `Pediste {N}; el material sustentó {M} bloques.`

**Rationale**: SC-003; string testeable.

## R8 — Funciones exportadas y compatibilidad

**Decision**: Añadir `twoPhaseConceptSplit({ material, nBlocks, ... })` en `session.js`; deprecar uso de `twoPhaseSplitMerge` en `study.js` handler; mantener `deepSeekAuditBlockIndex` en `api.js` sin llamar (no borrar aún).

**Rationale**: Migración quirúrgica; un solo call site en `study.js`.

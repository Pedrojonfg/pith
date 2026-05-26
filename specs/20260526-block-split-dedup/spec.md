# Feature Specification: Block Split Deduplication (Two-Phase Concept Split)

**Feature Branch**: `20260526-block-split-dedup`

**Created**: 2026-05-26

**Status**: Draft (clarified)

**Input**: El solapamiento conceptual entre bloques es tremendo; investigar y solucionar el split para que cada bloque enseñe un concepto distinto, con mapa inicial del material.

## Clarifications

### Session 2026-05-26

- Q: ¿Estrategia principal anti-overlap? → A: **D** — Dos fases: (1) inventario ordenado de conceptos del material → (2) empaquetar en bloques sin duplicar concepto.
- Q: Si hay más conceptos que N → → A: **Fusionar** conceptos adyacentes/relacionados hasta quedar en exactamente **N** bloques.
- Q: Si hay menos conceptos que N → → B: Devolver **menos de N** bloques y avisar en UI. Los primeros bloques deben incluir definiciones base **y** overview de la estructura de estudio (no solo términos aislados).
- Q: ¿Cómo encaja la overview con N y Key terms? → A: **Un bloque 1 global** “Overview / mapa del curso” cuenta **dentro de N**; después módulos con Key terms + conceptos.
- Q: ¿Qué hacer con audit/merge LLM actual? → A: **C** — Sustituir por chequeo **determinista** (firmas/términos repetidos) + merge solo si duplicado claro.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Split sin conceptos duplicados (Priority: P1)

Como estudiante, subo material y pido N bloques. El sistema primero extrae una lista ordenada de conceptos teachables y luego los empaqueta en bloques sin repetir el mismo concepto primario en dos bloques.

**Why this priority**: Es la queja principal (overlap tremendo); el split actual fuerza N y el audit LLM casi no fusiona.

**Independent Test**: Material con ~12 temas claros y N=20 → resultado con ≤12 bloques de concepto + overview, o exactamente N si hay fusión explícita; ningún par de bloques con la misma `signature` primaria ni títulos que indiquen el mismo teorema/fórmula.

**Acceptance Scenarios**:

1. **Given** material denso y N=15, **When** genero bloques, **Then** el bloque 1 es overview/mapa global (dentro de N) y ningún otro bloque repite el mismo concepto primario del inventario.
2. **Given** inventario con 22 conceptos y N=15, **When** empaqueto, **Then** obtengo exactamente 15 bloques fusionando solo conceptos relacionados/adjacentes documentados en el merge plan.
3. **Given** inventario con 8 conceptos y N=15, **When** empaqueto, **Then** obtengo 8 bloques (+ overview si no está en los 8) y la UI muestra que se pidieron 15 pero el material sustentó 8.

---

### User Story 2 - Mapa del curso antes del detalle (Priority: P1)

Como estudiante, el primer bloque me da una visión de todo lo que voy a estudiar (estructura y hitos), no solo una lista de términos sueltos.

**Why this priority**: Alinea expectativas y reduce sensación de repetición al estudiar bloques posteriores.

**Independent Test**: Tras split, bloque `id: 1` tiene título tipo “Overview” / “Mapa del curso” y summary que enumera módulos/hitos; cuenta como 1 de N.

**Acceptance Scenarios**:

1. **Given** cualquier material multi-tema, **When** split completa, **Then** bloque 1 es overview global con estructura del curso (módulos o fases), no un bloque de vocabulario suelto.
2. **Given** N=10, **When** confirmo bloques, **Then** quedan 9 bloques restantes para Key terms + conceptos (overview incluida en el 10).

---

### User Story 3 - Chequeo determinista post-empaquetado (Priority: P2)

Como estudiante, si el modelo deja dos bloques con firmas casi idénticas, el sistema los fusiona automáticamente solo cuando el duplicado es inequívoco.

**Why this priority**: Red de seguridad barata sin el audit LLM conservador que rara vez mergea.

**Independent Test**: Índice mock con dos bloques cuya `signature` comparte ≥3 términos idénticos → un solo bloque tras paso determinista; par con solapamiento temático vago → sin merge.

**Acceptance Scenarios**:

1. **Given** dos bloques con intersección de signature ≥ umbral definido, **When** corre el chequeo, **Then** se propone merge automático y el índice final tiene un bloque menos.
2. **Given** solapamiento temático débil (mismo capítulo, distinta profundidad), **When** corre el chequeo, **Then** no se fusionan.

---

### Edge Cases

- Material muy corto (< N conceptos): menos bloques + mensaje UI; no rellenar con bloques vacíos.
- Un solo módulo: overview global sigue siendo bloque 1; primer bloque de módulo puede ser Key terms.
- Inventario vacío o parse fallido: fallback al split monofásico actual con aviso, no bloquear sesión.
- Fusión determinista y fusión por empaquetado en la misma pasada: un bloque no puede absorberse dos veces.
- Import JSON de bloques: sin re-split; chequeo determinista opcional desactivado o solo aviso.
- Idioma distinto al material: inventario y overview en idioma de estudio configurado.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ejecutar **fase 1** LLM: inventario ordenado de conceptos teachables extraídos del material (título corto, 1 línea de alcance, prerequisitos opcionales, módulo temático).
- **FR-002**: El sistema MUST ejecutar **fase 2** LLM: empaquetar el inventario en bloques de índice (`id`, `title`, `summary`, `signature`, `chunk` vacío para asignación local) respetando orden de aprendizaje.
- **FR-003**: El bloque con `id: 1` MUST ser **overview global** del curso (mapa de módulos/hitos a estudiar) y MUST contar dentro del N pedido.
- **FR-004**: Tras overview, cada módulo MUST conservar su primer bloque de vocabulario con prefijo `Key terms: ` (regla existente), salvo material de un solo módulo donde overview + Key terms pueden ser bloques 1 y 2.
- **FR-005**: Si `conceptos_distintos > N` (sin contar overview como concepto duplicado), el sistema MUST fusionar conceptos **relacionados/adjacentes** hasta producir exactamente **N** bloques totales.
- **FR-006**: Si `conceptos_distintos + overview + vocab < N`, el sistema MUST devolver el número real de bloques (sin padding artificial) y MUST mostrar en UI: “Pediste N; el material sustentó M bloques.”
- **FR-007**: El sistema MUST NOT asignar el mismo concepto primario a dos bloques del índice final.
- **FR-008**: El sistema MUST reemplazar `twoPhaseSplitMerge` basado en audit LLM conservador por un paso **determinista**: detectar pares con intersección de `signature` ≥ 3 términos normalizados (case-insensitive) o títulos normalizados idénticos; fusionar solo esos pares usando el merge de chunks existente.
- **FR-009**: El chequeo determinista MUST NOT fusionar por “temática adyacente” sin criterio de firma/título duplicado.
- **FR-010**: Tras split, `chunk` MUST seguir asignándose localmente (proporcional o por rangos de concepto cuando esté disponible); el inventario guía títulos, no copia el PDF entero en JSON.
- **FR-011**: Cambios en `src/js/api.js` (prompts fase 1/2), `src/js/session.js` (empaquetado, dedup), `src/js/study.js` (UI mensaje M vs N, status); tests de normalización de índice.
- **FR-012**: Si fase 1 o 2 fallan tras reintentos existentes, MUST fallback al `deepSeekSplitIntoBlocks` monofásico actual sin perder el flujo de confirmación.

### Non-Functional Requirements

- **NFR-001**: Sin backend; sin frameworks; portable a Flutter (lógica de empaquetado en módulo reutilizable).
- **NFR-002**: Latencia total split ≤ 2× la actual monofásica en p95 (dos llamadas secuenciales aceptables).
- **NFR-003**: El usuario MUST ver progreso: “Inventariando conceptos…” → “Empaquetando N bloques…” → “Comprobando duplicados…”.

### Key Entities

- **ConceptInventoryItem**: `{ order, title, scope_one_line, module?, prerequisite_ids?[] }`
- **ConceptPackPlan**: `{ target_n, merges: [{ concept_ids[], block_title }], final_block_count }`
- **BlockIndexEntry**: existente (`id`, `title`, `summary`, `signature`, `chunk`)
- **DedupMergeRecord**: `{ keep_id, absorb_ids, reason: "signature_overlap" | "title_duplicate" }`

## Success Criteria

- **SC-001**: En prueba manual con material de cálculo vectorial (N=20), el usuario reporta menos repetición de la misma fórmula/teorema entre bloques vs. build anterior.
- **SC-002**: ≥90% de sesiones de prueba: bloque 1 contiene overview explícita del mapa del curso.
- **SC-003**: Cuando inventario < N, UI muestra mensaje M vs N en 100% de casos (test automatizable del string).
- **SC-004**: Pares con ≥3 términos de signature compartidos se reducen a un bloque en ≥95% de casos de prueba sintética.

## Assumptions

- El usuario sigue indicando N como guía, no como obligación absoluta cuando el material no alcanza.
- “Concepto” = una idea enseñable en una pasada RSVP (~3–8 min), alineado con reglas actuales del split.
- El audit LLM (`deepSeekAuditBlockIndex`) queda deprecado para este flujo; se mantiene el merge de chunks LLM solo para fusiones deterministas o de empaquetado fase 2.

# Feature Specification: Grafo Académico — Género Textual y Tipado Filosófico

**Feature Branch**: `20260530-graph-academic-genre`

**Created**: 2026-06-07

**Status**: Draft

**Input**: El sistema de grafo Slow Mode asume textos científico-técnicos (nodos atemporales, personas como agentes, argumento lineal P1+P2→C). Textos filosófico-históricos (ej. Horlacher sobre Bildung) requieren tipado de nodos, vocabulario de aristas ampliado, detección de género textual en Phase 0, deduplicación de clusters y limpieza de nodos huérfanos.

## Diagnóstico (causa raíz)

Tres supuestos implícitos que fallan en genealogías y debates académicos:

1. Todos los nodos del texto comparten el mismo "nivel temporal" (presente atemporal).
2. Las personas en el texto son agentes del argumento, no nodos conceptuales.
3. La estructura argumental es siempre lineal: P1 + P2 → C.

## User Scenarios & Testing

### User Story 1 — Genealogía de conceptos (Priority: P1)

Como estudiante leyendo un texto genealógico (ej. evolución de *Bildung*), quiero que Phase 0 detecte el género GENEALOGÍA y construya un mapa cronológico con aristas `historically_precedes`, para ver cómo muta el significado según época y autor.

**Why this priority**: Es el cambio más importante; sin género textual el mapa argumental distorsiona textos históricos.

**Independent Test**: Cargar extracto Horlacher; Phase 0 devuelve `textGenre: "GENEALOGÍA"`; grafo Phase 0 usa `historically_precedes` entre nodos del mapa con campo `period`.

**Acceptance Scenarios**:

1. **Given** texto genealógico, **When** Phase 0 genera orientación, **Then** JSON incluye `textGenre: "GENEALOGÍA"` y nodos del mapa con `period`.
2. **Given** `textGenre === "GENEALOGÍA"`, **When** se construye grafo Phase 0, **Then** aristas entre nodos consecutivos del mapa son `historically_precedes` (no `sequence`).
3. **Given** texto lineal técnico, **When** Phase 0 genera orientación, **Then** `textGenre: "ARGUMENTO_LINEAL"` y estructura P1/P2/C sin regresión.

---

### User Story 2 — Tipado de nodos en capa text (Priority: P1)

Como estudiante, quiero que los conceptos extraídos distingan [CONCEPTO], [PERSONA], [OBRA], [MOVIMIENTO] y [EVENTO], para que el grafo refleje la ontología del texto académico.

**Why this priority**: El subtipo gobierna qué aristas son válidas (ej. PERSONA `reinterprets` CONCEPTO).

**Independent Test**: Phase 0 devuelve `conceptsToFind` con `nodeType`; nodos en grafo muestran prefijo de tipo; aristas inválidas no se crean.

**Acceptance Scenarios**:

1. **Given** prompt Phase 0, **When** IA extrae conceptos, **Then** cada ítem incluye `nodeType` ∈ {CONCEPTO, PERSONA, OBRA, MOVIMIENTO, EVENTO}.
2. **Given** autor del texto mencionado bibliográficamente, **When** IA extrae nodos, **Then** no crea nodo [PERSONA] para el autor analizado.
3. **Given** nodo [PERSONA] y [CONCEPTO], **When** mapa indica resignificación, **Then** arista `reinterprets` es válida; CONCEPTO→PERSONA `defines` no se crea.

---

### User Story 3 — Aristas filosóficas y visualización (Priority: P2)

Como estudiante, quiero aristas `historically_precedes`, `reinterprets`, `constitutes`, `contrasts_with`, `influences`, `instantiates` con estilos visuales distintos en el canvas SVG.

**Why this priority**: Distingue oposición lógica (`contradicts`) de distinción conceptual (`contrasts_with`).

**Independent Test**: Grafo con mezcla de tipos; export markdown incluye familia correcta; canvas renderiza líneas sólida/punteada/doble según tipo.

**Acceptance Scenarios**:

1. **Given** arista `contrasts_with` entre Bildung y Erziehung, **When** exporto grafo, **Then** aparece como distinción conceptual, no contradicción.
2. **Given** grafo en canvas, **When** hay tipos nuevos, **Then** cada tipo tiene color/estilo de línea distinguible en leyenda.

---

### User Story 4 — Deduplicación de clusters (Priority: P2)

Como estudiante, quiero que conceptos con el mismo rol estructural (ej. PISA, estandarización, enseñanza para el examen) se agrupen en un nodo con `includes`, para evitar inflación del grafo.

**Independent Test**: Texto con múltiples ejemplos de oposición tecnocrática; Phase 0 devuelve 1 nodo [EVENTO] agrupado con `includes: [...]`.

**Acceptance Scenarios**:

1. **Given** varios ejemplos del mismo rol argumental, **When** Phase 0 extrae conceptos, **Then** un solo nodo representativo con `includes` lista los elementos agrupados.
2. **Given** nodo agrupado, **When** se muestra en grafo/lista, **Then** etiqueta incluye resumen representativo.

---

### User Story 5 — Sin nodos huérfanos (Priority: P2)

Como estudiante, quiero que nodos sin aristas (excepto capa `user`) se eliminen antes de persistir el grafo, para no ver entradas desconectadas como "Del soliloquio" o "Zöllner".

**Independent Test**: Grafo con nodo aislado en capa `text`; tras build+prune desaparece; nodos `user` sin aristas se conservan.

**Acceptance Scenarios**:

1. **Given** nodo text sin aristas, **When** se construye grafo enriquecido, **Then** `pruneOrphanNodes` lo elimina y emite `console.warn`.
2. **Given** nodo `user` sin aristas, **When** se aplica prune, **Then** el nodo se mantiene.

---

### Edge Cases

- `textGenre` desconocido o ausente → fallback `ARGUMENTO_LINEAL` (comportamiento actual).
- Map-reduce Phase 0 (textos ≥60k): género y tipos deben sintetizarse en paso final.
- Sesiones Phase 0 existentes sin `textGenre`/`nodeType` → migración implícita con defaults.
- `ANÁLISIS_DE_CASO` y `DEFINICIÓN`: estructuras de mapa específicas; v1 puede renderizar como arg nodes con metadata extra.
- `DEBATE`: nodos con campo `author`; aristas entre posiciones usan `contrasts_with` o `relates` según prompt.

## Requirements

### Functional Requirements

- **FR-001**: Phase 0 DEBE clasificar el texto en `textGenre` ∈ {ARGUMENTO_LINEAL, GENEALOGÍA, DEBATE, DEFINICIÓN, ANÁLISIS_DE_CASO} antes de construir `argumentMap`.
- **FR-002**: `argumentMap` DEBE adaptar estructura según género (cronológica con `period` para GENEALOGÍA; `author` para DEBATE; nodo central + satélites para DEFINICIÓN; P1/P2/C para ARGUMENTO_LINEAL).
- **FR-003**: `conceptsToFind` DEBE incluir `nodeType` y opcionalmente `includes[]` para clusters deduplicados.
- **FR-004**: Prompt Phase 0 DEBE instruir: no crear [PERSONA] para el autor del texto analizado; ignorar auto-referencia bibliográfica.
- **FR-005**: `buildSlowPhase0GraphFromInputs` DEBE usar `historically_precedes` entre nodos del mapa cuando `textGenre === "GENEALOGÍA"`; `sequence` en otros géneros lineales.
- **FR-006**: El vocabulario de aristas DEBE extenderse con: `historically_precedes`, `reinterprets`, `constitutes`, `contrasts_with`, `influences`, `instantiates` (además de tipos existentes).
- **FR-007**: Validación de direccionalidad: [PERSONA|MOVIMIENTO] puede `reinterprets` [CONCEPTO]; [CONCEPTO] no puede `defines` [PERSONA].
- **FR-008**: `pruneOrphanNodes(graph)` DEBE ejecutarse al final de builders de grafo Slow antes de persistir; conservar nodos `layer === 'user'`.
- **FR-009**: `canvas.js` DEBE representar tipos de arista nuevos con estilos de línea diferenciados (sólida, punteada, doble).
- **FR-010**: `export-format.js` DEBE mapear nuevos tipos a familias epistémicas/semánticas/argumentativas para export markdown.
- **FR-011**: Validación cliente (`validatePhase0Orientation`) DEBE aceptar campos nuevos sin romper sesiones legacy (campos opcionales con defaults).
- **FR-012**: Sin cambios en RSVP ni Cloze; alcance limitado a Slow Mode Phase 0 + grafo material.

### Key Entities

- **TextGenre**: enum de clasificación textual; gobierna forma del `argumentMap` y tipo de arista secuencial.
- **TextNodeSubtype**: CONCEPTO | PERSONA | OBRA | MOVIMIENTO | EVENTO; metadata en `conceptsToFind` y label de nodo grafo.
- **ConceptToFind** (extendido): `{ term, authorUsage, nodeType?, includes?, graphTermId? }`.
- **ArgumentMapNode** (extendido): `{ id, text, status?, period?, author?, linkType? }`.
- **GraphEdge.type** (extendido): union de tipos didácticos, argumentativos y filosófico-históricos.
- **Phase0Orientation** (extendido): añade `textGenre`.

## Success Criteria

- **SC-001**: Extracto genealógico (Horlacher fixture) produce `textGenre: GENEALOGÍA` y ≥80% nodos del mapa con `period`.
- **SC-002**: Texto técnico-lineal existente (economía fixture) mantiene `ARGUMENTO_LINEAL` sin regresión en tests T14/T11.
- **SC-003**: Grafo Phase 0 genealógico usa 0 aristas `sequence` entre nodos de mapa (solo `historically_precedes`).
- **SC-004**: Tras prune, 0 nodos huérfanos en capas text/arg/concept en fixture con nodos aislados.
- **SC-005**: Canvas y export reconocen los 6 tipos de arista nuevos.
- **SC-006**: Phase 0 con oposiciones repetidas reduce a ≤5 `conceptsToFind` con al menos 1 nodo agrupado con `includes`.

## Assumptions

- Cambios solo en Slow Mode (`phase0.js`, `graph/build.js`, `graph/canvas.js`, `export-format.js`).
- IA sigue siendo DeepSeek/Gemini vía `llm.js`; prompts en español/inglés según `getStudyLanguage()`.
- Géneros DEFINICIÓN y ANÁLISIS_DE_CASO: v1 persiste metadata en nodos; layout específico del grafo puede ser incremental.
- Reglas de direccionalidad de aristas se aplican en build, no en prompt IA (defensa en profundidad).
- `pruneOrphanNodes` no afecta nodos RSVP/Cloze.

# Feature Specification: RSVP Pipeline Levers (Strict Mode)

**Feature Branch**: `20260617-pipeline-levers`

**Created**: 2026-06-12

**Status**: Draft

**Input**: User description: "Todas las palancas del pipeline MyLearning en modo estricto (source_fidelity_mode: strict), flujo RSVP. Resolver overlapping estructural de preguntas y bloques thin (poca chicha)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sin preguntas duplicadas entre glosario y desarrollo (Priority: P1)

Un estudiante genera bloques RSVP desde un documento académico denso (p. ej. apuntes de ética de 60 páginas). Tras estudiar el bloque "Key terms" de un módulo y pasar al bloque de desarrollo del mismo módulo, las preguntas del segundo bloque no repiten definiciones ya cubiertas en el glosario.

**Why this priority**: El overlapping de preguntas es el problema más visible y frustrante; degrada la percepción de calidad pedagógica sin añadir valor.

**Independent Test**: Generar sesión strict con documento de prueba; verificar que bloques Key terms y Overview no generan preguntas de test; verificar que bloques de desarrollo no preguntan "¿qué es X?" para términos del Key terms previo del mismo módulo.

**Acceptance Scenarios**:

1. **Given** un bloque titulado "Key terms: [módulo]", **When** se genera el bloque, **Then** no se crean preguntas de test ni socráticas para ese bloque.
2. **Given** un bloque "Overview" o "Course map", **When** se genera el bloque, **Then** no se crean preguntas de test.
3. **Given** un bloque de desarrollo inmediatamente después de Key terms del mismo módulo, **When** se generan preguntas, **Then** ninguna pregunta pide definición de términos ya listados en el Key terms previo.

---

### User Story 2 - Bloques con suficiente sustancia del documento (Priority: P1)

Un estudiante estudia bloques generados desde material denso. Cada bloque de desarrollo cubre una porción sustancial del documento fuente; las explicaciones no omiten la mayoría de los claims del fragmento asignado.

**Why this priority**: "Poca chicha" hace que las preguntas se repitan sobre poco material y que la sesión no refleje la riqueza del documento.

**Independent Test**: Subir documento académico denso; comparar densidad de conceptos en inventario (≥1 concepto cada ~300 palabras) y claim coverage de explicaciones (≥60% de claims del chunk cubiertos).

**Acceptance Scenarios**:

1. **Given** un documento de 15 000 palabras de texto académico denso, **When** se ejecuta inventario de conceptos, **Then** el sistema identifica al menos 30 conceptos pedagógicamente significativos (target dinámico según longitud).
2. **Given** un bloque con chunk asignado, **When** se valida la explicación generada, **Then** al menos el 60% de los claims extraídos del chunk aparecen reflejados en la explicación, o se reintenta la generación con instrucción de cubrir claims omitidos.
3. **Given** un documento con secciones marcadas por delimitadores no estándar (❖, ➔), **When** se normaliza el documento, **Then** se produce jerarquía documental utilizable para alinear chunks a secciones.

---

### User Story 3 - Memoria cross-bloque de lo ya preguntado (Priority: P2)

Durante una sesión RSVP de muchos bloques, el sistema recuerda qué claims y términos ya fueron objeto de pregunta en bloques anteriores y evita regenerar preguntas semánticamente equivalentes.

**Why this priority**: Complementa las restricciones por tipo de bloque y cierra el overlapping residual entre bloques de desarrollo.

**Independent Test**: Completar 5+ bloques de desarrollo; inspeccionar que preguntas de bloques posteriores no repiten claims ya cubiertos en el manifiesto de cobertura.

**Acceptance Scenarios**:

1. **Given** bloques 1–3 ya generados con preguntas, **When** se generan preguntas del bloque 4, **Then** el generador recibe manifiesto de claims ya preguntados y no repite esos claims.
2. **Given** un usuario solicita regenerar preguntas de un bloque, **When** se ejecuta la regeneración, **Then** el manifiesto de cobertura se pasa como input y se respeta en el prompt.

---

### User Story 4 - Auditoría de solapamiento entre bloques (Priority: P2)

Tras generar un bloque de desarrollo, el sistema detecta si su explicación repite sustancialmente contenido de los dos bloques anteriores y, si es así, regenera con instrucciones de evitar el solapamiento.

**Why this priority**: Red de seguridad para overlapping que escapa a reglas locales y prompts.

**Independent Test**: Forzar escenario con bloques adyacentes sobre mismo módulo; verificar que la auditoría detecta overlap y dispara retry con `avoidOverlapWith`.

**Acceptance Scenarios**:

1. **Given** un bloque de desarrollo (índice > 1), **When** la explicación generada solapa significativamente con bloques previos, **Then** el sistema regenera con instrucción explícita de evitar conceptos solapados.
2. **Given** un bloque Key terms (sin preguntas), **When** se evalúa auditoría, **Then** la auditoría no se aplica o no bloquea el flujo innecesariamente.

---

### User Story 5 - Glosario accesible sin interrumpir el flujo lineal (Priority: P3)

El estudiante puede consultar definiciones de términos clave del módulo como referencia lateral sin que el bloque Key terms interrumpa la secuencia lineal de estudio RSVP.

**Why this priority**: Solución arquitectónica a medio plazo que preserva utilidad del glosario sin overlapping estructural.

**Independent Test**: Generar sesión con Key terms; verificar que el bloque no aparece en secuencia lineal de estudio pero es accesible desde UI de referencia.

**Acceptance Scenarios**:

1. **Given** un bloque Key terms generado, **When** el usuario avanza en la sesión lineal, **Then** el bloque Key terms se omite de la secuencia de estudio.
2. **Given** un bloque Key terms, **When** el usuario abre la referencia de términos del módulo, **Then** puede leer las definiciones del glosario.

---

### Edge Cases

- ¿Qué ocurre si el inventario dinámico supera el cap de 120 conceptos? → Se aplica cap y se sugiere inventario en dos pasadas.
- ¿Qué ocurre si `docHierarchy` no está disponible? → Snap a sección se omite con warning; alineación por términos sigue activa.
- ¿Qué ocurre si claim coverage retry falla tras N intentos? → Bloque se marca con warning de cobertura baja; usuario puede regenerar manualmente.
- ¿Qué ocurre en modo no-strict? → Palancas de overlapping (L15, L14, L16) siguen activas; umbrales de fidelity más permisivos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE asignar `n_test = 0` y `n_socratic = 0` a bloques cuyo título coincide con "Key terms:", "Overview:" o "Course map:".
- **FR-002**: El sistema DEBE calcular un target dinámico de conceptos en inventario basado en longitud del documento (~2 conceptos cada 300 palabras, mínimo 30, máximo 120).
- **FR-003**: El sistema DEBE restringir tipos de pregunta según tipo de bloque (Key terms: solo definición/clasificación; desarrollo: no repetir definiciones del Key terms previo del mismo módulo).
- **FR-004**: El sistema DEBE mantener un manifiesto de cobertura (`coverageManifest`) con claims ya preguntados y pasarlo al generador de preguntas de bloques posteriores.
- **FR-005**: El sistema DEBE pasar `coverageManifest` a la función de regeneración de preguntas.
- **FR-006**: El sistema DEBE invocar auditoría de solapamiento entre explicaciones de bloques adyacentes para bloques de desarrollo y regenerar si se detecta solapamiento significativo.
- **FR-007**: El sistema DEBE validar claim coverage de explicaciones (≥60% de claims del chunk cubiertos) y reintentar generación si está por debajo del umbral.
- **FR-008**: El sistema DEBE detectar delimitadores de sección no-HTML (❖, ➔, ➢) durante normalización y producir `docHierarchy` con offsets.
- **FR-009**: El sistema DEBE aplicar snap obligatorio a secciones documentales cuando `docHierarchy` está disponible.
- **FR-010**: El sistema DEBE hacer configurable el umbral de solapamiento de firma en dedup (default 3; valor 2 en modo strict).
- **FR-011**: El sistema DEBE incluir instrucción anti-reteaching en prompts de preguntas listando términos ya preguntados.
- **FR-012**: El sistema PUEDE ejecutar inventario en dos pasadas (macro + micro por sección) para documentos densos.
- **FR-013**: El sistema PUEDE separar generación de explicación y preguntas en dos llamadas LLM por bloque.
- **FR-014**: El sistema PUEDE excluir bloques Key terms de la secuencia lineal de estudio manteniéndolos como referencia lateral.
- **FR-015**: El sistema DEBE aplicar todas las palancas P0–P2 en modo `source_fidelity_mode: strict` sin degradar el flujo RSVP existente.

### Key Entities

- **CoverageManifest**: Lista ordenada de claims ya preguntados (blockId, claimType, keyTerms, questionAsked).
- **ConceptInventoryItem**: Concepto con campos opcionales `level` (1|2), `concept_type` (definition|argument|example|distinction|excursus), `secondary`.
- **BlockQuestionConfig**: Configuración por bloque incluyendo n_test, n_socratic, restricciones de scope y connection question rules.
- **FidelityMetrics**: Métricas Jaccard explanation↔chunk, chunk_coverage, claimCoverageRatio.
- **DocHierarchy**: Árbol de secciones con offsets de inicio/fin para snap de chunks.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En documento de prueba de 60 páginas (ética), overlapping de preguntas entre Key terms y desarrollo del mismo módulo se reduce en al menos un 80% respecto al baseline actual.
- **SC-002**: Densidad de inventario en documentos académicos densos alcanza ≥1.5 conceptos por página equivalente (300 palabras).
- **SC-003**: Al menos el 70% de bloques de desarrollo en modo strict alcanzan claim coverage ≥60% en primera generación o tras un retry.
- **SC-004**: Usuarios completan sesión de 10+ bloques sin reportar más de 2 preguntas percibidas como duplicadas (validación manual en quickstart).
- **SC-005**: Tiempo de generación de bloques no aumenta más de un 40% en Sprint 0–1 (palancas de bajo coste) respecto al baseline.

## Assumptions

- El alcance inicial es flujo RSVP con `source_fidelity_mode: strict`; Questions mode y Slow mode quedan fuera salvo regresiones.
- Las palancas P4–P5 (dedup semántico, nodos grises en grafo) son opcionales y se implementan tras P0–P3.
- L5-A (Key terms sin preguntas) es la solución inmediata; L5-D (referencia lateral) es evolución en Sprint 3.
- Existe infraestructura previa: `deepSeekAuditBlockOverlap`, `validateBlockFidelity`, `assignAlignedChunks`, `docHierarchy` (feature 20260609, 20260613).
- El documento de referencia para QA es apuntes de ética con delimitadores ❖ y ➔.
- Cap de inventario: 120 conceptos; por encima se activa inventario en dos pasadas.

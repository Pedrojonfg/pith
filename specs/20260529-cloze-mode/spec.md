# Feature Specification: Cloze Detection — Recuperación Activa sobre Grafo

**Feature Branch**: `20260529-cloze-mode`

**Created**: 2026-06-07

**Status**: Draft

**Input**: Tercer modo de estudio **Cloze Detection** (basado en `cloze_mode_spec.md`). Pipeline de generación de ítems NODE/EDGE sobre grafo epistémico con distractores calibrados. Reutilizar infraestructura modo-agnóstica existente: selector de archivos / normalización de entrada, constructor y visor de grafo (`buildSessionGraph`, `mountMaterialGraphScreen`), selector de modo y persistencia por modo (`sessionsByMode`).

## Clarifications

### Session 2026-06-07

- Q: ¿Alcance v1 del modo (UI/estudio)? → A: **Opción A** — pipeline completo (fases 0–4) + sesión MC mínima reutilizando patrones de `review.js` y `shuffle-options.js` (oración con hueco, 4 opciones barajadas, feedback inmediato); integración con motor SR **diferida a v2** (campos `ClozeItem` preparatorios permitidos).
- Q: ¿Grafo epistémico y reutilización? → A: **Opción A** — grafo epistémico vive solo en la sesión `cloze`; Fase 0 **siempre** en sesión nueva; sin caché cross-modo con RSVP/Slow; al **continuar** sesión cloze existente se reutiliza el grafo ya persistido en ese slot.
- Q: ¿Pool de distractores L2 (vault) en v1? → A: **Opción A** — solo L1 (nodos del grafo del documento) + L3 (generación sintética como fallback); L2 vault global **diferido a v2**.
- Q: ¿Cuándo se dispara el pipeline de generación? → A: **Opción B** — botón explícito "Generar ítems" tras upload; las 5 fases (0–4) solo al pulsar; upload+normalización no invocan IA automáticamente.
- Q: ¿Persistencia de sesión cloze? → A: **Opción A** — un único slot `sessionsByMode.cloze` con el mismo contrato RSVP/Slow (continuar / nueva sesión; nueva reemplaza solo slot `cloze`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir Cloze Detection como tercer modo (Priority: P1)

Como estudiante, quiero elegir **Cloze Detection** junto a RSVP y Slow Mode al crear una sesión, para practicar recuperación activa con ítems cloze de alta calidad sobre el material cargado.

**Why this priority**: Sin entrada en el selector de modos, el pipeline no es accesible.

**Independent Test**: Abrir pantalla de creación; seleccionar Cloze Detection; verificar flujo distinto de RSVP (bloques) y Slow (fases 0–3).

**Acceptance Scenarios**:

1. **Given** pantalla de creación de sesión, **When** la abro, **Then** veo tres modos (RSVP, Slow Mode, Cloze Detection) sin preselección, cada uno con hint breve.
2. **Given** elijo Cloze Detection y existe sesión guardada de ese modo, **When** confirmo, **Then** puedo continuar o iniciar sesión nueva (reemplaza solo el slot `cloze`).
3. **Given** modo Cloze y sesión nueva, **When** subo archivo vía flujo de upload existente, **Then** el material se normaliza sin llamadas IA; veo botón "Generar ítems" para disparar el pipeline.
4. **Given** material normalizado cargado, **When** pulso "Generar ítems", **Then** se ejecutan fases 0–4 con indicador de progreso por fase.

---

### User Story 2 - Generación de ítems NODE y EDGE (Priority: P1)

Como estudiante, quiero que el sistema genere ítems cloze multiple-choice (4 opciones) desde el grafo epistémico del documento, cubriendo conceptos (NODE-DEF, NODE-APP, NODE-COND, NODE-CONTRAST) y relaciones (EDGE-SOURCE, EDGE-TARGET, EDGE-RELATION).

**Why this priority**: Núcleo diferenciador del modo; calidad de huecos y distractores es la hipótesis de diseño.

**Independent Test**: Cargar texto técnico ~12k chars; ejecutar pipeline; verificar 60–120 ítems `qa_status: valid` con balance EASY 30% / MEDIUM 50% / HARD 20%.

**Acceptance Scenarios**:

1. **Given** texto normalizado y grafo disponible, **When** ejecuto generación, **Then** se producen candidatos NODE (nodos `importance ≥ 3`) y EDGE (aristas con `aptitude_score` adecuado).
2. **Given** ítems generados, **When** reviso estructura, **Then** cada ítem tiene `sentence_with_blank`, `blank_text`, 3 distractores con gradiente de plausibilidad y `difficulty` asignada.
3. **Given** pipeline completo, **When** termina QA, **Then** ítems `rejected` y `weak` no se sirven al usuario en sesión de estudio.

---

### User Story 3 - Sesión de estudio cloze (Priority: P1)

Como estudiante, quiero responder ítems cloze en secuencia con feedback inmediato, para consolidar conceptos y relaciones del documento.

**Why this priority**: Sin sesión de estudio, el modo no entrega valor al usuario pese al pipeline; v1 reutiliza UI MC existente sin SR.

**Independent Test**: Completar sesión de ≥10 ítems; verificar barajar opciones (`shuffle-options.js`), feedback inmediato y persistencia de progreso.

**Acceptance Scenarios**:

1. **Given** ítems validados, **When** inicio sesión de estudio, **Then** veo oración con hueco y 4 opciones barajadas (patrón `review.js`).
2. **Given** respondo un ítem, **When** confirmo, **Then** recibo feedback correcto/incorrecto inmediato y avanzo al siguiente ítem (sin cola SR).
3. **Given** sesión interrumpida, **When** reanudo, **Then** continúo desde el ítem pendiente con progreso restaurado.

---

### User Story 4 - Reutilización de grafo y visualización (Priority: P2)

Como estudiante, quiero ver el grafo epistémico del material durante o tras la generación, reutilizando el visor de grafo existente.

**Why this priority**: El usuario exige no reimplementar graph creator; el grafo es insumo del pipeline.

**Independent Test**: Tras generar grafo, abrir vista de grafo; verificar nodos/aristas coherentes con `ClozeItem` generados.

**Acceptance Scenarios**:

1. **Given** grafo persistido en sesión `cloze`, **When** abro vista de grafo, **Then** se usa `buildSessionGraph({ mode: 'cloze' })` / `mountMaterialGraphScreen` (modo-agnóstico), no un visor nuevo.
2. **Given** inicio sesión cloze **nueva**, **When** subo material, **Then** Fase 0 genera grafo epistémico propio (sin leer grafos RSVP/Slow).
3. **Given** continúo sesión cloze guardada con grafo, **When** reanudo, **Then** Fase 0 se omite y se usa `cloze.epistemicGraph` del slot.

---

### Edge Cases

- Texto >50k caracteres: chunking solo en generación; textos ≤15k pasan completos (coherencia semántica).
- Grafo sin nodos `importance ≥ 3`: generación NODE vacía; sesión puede continuar solo con EDGE o mostrar estado vacío.
- Pool L1 insuficiente para distractores plausibles: fallback L3 (generación sintética).
- Pool L1 insuficiente y sin vault L2 en v1: Fase 3 usa L3 (distractores sintéticos) para completar gradiente de plausibilidad.
- Mismo archivo en tres modos: estado independiente por slot `sessionsByMode.cloze`; grafo epistémico no se comparte con RSVP/Slow aunque el archivo sea el mismo.
- Sesión cloze nueva sobre material ya estudiado en otro modo: Fase 0 se ejecuta de nuevo (grafo cloze independiente).
- Fallo IA en fase intermedia: reintento por fase; sesión parcial no sirve ítems incompletos.
- Usuario sube material pero no pulsa "Generar ítems": sesión queda en estado `normalized` sin ítems; puede generar después o iniciar otra sesión.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ofrecer selector de tres modos (RSVP, Slow Mode, Cloze Detection) sin preselección; tras elegir modo, continuar última sesión de ese modo o crear sesión nueva.
- **FR-002**: Cloze Detection DEBE reutilizar el flujo de upload y normalización de material existente (`input-normalization.js`); no implementar selector de archivos nuevo.
- **FR-002a**: Tras upload+normalización, el pipeline IA (fases 0–4) **no** debe ejecutarse automáticamente; requiere acción explícita del usuario ("Generar ítems").
- **FR-003**: El pipeline DEBE generar ítems en fases: (0) grafo epistémico en sesión nueva cloze (siempre), (1) análisis semántico, (2) ítems base, (3) distractores, (4) QA + dificultad — 5 llamadas IA por documento típico en sesión nueva; Fase 0 omitida solo al continuar sesión cloze con `epistemicGraph` ya persistido.
- **FR-004**: Solo nodos con `importance ≥ 3` generan ítems NODE; nodos de menor importancia permanecen como pool de distractores L1.
- **FR-005**: Cada ítem válido DEBE tener exactamente 4 opciones (1 correcta + 3 distractores) con gradiente de plausibilidad high/medium/low.
- **FR-006**: QA DEBE rechazar ítems recuperables solo por gramática, con múltiples respuestas válidas, o distractores triviales.
- **FR-007**: Balance post-QA objetivo: EASY 30%, MEDIUM 50%, HARD 20%.
- **FR-008**: El sistema DEBE reutilizar constructor y visor de grafo modo-agnóstico (`buildSessionGraph` con modo `cloze`, `mountMaterialGraphScreen`); no implementar visor ni layout de grafo desde cero. El grafo epistémico se almacena en `cloze.epistemicGraph`; **no** hay caché cross-modo con RSVP/Slow.
- **FR-009**: Persistencia DEBE extender `sessionsByMode` con slot `cloze`: `{ rsvp, slow, cloze }`; esquema unificado (`studyMode: 'cloze'` + sub-objeto `cloze`); crear sesión nueva reemplaza **solo** el slot `cloze`; continuar restaura última sesión cloze guardada.
- **FR-009a**: Migración: si `sessionsByMode` existe sin `cloze`, inicializar `cloze: null` sin afectar slots `rsvp`/`slow`.
- **FR-010**: v1 DEBE ofrecer sesión MC mínima reutilizando `review.js` / `shuffle-options.js` (oración con hueco, opciones barajadas, feedback inmediato); **no** integrar ítems al motor SR en v1.
- **FR-010a**: `ClozeItem` PUEDE incluir campos preparatorios SR (`next_review`, `sm2_*`) sin población ni scheduling en v1.
- **FR-011**: Fase 3 DEBE usar pool L1 (nodos del `epistemicGraph` del documento) como fuente primaria; si L1 es insuficiente, fallback L3 (distractores sintéticos vía IA). **L2 vault global fuera de alcance v1.**

### Key Entities

- **StudyMode**: `rsvp` | `slow` | `cloze`; determina pipeline.
- **SessionsByMode**: `{ rsvp: ActiveSession | null, slow: ActiveSession | null, cloze: ActiveSession | null }` en localStorage.
- **ClozeItem**: ítem MC con `item_type` (NODE-* / EDGE-*), oración con hueco, opciones, `difficulty`, `qa_status`, metadatos de nodo/arista.
- **EpistemicGraph**: nodos (`id`, `text`, `type`, `importance`, `semantic_cluster`, `aliases`) y aristas tipadas (`implies`, `causes`, etc.) con `sentence_context`.
- **ClozeSession** *(sub-objeto `cloze`)*: texto normalizado, `epistemicGraph` (propiedad de esta sesión), ítems generados, índice de estudio, estadísticas (`times_shown`, `times_correct`).
- **DistractorPool**: L1 (nodos del grafo documento, v1) y L3 (sintético, fallback v1); L2 (vault global) reservado para v2.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Selector de tres modos funcional sin cruzar datos entre slots `rsvp`, `slow`, `cloze`.
- **SC-002**: Tras pulsar "Generar ítems", documento ~12k chars produce 60–120 ítems `valid` tras QA en flujo de prueba.
- **SC-003**: ≥55% de ítems brutos sobreviven QA (tasa supervivencia objetivo).
- **SC-004**: 100% de ítems servidos tienen exactamente 1 respuesta correcta verificable por criterios de QA.
- **SC-005**: Sesión MC reanudable (sin SR) restaura progreso en <2s percibidos.
- **SC-007**: Sesión MC completa ≥10 ítems con feedback inmediato en flujo de prueba, sin regresiones en `review.js` compartido.
- **SC-006**: Vista de grafo usa componentes existentes sin duplicar `graph/build.js` ni `graph/view.js`.

## Assumptions

- Cloze Detection coexiste con RSVP y Slow Mode; no reemplaza pipelines existentes.
- Misma infraestructura IA (DeepSeek / Gemini) y selector de modelo que otros modos.
- Textos típicos ≤15k caracteres no requieren chunking en generación.
- Un solo usuario local (PWA); sin multi-usuario ni sync cloud en v1.
- El borrador `cloze_mode_spec.md` define taxonomía de ítems, pipeline y estructura `ClozeItem` como referencia de diseño.
- Upload, normalización y **visor** de grafo se reutilizan; generación de grafo epistémico y pipeline cloze son propios del modo.
- Grafo epistémico aislado por sesión `cloze`; sin caché cross-modo en v1.
- Distractores v1: L1 + L3 únicamente; vault L2 en v2.
- v1 incluye sesión MC mínima; motor SR y scheduling quedan para v2.
- Persistencia: un slot `sessionsByMode.cloze` (mismo contrato continuar/nueva que RSVP/Slow).

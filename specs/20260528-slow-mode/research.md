# Research: Slow Mode — Lectura Profunda

**Feature**: `20260528-slow-mode` | **Date**: 2026-06-06

## R1 — Persistencia `sessionsByMode` y migración

**Decision**: Nuevo key `sessions_by_mode` en localStorage (`{ rsvp: ActiveSession|null, slow: ActiveSession|null }`). Al bootstrap, si existe `active_session` legacy sin `sessions_by_mode`, migrar a `sessions_by_mode.rsvp` y conservar `active_session` como alias de lectura hasta eliminación en tarea de limpieza.

**Rationale**: Clarificación Q4/Q5; permite reanudar RSVP y Slow independientemente sin pisar slots.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Dos keys planas (`active_session_rsvp`, `active_session_slow`) | Duplica lógica de serialización |
| Un solo `active_session` | Contradice reanudación por modo |

## R2 — Paginación viewport con anclas por carácter

**Decision**: Motor en `src/js/slow/pagination.js` que:
1. Renderiza el `normalizedText` del scope en contenedor oculto de medida con tipografía activa.
2. Calcula breakpoints `[charStart, charEnd)` por página mediante búsqueda binaria sobre offsets.
3. Cachea breakpoints por hash de `(normalizedText, fontSize, lineHeight, fontFamily, containerWidth)`.
4. Recalcula al cambiar tipografía; anotaciones usan offsets absolutos en scope, no índice de página.

**Rationale**: Clarificación Q2; alinea con evidencia de anclaje espacial sin depender de páginas PDF nativas.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Páginas fijas ~350 palabras | Rompe con tipografía ajustable del spec |
| pdf.js páginas nativas | Solo PDF; layout inconsistente vs txt/md |

## R3 — Normalización de entrada

**Decision**: Reutilizar `input-normalization.js` existente (`html → html_min`, resto → markdown). `SlowSession.normalizedText` almacena el payload del scope (slice del documento completo normalizado).

**Rationale**: FR-003, FR-009; un solo pipeline de tokens.

## R4 — Detección de scope y secciones

**Decision**: Parser de headings en `src/js/slow/headings.js`:
- HTML: `h1`–`h3` vía `DOMParser`.
- Markdown: líneas `#` / `##` / `###`.
- `ReadingScope`: `{ kind: 'full'|'chapter'|'section', charStart, charEnd, label }`.
- `SectionBoundary[]` para checkpoints: mismos headings dentro del scope activo.

**Rationale**: FR-005, FR-007; scope usuario + checkpoints sin ML.

## R5 — Fase 0 IA híbrida (scope + umbral 60k)

**Decision**: Tras elegir scope:
- Si `scope.length < 60000` → `generatePhase0Single(scopeText, opts)` una llamada JSON estructurada.
- Si `≥ 60000` → dividir scope por headings en chunks ≤50k chars; `generatePhase0Chunk` por subsección; `synthesizePhase0(chunks[])` llamada final.
- UI: barra de progreso `Fase 0: sección 2/5…` durante map-reduce.

**Rationale**: Clarificación Q3; evita truncado en textos filosóficos largos.

**Alternatives considered**:

| Opción | Descartada porque |
|--------|-------------------|
| Solo primeras 15k palabras | Mapa argumental incompleto |
| Siempre map-reduce | Overhead innecesario en ensayos cortos |

## R6 — Fase 0 sin red / sin API key

**Decision**: Bloquear inicio de sesión Slow nueva si falta key del modelo elegido (igual que RSVP). Si la llamada Fase 0 falla por red:
- Mostrar error con reintentar.
- Ofrecer **Continuar sin orientación** (entra Fase 1 sin `phase0`; mapa rellenable manual disponible).
- No generar Fase 0 sintética local.

**Rationale**: Resuelve edge case diferido en clarify; mantiene scaffold IA sin bloquear lectura tras fallo transitorio.

## R7 — IA Fase 1 anti-spoiler

**Decision**: Contexto IA = `normalizedText.slice(scope.charStart, maxReadCharEnd)` donde `maxReadCharEnd` es el mayor `charEnd` de páginas visitadas (incluye página actual). Prompt exige no revelar contenido posterior. Respuestas ≤3 oraciones; overlay dismissable.

**Rationale**: FR-006, SC-003; implementable sin embeddings.

## R8 — Anotaciones y menú por modo

**Decision**: Registro central `ANNOTATION_TYPES` con `tier: 'primary'|'critical'|'secondary'` y `visibleIn: { normal, critical }`. Menú micro de selección filtra por `state.slow.criticalMode`. Persistencia: array en `slow.annotations[]`.

**Rationale**: FR-004, FR-013, FR-016; un solo mapa de tipos extensible.

## R9 — Fase 2 checkpoints

**Decision**: Al renderizar última página de una sección, timer 10s → chip fijo inferior dismissable (swipe o ×). Pregunta de integración desde `phase0.argumentMap` vía llamada IA ligera o plantilla local. Respuesta → anotación `→`.

**Rationale**: D2 Opción B del diseño; P2 no bloquea lectura.

## R10 — Fase 3, grafo y gamificación

**Decision**:
- **Módulo A**: diff estructural `phase0` vs anotaciones por proximidad de offset (tolerancia ±200 chars) y tipo.
- **Módulo B**: preguntas retrieval generadas por IA desde texto de anotaciones (tabla del diseño).
- **Módulo C**: nodos `[Pedro:]` + edges `cuestiona`/`refuta` en estructura existente de conceptos.
- **Depth score**: tabla de puntos del diseño; penalizaciones solo en Fase 3.
- **Hallazgos**: match concepto Fase 0 ↔ anotación cerca de offset esperado; silencioso salvo mapa rellenable.

**Rationale**: Spec completa (Opción C); reutiliza `dictionary.js` y export.

## R11 — Estructura de módulos nuevos

**Decision**: Nuevos archivos bajo `src/js/slow/` y `src/css/slow-mode.css`; pantallas nuevas en `index.html` (`screenSlowScope`, `screenSlowPhase0`, `screenSlowReader`, `screenSlowPhase3`). `study.js` enruta por `studyMode`.

**Rationale**: Evita que `study.js` (>3k líneas) crezca sin límite; contratos por submódulo.

## R12 — Testing

**Decision**: Tests en `cursor-tests/20260528_t*.mjs` para: pagination breakpoints, offset anchoring, phase0 threshold split, sessionsByMode migration, anti-spoiler slice. Manual via `quickstart.md`.

**Rationale**: Alineado con convención del repo; sin framework nuevo.

---

## Wave 2 — Gaps `slow_mode_spec.md`

### R13 — Sidebar reader (iAnnotate / Perlego)

**Decision**: Activar `#slowReaderSidebar` (20% derecho, colapsable con tab). Tres secciones: **Mis anotaciones** (agrupadas por tipo con contador), **Diccionario** (`getSortedSessionConcepts()` + conceptos Fase 0), **Preguntar a IA** (textarea + historial de la sesión slow).

**Rationale**: Spec §5 layout; hoy sidebar existe en HTML pero `hidden` y vacía.

### R14 — Tap-to-source

**Decision**: Click en ítem sidebar o marca margen → `charOffsetToPage` + `goToReaderPage` + highlight temporal del rango (`charStart`/`charEnd`). Margen: posición Y derivada del offset dentro de la página (medir con Range en texto renderizado).

**Alternatives**: Solo sidebar tap (sin Y en margen) — descartado; spec exige anclaje espacial.

### R15 — Fase 0 editable y re-lectura

**Decision**:
- Campos editables: prequestions[], argumentMap edit, conceptos extra del diccionario.
- `fillableMapMode`: toggle en scope screen; `fillableBlanks` rellenables durante Fase 1 con ref página.
- Re-lectura: flag `phase0Seen` por `(materialHash, scope)` → Fase 0 colapsada; primera lectura sin botón skip (solo colapsar).

### R16 — Phase 3 correspondencia real

**Decision**: `comparePhase0ToAnnotations()` usa offsets reales de anotaciones + proximidad ±200 chars; muestra página derivada, snippet usuario, conceptos 3/5, weak points 2/3. Módulos A/B/C **elegibles** con picker UI.

### R17 — Grafo enriquecido

**Decision**: Pantalla `screenSlowGraph` o overlay; nodos `[Texto]` desde `session_concepts` + `[Pedro:]` desde anotaciones; edges desde `graphLinks` y críticas (`cuestiona`/`refuta`). Sin canvas LiquidText en v2 — lista/árbol navegable + export; canvas opcional backlog.

### R18 — Steel-man pedagogy

**Decision**: Soft gate (no bloqueo duro): al confirmar `⊘`/`↯`/`⚠` sin anotación `⇑` o `≈` previa en ±500 chars, modal educativo con opción "Continuar igual" / "Pedir steel man". Depth score: multiplicador ×1.25 tipos críticos si `criticalMode`.

### R19 — Checkpoint IA

**Decision**: `generateCheckpointQuestion(section, phase0.argumentMap, iaContext)` — una pregunta integración; evaluación profundidad opcional en Fase 3 (no bloquea lectura).

### R20 — Triage §13

**Decision**: Panel expandible bajo selector de modo con matriz resumida (3 filas) + heurística "¿POR QUÉ o QUÉ?" — copy estático, sin IA.

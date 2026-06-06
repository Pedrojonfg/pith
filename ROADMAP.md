# ROADMAP — Slow Mode (Lectura Profunda)

**Spec**: `specs/20260528-slow-mode/spec.md`  
**Plan**: `specs/20260528-slow-mode/plan.md`  
**Branch**: `20260528-slow-mode`

## Tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | `sessionsByMode` + migración `active_session` | — | S | [ ] |
| T02 | Selector modo sin preselección + continuar/nueva | T01 | M | [ ] |
| T03 | Screens Slow + routing `studyMode` | T02 | M | [ ] |
| T04 | Parser headings + scope picker | T03 | M | [ ] |
| T05 | Paginación viewport + tests | T04 | L | [ ] |
| T06 | Fase 0 IA single + map-reduce 60k | T04 | L | [ ] |
| T07 | Reader UI + tipografía + focus mode | T05, T06 | L | [ ] |
| T08 | Anotaciones por offset de caracteres | T07 | M | [ ] |
| T09 | IA Fase 1 anti-spoiler | T08 | M | [ ] |
| T10 | Modo Crítico + menú tipos | T08 | S | [ ] |
| T11 | Checkpoints Fase 2 | T08, T06 | M | [ ] |
| T12 | Fase 3 consolidación (A/B/C) | T08, T06 | L | [ ] |
| T13 | Grafo + gamificación + flashcards | T12 | L | [ ] |
| T14 | Export sesión Slow | T12 | M | [ ] |
| T15 | QA quickstart + cursor-tests | T09–T14 | M | [ ] |

## Grafo de dependencias

```text
T01 → T02 → T03 → T04 ─┬→ T05 → T07 → T08 ─┬→ T09 ──────────────┐
                        │                     ├→ T10 ─────────────┤
                        └→ T06 ───────────────┘   T11 ────────────┤
                                        T08 + T06 → T12 ─┬→ T13 ─┴→ T15
                                                         └→ T14 ────↗
```

**Paralelo 1** (tras T04): `T05` y `T06` en dos chats.  
**Paralelo 2** (tras T08): `T09`, `T10`, `T11` en tres chats.  
**Paralelo 3** (tras T12): `T13` y `T14` en dos chats.

## Orden de ejecución recomendado

1. `T01` → `T02` → `T03` → `T04` (secuencial, un chat o encadenado).
2. Lanzar **`T05` y `T06` en paralelo**; esperar ambos antes de `T07`.
3. `T07` → `T08` (secuencial).
4. Lanzar **`T09`, `T10`, `T11` en paralelo**; esperar los tres antes de `T12`.
5. `T12` → luego **`T13` y `T14` en paralelo** → `T15`.

---

## PROMPT T01 — sessionsByMode + migración

Implementa persistencia dual por modo de estudio según el contrato de sesiones.

**Contexto**
- Spec: `specs/20260528-slow-mode/spec.md` (FR-011, FR-011a, FR-011b)
- Contrato: `specs/20260528-slow-mode/contracts/mode-selector-sessions.md`
- Data model: `specs/20260528-slow-mode/data-model.md`

**Archivos**
- `src/js/config.js` — añadir `LS_SESSIONS_BY_MODE_KEY = "sessions_by_mode"`
- `src/js/session.js` — `loadSessionsByMode()`, `storeSessionForMode(mode, session)`, `migrateLegacyActiveSession()`, actualizar `storeActiveSession`/`loadActiveSession` para delegar al slot activo

**Tareas**
1. Implementar shape `{ rsvp: ActiveSession|null, slow: ActiveSession|null }`.
2. Migración en bootstrap: si existe `active_session` y no `sessions_by_mode`, copiar a `.rsvp`.
3. `storeActiveSession` escribe en slot según `session.studyMode` (default `rsvp` si ausente).
4. Mantener compatibilidad: RSVP existente sigue cargando tras migración.

**Criterio de éxito**
- Tras migración, sesión RSVP previa sigue cargando; guardar slow no toca slot rsvp.

criterio de éxito: Migración transparente y API `sessionsByMode` funcional. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T02 — Selector de modo + continuar/nueva

Añade UI de selección de modo en pantalla de inicio sin preselección y flujo resume.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/mode-selector-sessions.md`
- Depende de T01 (`sessionsByMode`)

**Archivos**
- `index.html` — `screenPlaceholder`: radio/tabs RSVP vs Slow, panel continuar/nueva, toggle Modo Crítico (visible solo en Slow)
- `src/css/main.css` — estilos selector
- `src/js/study.js` — handlers elección modo, ocultar blocks UI en Slow
- `src/js/main.js` — bootstrap no auto-entra a sesión sin elegir modo

**Tareas**
1. Ningún modo preseleccionado al abrir create screen.
2. Tras elegir modo: si slot existe → Continuar / Nueva sesión.
3. Nueva sesión pide confirmación si había slot.
4. RSVP controls hidden cuando slow seleccionado.

**Criterio de éxito**
- SC-001 manual: selector sin default; continuar restaura slot correcto por modo.

criterio de éxito: Flujo modo + resume operativo en UI. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T03 — Screens Slow + routing studyMode

Crea esqueleto de pantallas Slow y enrutamiento por `studyMode`.

**Contexto**
- Plan: `specs/20260528-slow-mode/plan.md` (estructura `src/js/slow/`)
- Data model: fases `scope | phase0 | phase1 | phase3`

**Archivos**
- `index.html` — `screenSlowScope`, `screenSlowPhase0`, `screenSlowReader`, `screenSlowPhase3` (estructura mínima)
- `src/css/slow-mode.css` (nuevo, link en index.html)
- `src/js/slow/reader.js` (stub exports)
- `src/js/study.js` — tras upload Slow: `normalize → scope screen` en lugar de generate blocks
- `src/js/ui.js` — registrar screens en `showScreen`

**Tareas**
1. `state.studyMode = 'slow'` al confirmar modo Slow.
2. Crear `ActiveSession` slow con `slow: { phase: 'scope', ... }` al subir archivo.
3. Navegación placeholder entre screens según `slow.phase`.

**Criterio de éxito**
- Upload en Slow llega a scope screen sin llamar generación de bloques.

criterio de éxito: Routing Slow separado de RSVP sin regresión. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T04 — Headings + scope picker

Implementa detección de headings y UI de selección de scope.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase0-orientation-ia.md`
- FR-005, FR-005c

**Archivos**
- `src/js/slow/headings.js` (nuevo)
- `src/js/study.js` o `src/js/slow/reader.js` — wire scope screen
- `index.html` — lista de scopes en `screenSlowScope`

**Tareas**
1. `parseHeadings(normalizedText, format)` → `{ kind, charStart, charEnd, label }[]`.
2. UI: documento completo + chapters/sections; mostrar char count; aviso si ≥60000.
3. Guardar `readingScope` en `slow` al confirmar.

**Criterio de éxito**
- Ensayo con `##` produce lista de secciones con offsets correctos.

criterio de éxito: Scope picker con offsets válidos. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T05 — Paginación viewport + tests

Motor de paginación por viewport con cache y tests unitarios.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/slow-pagination-viewport.md`
- Research R2

**Archivos**
- `src/js/slow/pagination.js` (nuevo)
- `cursor-tests/20260528_t05-pagination.mjs` (nuevo)

**Tareas**
1. `computePageBreakpoints(scopeText, containerEl, typography)` vía medida DOM/binary search.
2. `getPageSlice`, `charOffsetToPage`, cache por tipografía.
3. Tests: texto corto → N páginas; cambio fontSize altera count pero preserva charStart de página actual.

**Criterio de éxito**
- Tests pasan; API exportada lista para T07.

criterio de éxito: Paginación viewport testeada. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T06 — Fase 0 IA (single + map-reduce)

Generación de orientación previa con estrategia híbrida por tamaño de scope.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase0-orientation-ia.md`
- Research R5, R6
- Prompts referencia: `slow_mode_spec.md` sección 10

**Archivos**
- `src/js/slow/phase0.js` (nuevo)
- `src/js/api.js` o `llm.js` — funciones chat JSON para phase0
- `index.html` + `study.js` — wire `screenSlowPhase0`, progreso map-reduce

**Tareas**
1. `generatePhase0Single(scopeText, { criticalMode })` si len &lt; 60000.
2. `mapReducePhase0(scopeText, boundaries)` si len ≥ 60000.
3. UI bloques: tesis, mapa, conceptos, pregunta guía (+ críticos si aplica).
4. Error red: Reintentar + Continuar sin orientación (`phase0Status: 'skipped'`).

**Criterio de éxito**
- Ensayo corto genera Fase 0 en una llamada; texto largo muestra progreso por sección.

criterio de éxito: Fase 0 híbrida funcional con fallback skip. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T07 — Reader UI + tipografía + focus

Pantalla de lectura paginada Fase 1 con layout del diseño.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase1-reader-ia.md` (layout)
- Depende T05 (pagination) y T06 (phase0 → phase1 transition)

**Archivos**
- `src/js/slow/reader.js`
- `src/css/slow-mode.css`
- `index.html` — `screenSlowReader` completo

**Tareas**
1. Render página actual desde breakpoints; prev/next + swipe.
2. Barra progreso discreta; controles tipografía (persistir en `slow.typography`).
3. Focus mode toggle: oculta sidebar y chrome.
4. Actualizar `maxReadCharEnd` al cambiar de página.

**Criterio de éxito**
- Lectura 3+ páginas fluida; focus mode deja solo texto + progreso.

criterio de éxito: Reader paginado usable. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T08 — Anotaciones por offset

Sistema de anotaciones con menú de tipos y marcas en margen.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/annotation-char-offsets.md`

**Archivos**
- `src/js/slow/annotations.js` (nuevo)
- `src/js/slow/reader.js` — integrar selección texto + margen
- `src/css/slow-mode.css` — marcas por tipo

**Tareas**
1. `ANNOTATION_TYPES` registry con tier y visibilidad.
2. Selection → `charStart`/`charEnd` en coords scope.
3. CRUD anotaciones en `slow.annotations[]`; persistir vía `storeActiveSession`.
4. Render marcas en margen al pintar página.

**Criterio de éxito**
- Crear anotación `≈` en pág 2, navegar away y back: marca persiste.

criterio de éxito: Anotaciones ancladas por carácter. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T09 — IA Fase 1 anti-spoiler

Sidebar "Preguntar a IA" con contexto limitado a texto leído.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase1-reader-ia.md`
- Research R7

**Archivos**
- `src/js/slow/ai-context.js` (nuevo)
- `src/js/slow/reader.js` — sidebar IA + overlay respuesta
- Reutilizar patrones de `guide-chat.js` donde aplique

**Tareas**
1. `buildIAContext(slow)` = scopeText.slice(0, maxReadCharEnd).
2. Prompt anti-spoiler; respuesta ≤3 oraciones; overlay dismissable.
3. Wire `⚑` y `⇑` a prompts específicos.

**Criterio de éxito**
- Pregunta sobre final del texto antes de leerlo → IA no revela (SC-003).

criterio de éxito: IA on-demand sin spoilers. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T10 — Modo Crítico + menú tipos

Toggle lectura crítica y menú de anotación extendido.

**Contexto**
- FR-016; contrato `annotation-char-offsets.md`

**Archivos**
- `index.html` — toggle en scope o pre-phase0
- `src/js/slow/annotations.js` — filtrar menú por `criticalMode`

**Tareas**
1. `slow.criticalMode` persistido; tipos críticos en menú primario si true.
2. Fase 0 pide `criticalExaminePoints` cuando activo.

**Criterio de éxito**
- Con crítico ON, menú muestra `⊘ ↯ ⚠ ★ ⇑` sin abrir `···`.

criterio de éxito: Modo Crítico afecta menú y Fase 0. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T11 — Checkpoints Fase 2

Chips de checkpoint dismissable al fin de sección.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase2-checkpoints.md`

**Archivos**
- `src/js/slow/checkpoints.js` (nuevo)
- `src/js/slow/reader.js` — timer 10s + chip UI

**Tareas**
1. Detectar última página de `SectionBoundary`.
2. Timer 10s → mostrar chip; dismiss → `checkpointsDismissed`.
3. Respuesta → anotación `→`.

**Criterio de éxito**
- SC-005: dismiss no bloquea; responder crea anotación.

criterio de éxito: Checkpoints opcionales operativos. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T12 — Fase 3 consolidación

Módulos A/B/C post-lectura.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase3-consolidation.md`

**Archivos**
- `src/js/slow/phase3.js` (nuevo)
- `index.html` — `screenSlowPhase3`

**Tareas**
1. Módulo A: diff phase0 vs anotaciones (offset ±200).
2. Módulo B: preguntas retrieval por tipo de anotación (IA).
3. Módulo C: integración nodos `[Pedro:]` al grafo/diccionario.
4. Botón "Lectura completa" en reader → phase3.

**Criterio de éxito**
- Flujo completo Fase 0→1→3 en ensayo corto de prueba.

criterio de éxito: Fase 3 tres módulos navegables. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T13 — Grafo + gamificación + flashcards

Depth score, hallazgos, vista grafo enriquecida, flashcards.

**Contexto**
- Contrato: `specs/20260528-slow-mode/contracts/phase3-consolidation.md`
- `slow_mode_spec.md` secciones 11 y 8

**Archivos**
- `src/js/slow/gamification.js` (nuevo)
- `src/js/dictionary.js` — nodos usuario
- Integración flashcards existente (grep `flashcard` / review)

**Tareas**
1. Depth score tabla diseño; solo en Fase 3.
2. Hallazgos silenciosos vs visibles (mapa rellenable).
3. `graphEnrichedUnlocked` tras completar Fase 3.
4. Convertir anotaciones a flashcards.

**Criterio de éxito**
- SC-006, SC-007, SC-008 verificables manualmente.

criterio de éxito: Gamificación y flashcards integrados. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T14 — Export sesión Slow

Extender export Markdown con contenido Slow.

**Archivos**
- `src/js/export.js`

**Tareas**
1. Si `studyMode === 'slow'`, export incluye scope, phase0, anotaciones tipadas, depth score.
2. No romper export RSVP.

**Criterio de éxito**
- Export mid-session Slow produce `.md` legible con anotaciones.

criterio de éxito: Export Slow sin regresión RSVP. Ejecuta /validate antes de cerrar este mensaje

---

## PROMPT T15 — QA quickstart + cursor-tests

Cierra QA del feature completo.

**Contexto**
- `specs/20260528-slow-mode/quickstart.md`

**Archivos**
- `cursor-tests/20260528_t15-sessions-migration.mjs` (nuevo, si no cubierto en T01)
- Verificar tests T05; añadir test anti-spoiler slice si falta

**Tareas**
1. Ejecutar checklist quickstart (10 escenarios).
2. Añadir tests faltantes para migración y `maxReadCharEnd`.
3. Documentar resultados en comentario de commit o nota breve.

**Criterio de éxito**
- Quickstart 1–9 pasan; RSVP regresión OK; tests cursor verdes.

criterio de éxito: Feature Slow Mode verificado end-to-end. Ejecuta /validate antes de cerrar este mensaje

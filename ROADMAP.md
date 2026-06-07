# ROADMAP — Cloze Detection (20260529-cloze-mode)

> **Feature**: Tercer modo de estudio — pipeline NODE/EDGE + sesión MC mínima  
> **Spec**: `specs/20260529-cloze-mode/spec.md`  
> **Plan**: `specs/20260529-cloze-mode/plan.md`  
> **Branch**: `20260529-cloze-mode`

---

## Tabla de tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | Extender `sessionsByMode` con slot `cloze` + `normalizeStudyMode` | — | S | [x] |
| T02 | Selector UI: tercer modo Cloze Detection + hints | T01 | S | [x] |
| T03 | Routing `study.js`: create/resume/nueva sesión cloze | T02 | M | [x] |
| T04 | `createClozeSession` + upload/normalización sin IA auto | T03 | M | [x] |
| T05 | `buildClozeEpistemicGraph` + `buildSessionGraph` modo `cloze` | T01 | M | [x] |
| T06 | `cloze/pipeline.js` — Fase 0 grafo epistémico | T04 | L | [x] |
| T07 | Pipeline Fases 1–2: análisis semántico + ítems base | T06 | L | [x] |
| T08 | Pipeline Fases 3–4: distractores L1+L3 + QA | T07 | L | [x] |
| T09 | UI botón "Generar ítems" + progreso fases 0–4 | T08 | M | [x] |
| T10 | Sesión MC mínima (`cloze/study.js`) | T09 | L | [x] |
| T11 | Botón Ver grafo + `cloze-mode.css` | T05, T09 | S | [x] |
| T12 | cursor-tests + validación quickstart | T10, T11 | M | [x] |

---

## Grafo de dependencias

```text
T01 ─┬→ T02 → T03 → T04 → T06 → T07 → T08 → T09 ─┬→ T10 → T12
     │                                              └→ T11 ↗
     └→ T05 ────────────────────────────────────────────────┘
```

**Paralelizable**:
- Tras **T01**: lanzar **T02** y **T05** en paralelo.
- Tras **T09**: lanzar **T10** y **T11** en paralelo.

---

## Orden de ejecución recomendado

### Oleada 1 (paralelo)
- **T01** (obligatorio primero)
- Luego en paralelo: **T02**, **T05**

### Oleada 2 (secuencial)
- **T03** → **T04** → **T06** → **T07** → **T08** → **T09**

### Oleada 3 (paralelo)
- **T10** y **T11** en paralelo

### Oleada 4
- **T12** (cuando T10 y T11 estén hechos)

**Esperar antes de continuar**:
- Antes de T06: upload cloze guarda sesión con `pipelineStatus: 'normalized'`.
- Antes de T10: pipeline llega a `ready` con ítems `valid`.
- Antes de T12: los 3 cursor-tests pasan.

---

## Prompts listos para usar

---

**PROMPT T01 — sessionsByMode.cloze**

Implementa la persistencia del slot `cloze` en MyLearning (feature `20260529-cloze-mode`).

**Contexto**: Tercer modo Cloze Detection. Spec: `specs/20260529-cloze-mode/spec.md`. Contrato: `specs/20260529-cloze-mode/contracts/mode-selector-cloze.md`. Data model: `specs/20260529-cloze-mode/data-model.md`.

**Archivos a tocar**:
- `src/js/session.js` — `normalizeStudyMode`, `emptySessionsByMode`, `parseSessionsByModeRaw`, `storeSessionsByMode`
- `src/js/study.js` — `getStudyModeLabel` si aplica
- `cursor-tests/20260529_t01-cloze-sessions.mjs` (crear)

**Requisitos**:
1. `normalizeStudyMode('cloze')` → `'cloze'` (mantener `rsvp`/`slow` intactos).
2. `emptySessionsByMode()` → `{ rsvp: null, slow: null, cloze: null }`.
3. Parse/store incluyen `cloze`; migración idempotente si `cloze` ausente.
4. `loadSessionForMode('cloze')` / `storeSessionForMode('cloze', …)` funcionan.
5. Test: round-trip localStorage con los tres slots.

**No tocar**: pipeline IA, UI selector (T02).

criterio de éxito: `node cursor-tests/20260529_t01-cloze-sessions.mjs` pasa; RSVP/Slow slots sin regresión. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T02 — Selector 3 modos UI**

Añade Cloze Detection al selector de modos en la pantalla de creación.

**Contexto**: ROADMAP.md T02. Depende de T01. Contrato: `specs/20260529-cloze-mode/contracts/mode-selector-cloze.md`.

**Archivos a tocar**:
- `index.html` — radio `studyMode` value `cloze`, hint descriptivo
- `src/css/main.css` — ajustes layout 3 opciones si necesario
- `src/js/study.js` — `getStudyModeLabel`, `resetModeSelectUi`, hints

**Requisitos**:
1. Tres modos visibles sin preselección: RSVP, Slow Mode, Cloze Detection.
2. Hint Cloze: recuperación activa con ítems cloze sobre el material.
3. Al elegir cloze, ocultar controles RSVP (bloques) y Slow (critical mode, scope).
4. Sin regresión en selección RSVP/Slow.

criterio de éxito: manual — abrir create screen, ver 3 modos, elegir cada uno y verificar visibilidad de controles. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T03 — Routing study.js cloze**

Conecta el flujo create/resume/nueva sesión para modo `cloze`.

**Contexto**: ROADMAP.md T03. Depende de T01+T02. Spec FR-001, FR-009.

**Archivos a tocar**:
- `src/js/study.js` — `enterCreateScreenForMode`, `wireStudyModeSelector`, `continueSessionBtn`, `newSessionModeBtn`, `updateCreateScreenModeVisibility`, `resumeClozeSession` (nuevo)
- `src/js/main.js` — bootstrap si aplica

**Requisitos**:
1. Elegir cloze + slot existente → panel Continuar / Nueva sesión.
2. Continuar carga `sessions_by_mode.cloze` en `state.activeSession`.
3. Nueva sesión reemplaza solo slot `cloze` (confirmación si había sesión).
4. `state.studyMode = 'cloze'` coherente en todo el flujo.
5. No implementar aún pipeline ni estudio MC (T04+).

criterio de éxito: continuar/nueva sesión cloze sin cruzar datos con rsvp/slow. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T04 — createClozeSession + upload**

Crea la sesión cloze y conecta upload/normalización sin IA automática.

**Contexto**: ROADMAP.md T04. Contratos: `cloze-pipeline.md` (trigger). Data model: `ClozeSessionData`.

**Archivos a tocar**:
- `src/js/study.js` — `createClozeSession` (export), handler upload para modo cloze
- Reutilizar `input-normalization.js` (import dinámico como Slow)

**Requisitos**:
1. `createClozeSession({ normalizedText, normalizedFormat, fileName, … })` → `{ studyMode: 'cloze', cloze: { normalizedText, pipelineStatus: 'normalized', … } }`.
2. Upload igual que otros modos; **cero** llamadas LLM post-upload.
3. Tras upload: mostrar botón "Generar ítems" (disabled hasta T09 si hace falta placeholder).
4. `storeActiveSession` persiste en slot cloze.

criterio de éxito: subir .md en modo cloze crea sesión `pipelineStatus: 'normalized'` sin spinner IA. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T05 — buildClozeEpistemicGraph**

Extiende el graph builder modo-agnóstico para grafo epistémico cloze.

**Contexto**: ROADMAP.md T05. Contrato: `specs/20260529-cloze-mode/contracts/cloze-graph-view.md`. Referencia: `src/js/graph/build.js`.

**Archivos a tocar**:
- `src/js/graph/build.js` — `buildClozeEpistemicGraph`, rama `mode === 'cloze'` en `buildSessionGraph`

**Requisitos**:
1. `buildClozeEpistemicGraph(session)` lee `session.cloze.epistemicGraph`.
2. Mapea nodos/aristas a formato canvas existente (`nodes`, `edges`, `kind: 'cloze'`).
3. `buildSessionGraph(session, { mode: 'cloze' })` devuelve grafo visualizable.
4. No leer grafos RSVP/Slow.
5. Grafo vacío si `epistemicGraph` null.

criterio de éxito: unit test manual con grafo mock en cursor-test o console; `mountMaterialGraphScreen` acepta output. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T06 — Pipeline Fase 0**

Implementa generación de grafo epistémico (Fase 0) en `cloze/pipeline.js`.

**Contexto**: ROADMAP.md T06. Diseño: `cloze_mode_spec.md` § Fase 0. Research R4.

**Archivos a tocar**:
- `src/js/cloze/pipeline.js` (crear) — `generateEpistemicGraph(text, { llmModel })`
- `src/js/cloze/normalize.js` (crear) — validación shape mínimo
- `src/js/llm.js` — usar APIs existentes

**Requisitos**:
1. Una llamada IA → JSON `{ nodes[], edges[] }` con campos del data-model.
2. Nodos `importance` 1–5; edges con `sentence_context`.
3. Función pura testeable; sin DOM.
4. Export para uso desde `study.js` en T09.

criterio de éxito: función retorna grafo válido con texto mock o stub LLM en test. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T07 — Pipeline Fases 1–2**

Análisis semántico + generación ítems base NODE/EDGE.

**Contexto**: ROADMAP.md T07. `cloze_mode_spec.md` § Fases 1–2.

**Archivos a tocar**:
- `src/js/cloze/pipeline.js` — `analyzeSemanticCandidates`, `generateBaseItems`
- `src/js/cloze/normalize.js` — validación candidatos e ítems base

**Requisitos**:
1. Fase 1: `node_candidates` (importance ≥ 3) + `edge_candidates` con `aptitude_score`.
2. Fase 2: ítems NODE (DEF/APP/COND/CONTRAST) y EDGE (SOURCE/TARGET/RELATION) con `sentence_with_blank`, offsets.
3. Texto ≤15k pasa completo; sin distractores aún.
4. Tipos `item_type` según taxonomía spec.

criterio de éxito: pipeline fases 0→2 encadenables con grafo+texto de prueba. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T08 — Pipeline Fases 3–4**

Distractores L1+L3 y QA con dificultad.

**Contexto**: ROADMAP.md T08. Clarify: solo L1+L3, sin vault L2.

**Archivos a tocar**:
- `src/js/cloze/pipeline.js` — `generateDistractors`, `qaAndCalibrate`
- `src/js/cloze/normalize.js` — `ClozeOption`, filtro `qa_status`

**Requisitos**:
1. Fase 3: 3 distractores + respuesta correcta = 4 opciones; pool L1 del grafo; fallback L3.
2. Gradiente plausibility high/medium/low.
3. Fase 4: asignar `difficulty`, `qa_status` (valid/weak/rejected).
4. Export `getValidItems(items)` → solo `valid`.
5. Target balance EASY 30% / MEDIUM 50% / HARD 20% documentado en comentario.

criterio de éxito: `cursor-tests/20260529_t03-cloze-valid-items.mjs` pasa con fixtures. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T09 — UI Generar ítems**

Botón y progreso del pipeline; wire en study.js.

**Contexto**: ROADMAP.md T09. Contrato: `cloze-pipeline.md`.

**Archivos a tocar**:
- `index.html` — `#clozeGenerateBtn`, `#clozePipelineProgress`
- `src/js/study.js` — handler async fases 0–4, actualizar `pipelineStatus`, persist
- `src/css/cloze-mode.css` (crear mínimo)

**Requisitos**:
1. Botón visible cuando `pipelineStatus === 'normalized'` o `failed`.
2. Progreso: "Fase N/5: …" durante generación.
3. Al `ready`: mostrar resumen (N ítems valid) + botón Estudiar.
4. Error: mensaje + Reintentar desde fase fallida.
5. Continuar sesión con grafo+items ready omite regeneración.

criterio de éxito: flujo manual upload → Generar → ready con API key real. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T10 — Sesión MC cloze**

Pantalla de estudio multiple-choice reutilizando patrones review.

**Contexto**: ROADMAP.md T10. Contrato: `cloze-study-session.md`.

**Archivos a tocar**:
- `src/js/cloze/study.js` (crear)
- `index.html` — `#screenClozeStudy`
- `src/js/study.js` — navegación a estudio
- Reutilizar: `shuffle-options.js`, `markdown.js`, patrones de `review.js`

**Requisitos**:
1. Cola solo ítems `qa_status === 'valid'`.
2. Oración con hueco + 4 opciones barajadas.
3. Feedback inmediato; avanzar `studyIndex`; persistir stats.
4. Reanudar restaura índice y orden (`studyOrder`).
5. Sin SR. Sin romper review RSVP.

criterio de éxito: completar ≥10 ítems; recargar y continuar mismo índice. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T11 — Ver grafo + CSS**

Botón ver grafo y estilos mínimos del modo.

**Contexto**: ROADMAP.md T11. Contrato: `cloze-graph-view.md`. Depende T05+T09.

**Archivos a tocar**:
- `index.html` — botón Ver grafo, contenedor grafo en flujo cloze
- `src/js/study.js` — `mountMaterialGraphScreen(session, el, { mode: 'cloze' })`
- `src/css/cloze-mode.css` — progreso, estudio, grafo
- `sw.js` — cache bust nuevos assets si aplica

**Requisitos**:
1. Botón visible cuando `epistemicGraph` existe.
2. Reutilizar `mountMaterialGraphScreen` — no nuevo canvas.
3. Estilos coherentes con app existente.

criterio de éxito: tras generar, Ver grafo muestra nodos del material. Ejecuta /validate antes de cerrar este mensaje.

---

**PROMPT T12 — Tests + quickstart QA**

Cierra QA del feature con cursor-tests y quickstart.

**Contexto**: ROADMAP.md T12. `specs/20260529-cloze-mode/quickstart.md`.

**Archivos a tocar**:
- `cursor-tests/20260529_t01-cloze-sessions.mjs` (si incompleto)
- `cursor-tests/20260529_t02-cloze-pipeline-status.mjs` (crear)
- `cursor-tests/20260529_t03-cloze-valid-items.mjs` (crear)

**Requisitos**:
1. Tests cubren: slot cloze, transiciones pipelineStatus, filtro valid items.
2. Ejecutar quickstart §1–8 manualmente documentando resultados.
3. Verificar regresión RSVP/Slow §8.

criterio de éxito: los 3 cursor-tests pasan; quickstart §1–7 verificados. Ejecuta /validate antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanzar primero**: PROMPT **T01** (solo).
2. **En paralelo**: PROMPT **T02** + **T05** (cuando T01 esté hecho).
3. **Secuencial**: T03 → T04 → T06 → T07 → T08 → T09.
4. **En paralelo**: T10 + T11 (cuando T09 esté hecho).
5. **Cerrar**: T12.

**Tiempo estimado**: T06–T08 son el cuello de botella (prompts IA + validación JSON).

**Siguiente comando Spec Kit**: `/speckit-tasks` para generar `tasks.md` formal (opcional; este ROADMAP ya es ejecutable).

# ROADMAP — Assessment-Informed Block Content

**Spec**: `specs/20260523-assessment-informed-blocks/spec.md`  
**Plan**: `specs/20260523-assessment-informed-blocks/plan.md`  
**Branch**: `20260523-assessment-informed-blocks`

## Tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | Modelo de datos: `_meta.assessment.gaps_*`, `_config.explanation_profile`, `_config.gap_focus` | — | S | [ ] |
| T02 | API `synthesizeAssessmentGaps` + timeout 30s + contrato JSON | T01 | M | [x] |
| T03 | `resolveBlockQuestionConfig` + `applyAssessmentResults` con perfiles y budget gaps | T01 | M | [ ] |
| T04 | Prompts `deepSeekGenerateBlockJson` (thorough / brief_deep / gap_focus) | T01 | M | [x] |
| T05 | UI resultados assessment: C en paralelo + editor D opcional + accept merge | T02, T03 | L | [ ] |
| T06 | Prefetch `configKey` y generación de bloques con perfil | T03, T04 | M | [x] |
| T07 | Export `.md` con lagunas y perfiles | T03 | S | [x] |
| T08 | Regresión manual según `quickstart.md` | T05, T06, T07 | S | [x] |

## Grafo de dependencias

```text
T01 → T02 → T05 → T08
T01 → T03 → T05
T01 → T04 → T06 → T08
T03 → T06
T03 → T07 → T08
```

**Paralelo posible** (tras T01):

- **Hilo A**: T02 → T05  
- **Hilo B**: T03 + T04 en paralelo → T06  

T07 puede hacerse en paralelo con T06 tras T03.

## Orden de ejecución recomendado

1. **T01** (fundación schema)  
2. En paralelo: **T02** + **T03** + **T04**  
3. **T05** (UI — bloqueante para prueba E2E)  
4. En paralelo: **T06** + **T07**  
5. **T08** (validación)

---

## PROMPT T01 — Schema y tipos en sesión

Implementa el modelo de datos del feature **Assessment-Informed Block Content**.

**Contexto**: Lee `specs/20260523-assessment-informed-blocks/data-model.md` y `contracts/`. El proyecto es una app vanilla JS en `src/js/session.js` con `applyAssessmentResults`, `resolveBlockQuestionConfig`, `storeActiveSession`.

**Archivos a tocar**:
- `src/js/session.js` (principal)
- Comentario breve en `specs/20260523-assessment-informed-blocks/data-model.md` solo si ajustas nombres de campos

**Tareas**:
1. Extender `resolveBlockQuestionConfig(blockIndex)` para devolver `{ n_test, n_socratic, explanation_profile, gap_focus }` con defaults seguros.
2. Preparar `applyAssessmentResults` para aceptar `gapsByBlock` y escribir `_meta.assessment.gaps_by_block`, `gaps_source`, `synthesis_status`.
3. Sin cambiar aún UI ni API DeepSeek.

**Criterio de éxito**: Con sesión mock en localStorage, `resolveBlockQuestionConfig(0)` devuelve los cuatro campos; `applyAssessmentResults` persiste gaps y perfiles strong→`brief_deep`, weak→`thorough`.

**ROADMAP**: `ROADMAP.md` T01. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Gap synthesis API (paso C)

Añade la llamada DeepSeek de síntesis de lagunas según `specs/20260523-assessment-informed-blocks/contracts/gap-synthesis.md`.

**Contexto**: Existe `generateAssessmentSynthesis` (texto coach, 3 frases) — **no reutilizar** para gaps; crear función nueva.

**Archivos**:
- `src/js/api.js`

**Tareas**:
1. `export async function synthesizeAssessmentGaps({ assessmentResults, questions, responses, blockIndex, language, signal })`.
2. `response_format: json_object`, `max_tokens: 1024`, prompt según contrato.
3. Exportar helper `mergeGapLists(synthesis, userEdits)` si encaja en `api.js` o `session.js`.

**Criterio de éxito**: Llamada manual desde consola con respuestas mock devuelve `gaps_by_block` parseable; timeout/abort devuelve error controlado.

**ROADMAP**: T02. Ejecuta `/validate` antes de cerrar. ✅ Validado `cursor-tests/20260525_t02-gap-synthesis-api.mjs` (11 tests).

---

## PROMPT T03 — applyAssessmentResults con perfiles pedagógicos

Conecta clasificación strong/weak/ok + gaps al `_config` de cada bloque.

**Archivos**:
- `src/js/session.js`

**Depende de**: T01.

**Tareas**:
1. strong → `explanation_profile: "brief_deep"`, `n_test: 1`, `n_socratic: 0`.
2. weak → `thorough`; subir `n_socratic` +1 (cap 3); si `gap_focus.length` > suma preguntas, aplicar regla R8 del `research.md`.
3. ok → defaults + `gap_focus` si hay gaps para ese bloque.
4. Unificar con `study.js` (eliminar divergencia `applySuggestedConfig` strong 0/0 vs session 1/0 cuando toques T05).

**Criterio de éxito**: Tras `applyAssessmentResults` con gaps mock, `loadActiveSession().blocks[i]._config` refleja perfiles correctos.

**ROADMAP**: T03. Ejecuta `/validate` antes de cerrar.

---

## PROMPT T04 — Prompts de generación por perfil

Parametriza `deepSeekGenerateBlockJson` según `contracts/block-generation-profile.md`.

**Archivos**:
- `src/js/api.js`
- Llamadas en `src/js/session.js` (`generateBlockForIndex`, prefetch)

**Depende de**: T01.

**Tareas**:
1. Añadir params `explanation_profile`, `gap_focus`.
2. Ramas de prompt thorough vs brief_deep (150–220 palabras).
3. Bloque gap_focus: ≥1 pregunta por laguna.
4. Pasar valores desde `resolveBlockQuestionConfig`.

**Criterio de éxito**: Generar un bloque strong en dev produce explicación visiblemente más corta que weak; weak con 2 gaps pide ≥2 preguntas alineadas en el JSON.

**ROADMAP**: T04. Ejecuta `/validate` antes de cerrar.

---

## PROMPT T05 — UI resultados: C paralelo + editor D

Refactoriza `showAssessmentResults` en `study.js` según spec FR-002–004.

**Archivos**:
- `src/js/study.js`
- `src/css/main.css` (solo si hace falta estilo para `<details>` gap editor)

**Depende de**: T02, T03.

**Tareas**:
1. Al montar resultados, lanzar `synthesizeAssessmentGaps` (no esperar para pintar heatmap).
2. Panel colapsable “Review gaps (optional)” por bloque: chips editables.
3. Accept: esperar C (max 30s) → merge gaps → `applyAssessmentResults` → flujo actual start.
4. Mantener coach synthesis como texto opcional si ya existe.

**Criterio de éxito**: Quickstart happy path en `specs/.../quickstart.md` pasos 1–4 sin pantalla extra.

**ROADMAP**: T05. Ejecuta `/validate` antes de cerrar.

---

## PROMPT T06 — Prefetch y configKey con perfil

Evita bloques generados con prompt obsoleto tras assessment.

**Archivos**:
- `src/js/session.js` (`triggerPrefetch`, `getPrefetchedBlock`)
- `src/js/study.js` (`generateBlockDirect`, `finishQuestions` next-block UI si aplica)

**Depende de**: T03, T04.

**Tareas**:
1. Incluir `explanation_profile` y `gap_focus` en `configKey`.
2. Invalidar prefetch previo si el perfil cambia tras accept.

**Criterio de éxito**: Tras accept con weak+gaps, el primer bloque generado usa prompt thorough + gap_focus sin regenerar manualmente.

**ROADMAP**: T06. Ejecuta `/validate` antes de cerrar.

---

## PROMPT T07 — Export markdown

**Archivos**: `src/js/export.js`

**Depende de**: T03.

**Tareas**: Sección Initial Assessment ampliada con `gaps_by_block` resumido por bloque.

**Criterio de éxito**: Export incluye lagunas tras assessment con edición.

**ROADMAP**: T07. Ejecuta `/validate` antes de cerrar.

---

## PROMPT T08 — Regresión

Ejecuta `specs/20260523-assessment-informed-blocks/quickstart.md` completo (happy path + skip assessment + timeout).

Documenta hallazgos en un comentario breve en el PR o en `deep-dives/` si hay bugs.

**Criterio de éxito**: SC-004 skip path sin regresión; SC-001 percibido ≤30s en red normal.

**ROADMAP**: T08. Ejecuta `/validate` antes de cerrar.

---

## Instrucción de ejecución (método Pedro)

**Lanzar primero**: PROMPT **T01** (solo).

**En paralelo cuando T01 termine**: abrir 2 chats con **T02**, **T03**, **T04** (tres prompts paralelos).

**Esperar** a que T02+T03 estén listos → **T05**.

**En paralelo**: **T06** + **T07** tras T03+T04.

**Cerrar con**: **T08**.

Tiempo mínimo estimado: 2–3 sesiones de agente (T05 es la más grande).

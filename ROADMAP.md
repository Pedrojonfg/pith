# ROADMAP — Zero-Latency Block Transitions

**Spec**: `specs/20260527-zero-latency-blocks/spec.md`  
**Plan**: `specs/20260527-zero-latency-blocks/plan.md`  
**Branch**: `20260527-zero-latency-blocks`

## Tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | API regen solo preguntas (`deepSeekRegenerateBlockQuestions`) | — | M | [x] |
| T02 | `session.js`: `generateQuestionsOnlyForIndex` + merge | T01 | M | [x] |
| T03 | Overlay transición: vista default vs Adjust + etiquetas ES | T02 | L | [x] |
| T04 | Camino rápido: CTA deshabilitado + consumo prefetch sin espera post-clic | T03 | M | [x] |
| T05 | Camino Adjust: regen parcial vs completa | T02, T03 | M | [x] |
| T06 | Quitar tarjeta guía inline en `finishRSVP` | — | S | [x] |
| T07 | Tests `cursor-tests` + regresión `quickstart.md` | T04, T05, T06 | M | [x] |

## Grafo de dependencias

```text
T01 → T02 → T03 → T04 → T07
          ↘     ↘ T05 ↗
T06 (independiente, paralelo desde inicio)
```

**Paralelo posible**:
- **T06** en cualquier momento (no bloquea T01–T05).
- Tras **T03**: **T04** y **T05** pueden repartirse si dos agentes coordinan el mismo `study.js` (mejor en serie).

## Orden de ejecución recomendado

1. **T01** → **T02** (API + session)  
2. **T06** (rápido, en paralelo si quieres)  
3. **T03** → **T04** → **T05** (overlay + flujos)  
4. **T07** (cerrar)

**Antes de producción**: bump `?v=` en imports (`study.js`, `session.js`, `api.js`) como patrón `20260525_1`.

---

## PROMPT T01 — API questions-only

Implementa la **regeneración solo de preguntas** según el feature **Zero-Latency Block Transitions**.

**Contexto**: Lee `specs/20260527-zero-latency-blocks/contracts/questions-only-regen.md` y el patrón de `buildBlockGenerationSystemPrompt` / `deepSeekGenerateBlockJson` en `src/js/api.js`.

**Archivos**:
- `src/js/api.js`

**Tareas**:
1. `QUESTIONS_ONLY_JSON_SCHEMA` y `buildQuestionsOnlySystemPrompt({ language, n_test, n_socratic, gap_focus, blockTitle })`.
2. `buildQuestionsOnlyUserContent({ blockTitle, explanation, materialText, gap_focus })` — incluye explicación fija con “do not rewrite”.
3. `export async function deepSeekRegenerateBlockQuestions(...)` — `response_format: json_object`, 1 retry en parse error.
4. Exportar builders para tests si hace falta.

**Criterio de éxito**: Llamada de prueba (mock o consola) devuelve `questions.length === n_test + n_socratic`; el prompt de sistema prohíbe devolver `explanation`.

**ROADMAP**: T01. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Session merge questions-only

**Contexto**: Contrato `questions-only-regen.md`, `generateBlockForIndex` en `src/js/session.js`.

**Archivos**:
- `src/js/session.js`

**Tareas**:
1. `export async function generateQuestionsOnlyForIndex(blockIndex, { n_test, n_socratic, baseBlock })` — merge sobre `baseBlock`.
2. Helper `resolveRegenMode(nextCfg, prefetchedBlock)` → `consume_prefetch` | `questions_only` | `full_block` según `data-model.md`.
3. Exportar `resolveRegenMode` para tests.

**Criterio de éxito**: Con bloque mock con `explanation` fija, cambiar solo `n_test` devuelve mismo `explanation` y distinto `questions.length`.

**ROADMAP**: T02 (requiere T01). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Transition overlay UX

**Contexto**: `specs/20260527-zero-latency-blocks/contracts/transition-overlay-ux.md` y clarificaciones en `spec.md` (Siguiente bloque / Ajustar siguiente bloque).

**Archivos**:
- `src/js/study.js` (principal)

**Tareas**:
1. Refactor `getOrCreateTransitionOverlay`: botón **Ajustar siguiente bloque**, estado `view` default|adjust.
2. Vista default: diccionario colapsado, sin textarea guía, sin steppers de preguntas.
3. Vista adjust: revelar steppers + Confirmar + Volver.
4. Etiquetas ES en botones (FR-002b).

**Criterio de éxito**: Al terminar bloque, overlay muestra dos acciones y diccionario colapsado; no hay textarea de comentarios en vista default.

**ROADMAP**: T03 (requiere T02). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Camino rápido (0s post-clic)

**Contexto**: FR-003a, research R2. Prefetch ya en `startBlock`.

**Archivos**:
- `src/js/study.js`

**Tareas**:
1. **Siguiente bloque** `disabled` hasta `prefetchState.ready` + `configKey` match.
2. `onclick` camino rápido: si `ready`, `getPrefetchedBlock` → persist session → `startBlock` sin loop “Finishing up…”.
3. Sincronizar barra overlay con `setPrefetchIndicator`.
4. Eliminar `setPendingComment` desde overlay.

**Criterio de éxito**: Con prefetch ready, un clic abre RSVP siguiente bloque sin espera visible de generación; botón deshabilitado mientras generating.

**ROADMAP**: T04 (requiere T03). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Camino Adjust (regen parcial)

**Contexto**: `resolveRegenMode`, `generateQuestionsOnlyForIndex`, `generateBlockDirect`.

**Archivos**:
- `src/js/study.js`
- `src/js/session.js` (si falta wiring)

**Tareas**:
1. Confirmar en Adjust: si `questions_only` → API parcial; si `full_block` → `generateBlockDirect`; si config igual y ready → consume prefetch.
2. Tras regen parcial, persistir bloque y actualizar prefetch slot/key.
3. Mantener `maybeRegeneratePrefetch` al cambiar steppers en Adjust.

**Criterio de éxito**: quickstart §4 — subir `n_test` conserva texto RSVP; bajar sin explanation en cache hace full regen.

**ROADMAP**: T05 (requiere T03, T02). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Quitar tarjeta guía inline

**Contexto**: FR-005a; sidebar es canal único.

**Archivos**:
- `src/js/study.js` (`finishRSVP`, `ensureGuideResponseCardVisible` usage)

**Tareas**:
1. Eliminar llamada a `ensureGuideResponseCardVisible` en `finishRSVP` (y lógica `lastConsumedPendingGuideReplyTs` si queda muerta).
2. No romper `triggerCommentReply` desde sidebar / `startBlock`.

**Criterio de éxito**: Tras comentario en sidebar y terminar RSVP, no aparece tarjeta inline; historial sidebar intacto.

**ROADMAP**: T06 (independiente). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Tests + quickstart manual

**Contexto**: `specs/20260527-zero-latency-blocks/quickstart.md`

**Archivos**:
- `cursor-tests/20260527_t01-questions-only-regen.mjs` (nuevo)
- `cursor-tests/20260527_t02-transition-regen-mode.mjs` (nuevo)
- Reusar patrones de `20260525_t06-prefetch-config-key.mjs`

**Tareas**:
1. Test `resolveRegenMode` matrix (counts only → questions_only; profile change → full_block).
2. Test merge conserva `explanation`.
3. Ejecutar quickstart manual y anotar SC-001/SC-003.

**Criterio de éxito**: `node --import ./cursor-tests/register.mjs cursor-tests/20260527_t*.mjs` exit 0; quickstart Pass table ✓.

**ROADMAP**: T07. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

**Lanzar primero**: **T01** (un chat).

**En serie**: T02 → T03 → T04 → T05.

**En paralelo cuando quieras**: **T06** (no toca overlay).

**Cerrar con**: **T07**.

**Siguiente comando Spec Kit**: `/speckit-tasks` si quieres `tasks.md` formal además de este ROADMAP.

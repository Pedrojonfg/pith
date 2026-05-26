# ROADMAP — Block Split Deduplication

**Spec**: `specs/20260526-block-split-dedup/spec.md`  
**Plan**: `specs/20260526-block-split-dedup/plan.md`  
**Branch**: `20260526-block-split-dedup`

## Tareas

| ID | Descripción | Dep. | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | API fase 1: prompt + `deepSeekConceptInventory` + parser | — | M | [ ] |
| T02 | API fase 2: prompt pack + `deepSeekPackConceptsToBlocks` + parser | T01 | M | [ ] |
| T03 | `twoPhaseConceptSplit` en `session.js` + fallback monofásico | T02 | M | [ ] |
| T04 | Dedup determinista (`findDeterministicDuplicateMerges` + apply) | T03 | M | [ ] |
| T05 | Wire `study.js`: progreso, M vs N, quitar `twoPhaseSplitMerge` | T04 | M | [ ] |
| T06 | Test `cursor-tests/20260526_t01-deterministic-dedup.mjs` | T04 | S | [x] |
| T07 | Regresión manual `quickstart.md` | T05, T06 | S | [ ] |

## Grafo de dependencias

```text
T01 → T02 → T03 → T04 → T05 → T07
                    T04 → T06 ↗
```

**Paralelo posible** (tras T04): **T06** y comienzo de pruebas manuales de T07 mientras se pulen mensajes en T05.

## Orden de ejecución recomendado

1. **T01** (inventario conceptos)  
2. **T02** (empaquetado + overview bloque 1)  
3. **T03** (orquestador + fallback)  
4. **T04** (dedup determinista)  
5. **T05** (UI)  
6. En paralelo: **T06** + checklist **T07**

---

## PROMPT T01 — API fase 1 (inventario de conceptos)

Implementa la **fase 1** del split en dos fases según el feature **Block Split Deduplication**.

**Contexto**: Lee `specs/20260526-block-split-dedup/contracts/two-phase-split-api.md`, `research.md` R2, y el patrón de reintentos en `deepSeekSplitIntoBlocks` (`src/js/api.js`).

**Archivos a tocar**:
- `src/js/api.js` (principal)

**Tareas**:
1. `buildConceptInventoryPrompt(lang)` — JSON `{ concepts: [...] }` con `id`, `order`, `title`, `scope_one_line`, `module?`, `prerequisite_ids?`.
2. `parseConceptInventoryFromModelResponse(text)` — tolerante (fences, objeto/array); reutiliza helpers existentes.
3. `export async function deepSeekConceptInventory({ llmModel, materialText, studyNotes, language })` — 3 intentos como split actual; `response_format: json_object`.

**Criterio de éxito**: Con material de prueba en consola, la función devuelve array ≥5 conceptos con `order` creciente; parse no lanza con JSON válido del modelo.

**ROADMAP**: T01. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — API fase 2 (empaquetar conceptos → bloques)

Implementa la **fase 2** del split: empaquetar inventario en índice de bloques.

**Contexto**: Contrato en `specs/20260526-block-split-dedup/contracts/two-phase-split-api.md`. Clarificaciones: bloque 1 = overview global dentro de N; Key terms por módulo; si conceptos > N fusionar; si < N devolver menos sin padding.

**Archivos**:
- `src/js/api.js`

**Tareas**:
1. `buildConceptPackPrompt(n, lang, inventoryJson)`.
2. `deepSeekPackConceptsToBlocks({ llmModel, inventory, nBlocks, studyNotes, language })` → `{ blocks, pack_meta }`.
3. Parser que valida: bloque 1 overview; `concept_ids` únicos; `pack_meta.final_block_count`.

**Criterio de éxito**: Mock inventory de 10 conceptos + N=8 devuelve 8 bloques con título overview en id 1 y `pack_meta` documentando merges si aplica.

**ROADMAP**: T02 (requiere T01). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Orquestador `twoPhaseConceptSplit`

Conecta fase 1 + fase 2 y asignación local de chunks.

**Contexto**: `specs/20260526-block-split-dedup/data-model.md`, `plan.md` WP3, `research.md` R4/R6.

**Archivos**:
- `src/js/session.js`

**Tareas**:
1. `export async function twoPhaseConceptSplit(material, nBlocks, { llmModel, studyNotes, language })`.
2. Tras pack: `normalizeBlockIndexArray` + respetar `pack_meta.final_block_count` (no forzar pad a N).
3. `splitMaterialIntoBlockChunks(material, finalCount)` para `chunk`.
4. Fallback a `deepSeekSplitIntoBlocks` si fase 1/2 fallan → `{ pipeline: "fallback_mono" }`.
5. Devolver `{ blockIndex, splitRunMeta }`.

**Criterio de éxito**: Llamada end-to-end desde consola (o test mínimo) devuelve índice con chunks no vacíos y `splitRunMeta.requested_n` / `final_n`.

**ROADMAP**: T03. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Dedup determinista

Sustituye el audit LLM por fusión determinista según firmas/títulos.

**Contexto**: `specs/20260526-block-split-dedup/contracts/deterministic-dedup.md`. Mantén `mergeChunks` para texto fusionado.

**Archivos**:
- `src/js/session.js`

**Tareas**:
1. `normalizeSignatureTerms`, `signatureOverlapCount`, `normalizeBlockTitle`.
2. `findDeterministicDuplicateMerges(blockIndex)` — umbral ≥3 términos o título idéntico.
3. `applyDeterministicDedup(blockIndex, { llmModel })` — aplica merges + `renumberBlockIndexSequential`.
4. Integrar en `twoPhaseConceptSplit` como último paso (antes de return).
5. **No** llamar `auditBlockIndex` / `twoPhaseSplitMerge` desde el flujo nuevo.

**Criterio de éxito**: Índice sintético con dos bloques compartiendo 3+ términos en signature → un solo bloque tras apply; par con overlap 2 → sin merge.

**ROADMAP**: T04. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — UI y wire en study.js

Integra el pipeline en “Generate blocks”.

**Contexto**: `study.js` ~2790–2855 hoy usa `deepSeekSplitIntoBlocks` + `twoPhaseSplitMerge`. Sustituir por `twoPhaseConceptSplit`. `quickstart.md` §1–3.

**Archivos**:
- `src/js/study.js`

**Tareas**:
1. Reemplazar split + audit por `twoPhaseConceptSplit`.
2. Status: “Inventariando conceptos…” → “Empaquetando N bloques…” → “Comprobando duplicados…”.
3. `renderSplitMergeSummary`: mensaje `Pediste N; el material sustentó M bloques` si M < N; filas dedup.
4. `state.lastNBlocks = finalIndex.length`.
5. Import JSON: sin two-phase (guard existente).

**Criterio de éxito**: Generar bloques en browser muestra overview en bloque 1 y summary M vs N cuando aplique; sin llamada a audit LLM (verificar red o logs).

**ROADMAP**: T05. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Test automatizado dedup

**Contexto**: `contracts/deterministic-dedup.md` casos de prueba.

**Archivos**:
- `cursor-tests/20260526_t01-deterministic-dedup.mjs` (nuevo)
- `cursor-tests/loader.mjs` si hace falta importar funciones de `session.js`

**Tareas**:
1. Importar `findDeterministicDuplicateMerges` (export para test si necesario).
2. Assert merge cuando overlap ≥3; no merge cuando overlap = 2.
3. Assert título duplicado merge.

**Criterio de éxito**: `node cursor-tests/20260526_t01-deterministic-dedup.mjs` exit 0.

**ROADMAP**: T06 (paralelo tras T04). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Regresión manual

Valida el feature completo según quickstart.

**Contexto**: `specs/20260526-block-split-dedup/quickstart.md` — todos los apartados.

**Tareas**:
1. Happy path PDF denso N=15.
2. Material corto N=20 → mensaje M < N.
3. Import JSON sin re-split.
4. Anotar si SC-001 (menos repetición) se cumple vs build anterior.

**Criterio de éxito**: Tabla quickstart Pass criteria toda ✓; sin regresión en confirm → study.

**ROADMAP**: T07. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

**Lanzar primero**: PROMPT **T01** (un chat).

**Después, en serie**: T02 → T03 → T04 → T05.

**En paralelo cuando T04 esté hecho**: abre chat con **T06** mientras otro agente hace **T05**, o T06 justo después de T04.

**Cerrar con**: **T07** manual en tu máquina.

**Antes de producción**: bump `?v=` en imports si el service worker cachea JS viejo (patrón `20260523_2` en el repo).

**Siguiente comando Spec Kit**: `/speckit-tasks` si quieres `tasks.md` formal además de este ROADMAP.

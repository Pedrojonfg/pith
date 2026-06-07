# Quickstart: Cloze Detection

**Feature**: `20260529-cloze-mode`  
**Prereqs**: API key DeepSeek o Gemini; archivo técnico `.md`/`.txt` ~8–15 páginas (~12k chars ideal).

## 1. Selector de modo (SC-001)

1. Abrir app → pantalla crear sesión.
2. **Expect**: RSVP, Slow Mode y **Cloze Detection** visibles; ninguno preseleccionado.
3. Elegir **Cloze Detection**.
4. **Expect**: controles RSVP (bloques) y Slow (critical mode) ocultos.

## 2. Upload sin IA automática

1. Subir material `.md` o `.txt`.
2. **Expect**: normalización completa; **sin** spinner de generación IA.
3. **Expect**: botón **Generar ítems** visible; `pipelineStatus` implícito = normalized.

## 3. Generación pipeline (SC-002, SC-003)

1. Pulsar **Generar ítems**.
2. **Expect**: progreso Fase 0/5 … 5/5.
3. Al terminar: **Expect** 60–120 ítems (típico ~12k chars); solo `valid` contados para estudio.
4. **Expect**: balance aproximado EASY/MEDIUM/HARD visible en resumen o muestra.

## 4. Vista de grafo (SC-006)

1. Pulsar **Ver grafo** (si disponible).
2. **Expect**: canvas + lista fallback; nodos/aristas coherentes con material.
3. **Expect**: usa `mountMaterialGraphScreen` — no pantalla grafo nueva.

## 5. Sesión MC (SC-004, SC-005, SC-007)

1. Pulsar **Estudiar** (o equivalente).
2. Responder ≥10 ítems.
3. **Expect**: oración con hueco + 4 opciones barajadas; feedback inmediato.
4. Recargar → Cloze → **Continuar** → **Expect**: mismo índice y stats &lt;2s.

## 6. Sesiones por modo (SC-001)

1. Tener sesión Cloze a medias.
2. Crear sesión RSVP nueva.
3. Volver a Cloze → **Continuar**.
4. **Expect**: sesión cloze intacta; RSVP no afectada.

## 7. Nueva sesión cloze

1. Con sesión cloze existente → **Nueva sesión**.
2. Confirmar reemplazo.
3. Subir material → **Generar ítems**.
4. **Expect**: Fase 0 ejecuta de nuevo (grafo nuevo); slot anterior reemplazado.

## 8. Regresión RSVP/Slow

1. Crear sesión RSVP → generar bloques → estudiar 1 bloque.
2. Crear sesión Slow → subir archivo → Fase 0.
3. **Expect**: sin regresiones en flujos existentes.

## cursor-tests

```bash
node cursor-tests/20260529_t01-cloze-sessions.mjs
node cursor-tests/20260529_t02-cloze-pipeline-status.mjs
node cursor-tests/20260529_t03-cloze-valid-items.mjs
```

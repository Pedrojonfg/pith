# Research: RSVP Pipeline Levers

**Feature**: `20260617-pipeline-levers` | **Date**: 2026-06-12

## R1 — Estrategia Key terms (L5)

**Decision**: L5-A inmediato (n_test=0 en Key terms/Overview) + L5-D en Sprint 3 (referencia lateral).

**Rationale**: L5-A elimina ~30% overlapping con cambio mínimo. L5-C pierde pre-activación pedagógica. L5-B requiere dos prompts pero no elimina bloque duplicado en secuencia. L5-D resuelve arquitecturalmente sin perder glosario.

**Alternatives considered**: L5-B (solo reconocimiento), L5-C (eliminar Key terms), L5-D solo (sin L5-A intermedio — rechazado por mayor esfuerzo antes de quick win).

---

## R2 — Target dinámico de inventario (L2)

**Decision**: `estimatedConceptTarget = clamp(Math.round(wordCount / 300) * 2, 30, 120)` pasado al prompt como expectativa, no como límite duro.

**Rationale**: Documento de 60 páginas con 30 conceptos (0.5/página) es insuficiente; 2/300 palabras ≈ 1.3–2/página en material denso. Cap 120 evita explosión de tokens; overflow activa L3.

**Alternatives considered**: Tipo de documento inferido por LLM (postergado a L4); target fijo 50 (rechazado — no escala).

---

## R3 — coverageManifest storage (L16)

**Decision**: Persistir en `session._meta.coverageManifest` como array append-only; pasar slice(-20) al prompt para límite de tokens.

**Rationale**: Ya existe parámetro `coverageManifest` en `api.js` para generación; falta población activa y extracción post-bloque. Slice(-20) balancea memoria vs contexto.

**Alternatives considered**: localStorage separado (rechazado — duplica session state); LLM extract claims siempre (rechazado — coste; heurística local primero).

---

## R4 — Cuándo invocar deepSeekAuditBlockOverlap (L17)

**Decision**: Solo bloques de desarrollo con índice > 1; opcionalmente limitar a primer bloque de desarrollo tras Key terms del mismo módulo en v1.

**Rationale**: Función ya implementada en `api.js` pero no cableada en `ensureBlockGenerated`. Key terms ya sin preguntas vía L15; audit en Key terms añade coste sin beneficio.

**Alternatives considered**: Audit en todos los bloques (rechazado — +1 LLM call × N); audit solo manual (rechazado — no cierra loop automático).

---

## R5 — Claim coverage threshold (L21)

**Decision**: `claimCoverageRatio < 0.6` → retry con lista de claims no cubiertos; máximo 1 retry automático antes de warn.

**Rationale**: Complementa Jaccard (fidelidad) con completitud. 60% alineado con spec; evita loops infinitos.

**Alternatives considered**: 80% threshold (rechazado — demasiado agresivo en chunks largos); solo warn sin retry (rechazado — no ataca thin blocks).

---

## R6 — Inventario dos pasadas (L3)

**Decision**: Fase 2 por sección de `docHierarchy` solo si inventario fase 1 < target O documento > 8000 palabras.

**Rationale**: Evita coste 2-3× en documentos cortos. Depende de L1/L9 para secciones fiables.

**Alternatives considered**: Siempre dos pasadas (rechazado — coste); solo manual flag (postergado).

---

## R7 — Separación explanation / questions (L13)

**Decision**: Refactor a dos funciones exportadas; `deepSeekGenerateBlockJson` orquesta ambas para compatibilidad.

**Rationale**: Permite regen de preguntas sin regen de explanation; coverageManifest solo en paso 2. +1 call/bloque aceptable en strict.

**Alternatives considered**: Mantener single call (rechazado — preguntas optimizadas sobre explanation propia); tres calls (extract, explain, questions — rechazado — ya existe extract en strict).

---

## R8 — Dedup threshold strict (L11)

**Decision**: `SIGNATURE_OVERLAP_THRESHOLD = strict ? 2 : 3`; segunda regla: ≥1 concept_id compartido Y ≥2 términos firma → merge.

**Rationale**: Vocabulario especializado comparte 2 términos con significado real. Configurable vía `session._meta.pipelineLevers`.

**Alternatives considered**: Siempre 2 (rechazado — falsos positivos en modo normal); solo LLM dedup (postergado L12).

---

## R9 — Delimitadores jerarquía (L1)

**Decision**: Extender normalización existente (`hierarchy.js` / `infer-headings`) con patrones Unicode ❖ ➔ ➢ además de h1-h6.

**Rationale**: Documento QA ética usa delimitadores en texto plano. Reutiliza pipeline doc-hierarchy (20260609).

**Alternatives considered**: Solo LLM hierarchy (rechazado — menos determinista); regex-only sin outline PDF (complementario, no sustituto).

---

## R10 — Orden de implementación

**Decision**: Sprint 0 → 1 → 2 → 3 → 4 según tabla prioridades en spec fuente; P5 opcional post-QA.

**Rationale**: Maximiza impacto/esfuerzo temprano; dependencias L1→L9, L15→L14, L16→L22, L17→L23 respetadas.

**Alternatives considered**: Big-bang 25 palancas (rechazado — riesgo regresión); solo P0 (rechazado — no resuelve thin blocks).

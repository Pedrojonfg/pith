# Contract: Phase 0 — Orientation IA

**Feature**: `20260528-slow-mode` | **FR**: FR-005, FR-005a–c, FR-014, FR-016

## Flow

```text
upload → normalize → scope picker (headings list) → [optional critical toggle, fillable map toggle]
  → generate Phase 0 → show blocks → user confirm/collapse → phase1
```

## Scope picker (`screenSlowScope`)

- Lista: "Documento completo" + chapters/sections detectados.
- Preview: char count del scope; aviso si ≥60k ("Generación por secciones").

## IA strategy

| Condition | Action |
|-----------|--------|
| `scopeLen < 60000` | `generatePhase0Single(scopeText)` |
| `scopeLen >= 60000` | `mapReducePhase0(scopeText, sectionBoundaries)` |

Map-reduce:
1. Split por headings dentro del scope (chunks ≤50k chars).
2. Por chunk: JSON parcial `{ partialMap, concepts[] }`.
3. Síntesis final: tesis + mapa global + 3–5 conceptos + pregunta guía (+ criticalExaminePoints si aplica).

## Output schema (`Phase0Orientation`)

Respuesta JSON validada en cliente; campos obligatorios: `thesis`, `argumentMap[]`, `conceptsToFind[]` (3–5), `guideQuestion`.

## Failure

- Sin API key: bloquear antes de upload (igual RSVP).
- Error red/timeout: **Reintentar** + **Continuar sin orientación** → `phase0Status: 'skipped'`, Fase 1 sin bloqueo.

## Re-read

- Segunda sesión mismo material+scope: Fase 0 colapsada por defecto; datos cacheados en sesión si no es sesión nueva.

## Fillable map mode

- Alternativa en scope screen: mapa con blancos `P1: ___` en lugar de mapa completo IA.
- Hallazgos visibles en Fase 1 (excepción D1).

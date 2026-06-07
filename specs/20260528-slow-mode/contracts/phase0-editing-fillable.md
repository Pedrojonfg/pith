# Contract: Fase 0 Editing & Fillable Map

**Feature**: `20260528-slow-mode` Wave 2 | **Spec**: §4, §11.2, FR-014

## Editable fields (post-IA, pre-phase1)

| Field | UI |
|-------|-----|
| `prequestions[]` | Lista editable; añadir/eliminar preguntas usuario |
| `argumentMap[]` | Inline edit por nodo P/I/C |
| `conceptsToFind[]` | Añadir desde picker diccionario; `graphTermId` cuando match |

## Fillable map mode

- Toggle en `screenSlowScope`: "Mapa rellenable".
- Si ON: Fase 0 muestra blancos `P1: ___` en lugar de mapa completo IA (o híbrido: IA genera estructura vacía).
- Durante Fase 1: al anotar cerca de concepto/premisa, permitir rellenar blank + guardar `pageIndex`.
- Hallazgos `✦` **visibles en tiempo real** (excepción D1).

## Re-read rules

| Case | Behavior |
|------|----------|
| Primera lectura `(material, scope)` | Fase 0 expandida; **sin** "Continuar sin orientación" |
| Re-lectura misma pareja | Fase 0 **colapsada** por defecto; datos cacheados |
| Nueva sesión mismo archivo | Trata como primera si slot reemplazado |

Persist: `slow.phase0SeenKey = hash(fileName + scope range)`.

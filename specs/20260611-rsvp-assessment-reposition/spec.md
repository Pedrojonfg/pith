# Feature: RSVP Assessment Reposition (Pre-Packing)

**Versión:** 1.0  
**Fecha:** 2026-06-11  
**Módulo:** RSVP — Generate Blocks / Assessment  
**Prioridad:** P1  
**Estado:** Clarified

## Clarifications

### Session 2026-06-11

- Q: ¿Qué pasa con el assessment legacy post-packing (`generateAssessmentQuestions` + `applyAssessmentResults`)? → A: Reemplazar — solo assessment pre-packing en RSVP; eliminar o desactivar el post-packing legacy.
- Q: Comportamiento de "Ignorar y usar los 5" en pantalla de resultados → A: Block packing uniforme sin aplicar perfil, pero `knowledge_profile` se persiste en `session._meta`.
- Q: ¿Conceptos/bloques con mastery=full desaparecen del `blockIndex` o quedan marcados? → A: No entran en `blockIndex` (lista más corta). **Solo aplica al flujo de estudio activo** — `concept_inventory`, grafo y diccionario permanecen completos.
- Q: ¿El N de bloques del usuario es fijo o adaptable? → A: N es techo máximo; el packing puede devolver menos bloques según conceptos no dominados.
- Q: ¿`ASSESSMENT_PARALLEL_PACKING` bloquea en pantalla de resultados? → A: Packing en paralelo; resultados informativos; "Aceptar" confirma bloques ya generados (o casi listos).

---

## 1. Problema

El assessment inicial en el flow RSVP actual ocurre **después** de que los N bloques ya están generados y confirmados. Esto lo hace inútil como input de segmentación: su único efecto posible es marcar bloques como saltables, no informar cómo se construyeron.

El assessment tiene valor real solo si ocurre **después de conocer los conceptos del documento** (para ser específico) pero **antes de construir los bloques** (para poder influir en su estructura, número y learning goals).

---

## 2. Solución

Romper `Generate Blocks` en dos fases separadas por el assessment:

```
Fase 1: Concept Inventory   →   Assessment   →   Fase 2: Block Packing
```

El assessment recibe como input el `concept_inventory` (conceptos + relaciones detectadas), evalúa el conocimiento previo del usuario sobre esos conceptos específicos, y devuelve un `knowledge_profile` que el block packing usa como constraint **solo sobre el flujo de estudio activo** (`blockIndex` + `learning_goal`).

### Principio de capas (alcance del filtro)

El `knowledge_profile` **no borra conceptos del documento**; evita re-estudiar lo ya dominado. Las capas de representación permanecen completas; solo el flujo activo se reduce.

| Capa | ¿Filtrada por mastery? |
|------|------------------------|
| `concept_inventory` | ❌ Siempre completo |
| Grafo de conceptos (UI) | ❌ Siempre completo |
| Diccionario de conceptos por bloque | ❌ Siempre completo |
| `blockIndex` (bloques activos de estudio) | ✅ Sí, se reducen |
| `learning_goal` por bloque | ✅ Sí, se ajustan |

Si en un bloque activo aparece referencia a un concepto ya dominado, el diccionario lo tiene disponible para consulta — simplemente no hay bloque dedicado a enseñarlo.

El assessment legacy post-packing (`generateAssessmentQuestions` + `applyAssessmentResults`) queda **reemplazado** por este flujo pre-packing en RSVP.

---

## 3. Flow actualizado

### 3.1 Flow principal (nivel sesión)

```
flowchart TD
    A[Seleccionar RSVP] --> B{¿Sesión RSVP reanudable?}
    B -->|Sí| C[Pantalla Ready]
    B -->|No| D{¿Material ya en documento?}
    D -->|Sí bootstrap| E[Saltar upload]
    D -->|No| F[Subir archivo + configurar]
    E --> G[Fase 1: Concept Inventory]
    F --> G
    G --> H{¿Assessment habilitado?}
    H -->|Saltar| I[Fase 2: Block Packing — sin perfil]
    H -->|Hacer quiz| J[Assessment sobre concept_inventory]
    J --> K[Generar knowledge_profile]
    K --> I
    I --> L[blockIndex ajustado]
    L --> M[Confirmar lista de bloques]
    M --> C
    C --> N[Start studying]
    N --> O[ensureBlockGenerated bloque 1]
```

### 3.2 Fase 1: Concept Inventory (sin cambios estructurales)

```
flowchart TD
    A[Chunk del documento] --> B[LLM: extraer concept_inventory]
    B --> C[Lista de conceptos con tipo + relaciones + chunk_refs]
    C --> D[UI: mostrar grafo de conceptos al usuario]
    D --> E{¿Assessment?}
    E -->|Sí| F[Pasar concept_inventory al Assessment]
    E -->|No| G[Pasar concept_inventory al Block Packing directamente]
```

### 3.3 Assessment (nueva posición)

```
flowchart TD
    A[concept_inventory recibido] --> B[LLM: generar quiz items desde conceptos]
    B --> C[Seleccionar N items por cobertura de concept_ids]
    C --> D[UI: quiz interactivo]
    D --> E[Respuestas del usuario]
    E --> F[LLM: evaluar respuestas → knowledge_profile]
    F --> G[knowledge_profile: concept_id → {mastery, confidence}]
    G --> H[Pasar a Fase 2: Block Packing]
```

### 3.4 Fase 2: Block Packing (modificada)

```
flowchart TD
    A[concept_inventory completo + knowledge_profile?] --> B[LLM: pack → hasta N bloques]
    B --> C{¿knowledge_profile presente?}
    C -->|Sí| D[Omitir conceptos dominados del blockIndex activo]
    C -->|Sí| E[Fusionar bloques donde gap es solo relacional]
    C -->|Sí| F[Ajustar learning_goal por bloque según gap real]
    C -->|No| G[Block packing uniforme por defecto]
    D --> H[blockIndex ajustado]
    E --> H
    F --> H
    G --> H
    H --> I[Persistir session._meta.material_graph]
```

---

## 4. Cambios en estructuras de datos

Ver [data-model.md](./data-model.md) para entidades completas y transiciones.

### 4.1 `concept_inventory` (sin cambios; nunca filtrado)

Siempre refleja el documento completo. El `knowledge_profile` no modifica esta estructura.

### 4.2 `knowledge_profile` (nuevo)

Perfil de dominio por `concept_id` + opcional `edge_mastery`. Ver data-model.

### 4.3 `blockIndex` (modificado — única capa filtrada)

Única estructura reducida por `knowledge_profile`. Bloques dominados **no entran** en `blockIndex`. N = techo máximo.

### 4.4 `session._meta` (modificado)

`knowledge_profile`, `assessment_skipped`, `packing_ignored_profile`. Grafo siempre completo.

---

## 5. Cambios en prompts LLM

Ver [contracts/pre-packing-assessment-api.md](./contracts/pre-packing-assessment-api.md) y [contracts/pack-with-profile.md](./contracts/pack-with-profile.md).

---

## 6. Cambios en UI

Ver [contracts/assessment-ui.md](./contracts/assessment-ui.md).

---

## 7. Feature flags

Ver [contracts/feature-flags.md](./contracts/feature-flags.md).

---

## 8. Casos edge

| Caso | Comportamiento esperado |
|---|---|
| Usuario salta el assessment | `knowledge_profile = null`, block packing uniforme, `assessment_skipped = true` |
| Usuario elige "Ignorar y usar todos" | Packing sin perfil (hasta N bloques); `knowledge_profile` persistido; `packing_ignored_profile = true` |
| Todos los conceptos dominados | Warning + `blockIndex` vacío o mínimo; grafo/diccionario completos; ofrecer estudio completo vía "Ignorar" |
| Ningún concepto dominado | Omitir pantalla de resultados; packing en paralelo directo a confirmación |
| Concepto dominado es prerequisito de no-dominado | Incluir en bloque activo del no-dominado con `learning_goal: 'prerequisite_review'` |
| Referencia a concepto dominado en bloque activo | Diccionario resuelve la consulta; sin bloque dedicado al concepto |
| LLM de evaluación falla | Fallback silencioso: `knowledge_profile = null`, continuar sin perfil |

---

## 9. Criterios de éxito

- SC-001: Assessment ocurre tras concept inventory y antes de block packing en RSVP create flow
- SC-002: `concept_inventory` y grafo UI idénticos con o sin assessment
- SC-003: Con perfil aplicado, `blockIndex.length` ≤ N y puede ser menor que packing uniforme
- SC-004: Skip e "Ignorar" producen packing sin perfil; solo skip deja `knowledge_profile` null
- SC-005: Legacy post-packing assessment no aparece cuando `ASSESSMENT_BEFORE_PACKING` activo
- SC-006: Packing paralelo: usuario ve resumen mientras bloques se generan en background

---

## 10. Lo que NO cambia

- El `concept_inventory` (Fase 1) — estructura y contenido completo; nunca filtrado por mastery
- El `buildRsvpMaterialGraph` y la visualización del grafo — siempre documento completo
- El diccionario de conceptos por bloque — siempre completo; consultable aunque el concepto no tenga bloque dedicado
- El formato de `blockIndex` es retrocompatible (campos nuevos son opcionales)
- Sesiones ya guardadas sin `knowledge_profile` siguen siendo válidas

## 11. Lo que SÍ cambia (explícito)

- Assessment RSVP: pre-packing reemplaza al post-packing legacy
- `blockIndex`: única capa reducida por mastery (bloques dominados ausentes, no marcados)
- `learning_goal` por bloque: calibrado según gap
- N del usuario: techo máximo, no cantidad fija obligatoria

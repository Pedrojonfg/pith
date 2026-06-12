# spec-rsvp-assessment-reposition.md

**Versión:** 1.0  
**Fecha:** 2026-06-11  
**Módulo:** RSVP — Generate Blocks / Assessment  
**Prioridad:** P1  
**Estado:** Draft

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

### 4.1 `concept_inventory` (sin cambios; nunca filtrado)

Siempre refleja el documento completo. El `knowledge_profile` no modifica esta estructura.

```typescript
interface ConceptInventory {
  concepts: Array<{
    id: string;           // concept_id único
    label: string;
    type: 'THESIS' | 'CONCEPT' | 'ARGUMENT' | 'EXAMPLE' | 'TERM';
    chunk_refs: string[]; // referencias al texto fuente
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}
```

### 4.2 `knowledge_profile` (nuevo)

```typescript
interface KnowledgeProfile {
  assessed_at: string;        // ISO timestamp
  coverage: number;           // % de concept_ids evaluados
  items: Array<{
    concept_id: string;
    mastery: 'none' | 'partial' | 'full';
    confidence: number;       // 0.0 – 1.0, autoasignado por el LLM evaluador
    edge_mastery?: {          // para relaciones entre conceptos
      from: string;
      to: string;
      mastered: boolean;
    }[];
  }>;
}
```

### 4.3 `blockIndex` (modificado — única capa filtrada por mastery)

Única estructura reducida por `knowledge_profile`. Bloques cuyos conceptos están todos dominados **no entran** en `blockIndex` (no se marcan in-place). El usuario configura N como **techo máximo**; el packing puede devolver menos bloques.

Añadir campos opcionales por bloque:

```typescript
interface BlockMeta {
  block_id: string;
  concept_ids: string[];
  signature: string;
  chunk: string;
  learning_goal: string;          // NUEVO: calibrado al gap (p. ej. 'relational', 'prerequisite_review')
  mastery_adjusted?: boolean;     // NUEVO: true si fue comprimido por knowledge_profile
}
```

### 4.4 `session._meta` (modificado)

```typescript
interface SessionMeta {
  material_graph: MaterialGraph;        // grafo completo; no filtrado por mastery
  knowledge_profile?: KnowledgeProfile;  // opcional; persiste aunque el usuario elija "Ignorar"
  assessment_skipped: boolean;           // true si el usuario saltó el quiz (no si ignoró el perfil en packing)
  packing_ignored_profile?: boolean;     // true si "Ignorar y usar todos los bloques" — packing sin perfil
}
```

---

## 5. Cambios en prompts LLM

### 5.1 Nuevo: `generateAssessmentItems`

**Input:**
```
concept_inventory: ConceptInventory
config: { max_items: number, difficulty: 'adaptive' | 'uniform' }
```

**System prompt (skeleton):**
```
You receive a concept inventory from an academic document.
Generate quiz items that cover the most important concept_ids and edges.
Each item must reference exactly one concept_id or one edge (from→to).
Prioritize THESIS and ARGUMENT types over TERM.
Return ONLY valid JSON, no preamble.
```

**Output schema:**
```typescript
Array<{
  item_id: string;
  concept_id: string;       // o null si evalúa una edge
  edge?: { from: string; to: string };
  question: string;
  type: 'mcq' | 'open_short';
  options?: string[];       // solo para mcq
  correct?: string;         // solo para mcq
}>
```

### 5.2 Nuevo: `evaluateAssessmentResponses`

**Input:**
```
items: AssessmentItem[]
responses: Array<{ item_id: string; answer: string }>
```

**System prompt (skeleton):**
```
You receive quiz items and user responses.
For each item, assign mastery: 'none' | 'partial' | 'full' and confidence 0.0–1.0.
Be conservative: partial requires showing understanding, full requires precision.
Return ONLY valid JSON.
```

### 5.3 Modificado: `packConceptsIntoBlocks`

Añadir parámetro opcional `knowledge_profile` al prompt:

```
Input concept_inventory is ALWAYS complete. knowledge_profile only affects which concepts
get dedicated blocks in the output blockIndex (max N blocks; may return fewer).

If knowledge_profile is provided:
- Do NOT include dedicated blocks for concepts where mastery === 'full' AND confidence > 0.85
- For blocks where only edge mastery is missing, set learning_goal to 'relational'
  and compress the block (reduce word count target by 40%)
- Do NOT omit a concept from blockIndex if it is a prerequisite for a non-mastered concept
  (include with learning_goal: 'prerequisite_review')
- material_graph and concept dictionary remain complete regardless of mastery
```

---

## 6. Cambios en UI

### 6.1 Paralelización (crítico para latencia percibida)

El usuario **no debe esperar** a que termine el Concept Inventory antes de ver algo.

| Momento | UI | Background |
|---|---|---|
| Upload completo | Spinner "Analizando documento..." | Concept Inventory LLM corriendo |
| Concept Inventory lista | Mostrar grafo + lanzar quiz items LLM | Quiz items generándose |
| Quiz items listos | Mostrar quiz al usuario | — |
| Usuario enviando respuestas | — | `evaluateAssessmentResponses` LLM |
| Evaluación lista | Mostrar knowledge_profile summary | Block Packing LLM lanzado |
| Block Packing listo | Mostrar lista de bloques + diff vs sin-assessment | — |

### 6.2 Pantalla de Assessment (nueva)

```
┌─────────────────────────────────────────────┐
│  Evaluación inicial                    [Skip]│
│  "¿Qué sabes ya de este documento?"          │
│                                             │
│  [Grafo de conceptos — pequeño, decorativo] │
│                                             │
│  Pregunta 1/5                               │
│  ─────────────────────────────────────────  │
│  [Texto de la pregunta]                     │
│                                             │
│  ○ Opción A                                 │
│  ○ Opción B                                 │
│  ○ Opción C                                 │
│  ○ No lo sé                                 │
│                                             │
│                           [Siguiente →]     │
└─────────────────────────────────────────────┘
```

- Opción "No lo sé" siempre visible (evita que el usuario adivine y contamine el perfil)
- Skip en header disponible en cualquier momento (va directamente a block packing sin perfil)
- Progress bar discreta (sin ansiedad de test)

### 6.3 Pantalla de resultados del Assessment (informativa; packing en paralelo)

Con `ASSESSMENT_PARALLEL_PACKING: true`, el Block Packing arranca en background al terminar la evaluación. Esta pantalla es **informativa** — no bloquea el packing. "Aceptar y empezar" confirma la lista de bloques ya generada (o muestra spinner breve si aún no terminó).

```
Conocimiento previo detectado
──────────────────────────────
✓ Dominado (3 conceptos) — sin bloque dedicado en el flujo activo
◑ Parcial (4 conceptos) — se incluirán con contexto reducido
✗ Sin conocimiento (8 conceptos) — estudio completo

Bloques activos: hasta 5 → 3  (N es techo; sin assessment hubieran sido 5)

[Aceptar y empezar]   [Ver detalle]   [Ignorar y usar todos]
```

- **"Ignorar y usar todos"**: re-ejecuta block packing **sin** aplicar `knowledge_profile` (lista completa hasta N bloques). El perfil **sí se persiste** en `session._meta` (`packing_ignored_profile: true`).
- El grafo y el diccionario siguen mostrando todos los conceptos del documento.

---

## 7. Feature flags

```javascript
// config/flags.js
ASSESSMENT_BEFORE_PACKING: true,        // activa el nuevo flow
ASSESSMENT_ITEMS_MAX: 7,                // máximo de preguntas
ASSESSMENT_MASTERY_THRESHOLD: 0.85,     // confidence mínimo para omitir concepto
ASSESSMENT_SHOW_DIFF: true,             // mostrar "X bloques → Y bloques"
ASSESSMENT_PARALLEL_PACKING: true,      // lanzar block packing sin esperar UI de resultados
```

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

## 9. Tareas de implementación

```
[ ] P0: Separar generateBlocks en generateConceptInventory + packConceptsIntoBlocks
[ ] P0: Añadir KnowledgeProfile al schema de sesión
[ ] P0: Implementar generateAssessmentItems (prompt + parser)
[ ] P0: Implementar evaluateAssessmentResponses (prompt + parser)
[ ] P0: Modificar packConceptsIntoBlocks (N como techo, knowledge_profile opcional, capas separadas)
[ ] P0: Desactivar/eliminar assessment post-packing legacy en RSVP
[ ] P1: UI pantalla Assessment con skip
[ ] P1: UI pantalla resultados informativa + diff de bloques activos
[ ] P1: Paralelización Concept Inventory ↔ quiz item generation ↔ block packing
[ ] P1: Feature flags en config/flags.js
[ ] P1: Opción "Ignorar y usar todos" (packing sin perfil, perfil persistido)
[ ] P2: Ajuste de learning_goal por bloque según gap relacional
[ ] P3: Analytics: tasa de skip del assessment, reducción media de bloques
```

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

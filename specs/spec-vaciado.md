# Spec: Recall Mode

**Fecha:** 2026-06-13  
**Estado:** Borrador  
**Relacionado:** `20260612-mode-continuity`, `20260617-pipeline-levers`, `20260613-sm2-priority-queue`

---

## 1. Qué es

**Recall** es un modo de recuperación activa guiada mediante preguntas socráticas de síntesis. A diferencia del modo Questions (preguntas atómicas MCQ por bloque), Recall hace preguntas de desarrollo que abarcan secciones o el documento entero: relaciones entre conceptos, reconstrucción de argumentos, estructura global.

El término viene de la técnica de *vaciado en frío/caliente* (Justin Sung): reproducir sin ver el material todo lo que se recuerda, con distintos momentos según el flujo de estudio.

**La app no distingue frío/caliente.** Esa distinción emerge naturalmente de cuándo el usuario entra al modo:
- Antes de cualquier otro modo → vaciado frío (diagnóstico)
- Después de RSVP o Slow → vaciado caliente (consolidación)
- Días después como repaso → vaciado frío (retención a largo plazo)

---

## 2. Relación con sistemas existentes

### Isomorfismo con Questions

Questions es a las preguntas test de RSVP lo que Recall es a las preguntas socráticas de RSVP:

| | RSVP embebido | Modo standalone |
|---|---|---|
| **Test MCQ** | `type: "test"` por bloque | Modo Questions |
| **Socrático** | `type: "socratic"` por bloque | **Recall Mode** |

El pipeline de generación se reutiliza, pero el scope cambia: en RSVP las socráticas son por bloque; en Recall son cross-bloque o sobre el inventario completo.

### Relación con el socrático actual (y qué se mejora)

El audit del socrático RSVP identifica varios problemas. Recall los resuelve desde el diseño:

| Problema en RSVP socrático | Solución en Recall |
|---|---|
| Tutor solo recibe `block.title` | Tutor recibe chunk de fuente + términos relevantes del diccionario |
| Assessment signals siempre `wrong` (sin `correct_answer`) | Evaluación LLM ligera post-tutor para determinar calidad |
| Sin ingest SM-2 | Recall registra en `smItems` con quality derivada del tutor |
| `socratic_mode` nunca asignado | Recall asigna `mode: "recall"` desde el principio |
| Grafo no conectado a generación | Recall usa `prerequisite_ids` y aristas `covers` para orientar preguntas relacionales |
| `concept_id` solo en assessment pre-packing | Recall lo exige desde generación |

Estas mejoras también deberían retroalimentar el socrático de RSVP (ver sección 9).

---

## 3. Tipos de pregunta de Recall

El scope es mayor que en RSVP. Cuatro tipos de pregunta:

| `recall_type` | Qué pide | Ejemplo |
|---|---|---|
| `synthesis` | Reconstruir estructura general | "Explica la tesis central del texto y los tres argumentos que la sostienen" |
| `relational` | Relación entre dos o más conceptos | "¿Cómo se relacionan X e Y? ¿En qué se oponen o complementan?" |
| `argumentative` | Defender o criticar una posición | "¿Por qué el autor rechaza X? ¿Qué objeción le pondrías?" |
| `applicative` | Aplicar un concepto a un caso | "Aplica el concepto X a la siguiente situación…" |

En generación se incluye siempre al menos una `synthesis` y la distribución del resto depende del `primaryLearningGoal` del documento:

| `primaryLearningGoal` | Distribución sugerida |
|---|---|
| `understand_argument` | synthesis + argumentative + relational |
| `memorize_facts` | relational + applicative |
| `learn_procedure` | applicative + synthesis |
| `survey_field` | synthesis + relational |

---

## 4. Modelo de datos

### Slot en `DocumentSession`

```typescript
modes.recall: {
  // Estado del modo
  status: "not_started" | "generating" | "ready" | "in_progress" | "complete",
  
  // Preguntas generadas
  questions: RecallQuestion[],
  
  // Progreso
  currentIndex: number,
  
  // Config de sesión
  config: {
    questionCount: number,        // default 5-8 según tamaño doc
    types: RecallType[],         // cuáles tipos incluir
    scope: "full" | "section",    // doc entero o scope como Slow
    sectionScope?: string,        // si scope === "section"
  },
  
  _meta: {
    generatedAt: number,
    sourceInventoryHash: string,  // para saber si reutilizar o regen
    usedAssessmentSignals: boolean,
  }
}

type RecallQuestion = {
  id: string,                     // "vq1", "vq2"…
  recall_type: "synthesis" | "relational" | "argumentative" | "applicative",
  question: string,
  concept_ids: string[],          // qué conceptos del inventario toca
  source_chunks: string[],        // fragmentos de rawMarkdown de apoyo para el tutor
  
  // Respuesta del usuario
  student_answer?: string,
  
  // Tutor
  tutor_feedback?: {
    critique: string,
    suggested_answer: string,
    quality: "strong" | "adequate" | "partial" | "insufficient",  // para SM-2
  }
}
```

### Escritura en `shared`

Recall escribe en `shared.assessmentSignals` los concept_ids de preguntas con calidad `partial` o `insufficient`, igual que RSVP y Cloze. Esto permite que si el usuario hace Recall antes de Cloze, Cloze prioriza los conceptos débiles.

---

## 5. Flujo de entrada

```
resolveModeEntryState(doc, "recall")
  → "resume"            si modes.recall.status === "in_progress"
  → "bootstrap"         si shared.conceptInventory existe (reutilizar)
  → "generate_fresh"    si no hay inventario (generar primero)
  → "upload_required"   si no hay rawMarkdown
```

### Bootstrap desde inventario existente (camino rápido)

Si ya hay `shared.conceptInventory` (porque el usuario hizo RSVP o Slow antes):

1. Leer `conceptInventory` + `assessmentSignals` (si hay, para priorizar débiles)
2. Leer `PedagogicalMeta.primaryLearningGoal` para elegir distribución de tipos
3. Llamar `generateRecallQuestions` directamente — sin inventario nuevo
4. Guardar en `modes.recall`

### Generate fresh (camino largo)

Si no hay inventario:

1. Normalizar documento (igual que todos los modos)
2. Correr `runConceptInventory` (fase 1, sin fase 2 salvo docs largos)
3. Guardar en `shared.conceptInventory`
4. Llamar `generateRecallQuestions`

No se hace packing de bloques — Recall no necesita `blockIndex`.

---

## 6. Pipeline de generación (`api.js`)

### `generateRecallQuestions(params)`

**Input:**
```typescript
{
  rawMarkdown: string,
  conceptInventory: ConceptEntry[],
  pedagogicalMeta: PedagogicalMeta,
  assessmentSignals?: AssessmentSignal[],  // si hay, para priorizar
  config: RecallConfig,
  lang: string,
}
```

**Prompt system:**

```
You are generating synthesis-level retrieval questions for active recall practice.

QUESTION TYPES:
- synthesis: reconstruct overall structure or central argument
- relational: explain connection/contrast between 2+ concepts
- argumentative: defend or critique a position from the text
- applicative: apply a concept to a specific case

RULES:
- Each question MUST reference 1-3 specific concept_ids from the inventory
- Each question MUST be answerable from the source material (include relevant source_chunk)
- Questions should NOT be answerable with a single definition — they require integration
- Distribute types according to: [distribución según learningGoal]
- If assessmentSignals provided: weight questions toward weak concept_ids
- Do NOT include MCQ options — open-ended only

OUTPUT: JSON array of RecallQuestion (id, recall_type, question, concept_ids, source_chunk)
```

**Temperatura:** 0.4 (más alta que bloques RSVP porque la diversidad de síntesis importa)

**Count target:**
```
tiny/short doc  → 3-4 preguntas
medium          → 5-7
long/very_long  → 7-10 (o por sección si scope === "section")
```

---

## 7. Flujo de estudio

```
screenRecall (nueva pantalla)
  → mostrar pregunta N de M
  → textarea respuesta libre
  → submit → deepSeekRecallTutor
  → mostrar Critique + Suggested answer
  → botón "siguiente pregunta"
  → al terminar todas → resumen + escritura en shared
```

### UI mínima

- Pregunta centrada, sin distracción
- Textarea generoso (el usuario va a escribir párrafos, no una línea)
- Sin temporizador (Recall no es sprint, es reflexión)
- Sidebar opcional: el usuario puede pedir "ver concepto" — muestra la definición del diccionario si existe, no el texto completo
- Progreso: "3 / 6" en header, sin barra de progreso (para no crear ansiedad por el número)

---

## 8. Tutor (`deepSeekRecallTutor`)

### Diferencia clave vs `deepSeekSocraticTutor` actual

El tutor actual solo recibe `block.title`. El tutor de Recall recibe contexto real:

**Input:**
```typescript
{
  question: string,
  recall_type: RecallType,
  student_answer: string,
  concept_ids: string[],
  concept_definitions: { term: string, definition: string }[],  // del diccionario
  source_chunk: string,   // fragmento de rawMarkdown anclado a concept_ids
  lang: string,
}
```

**Output:**
```typescript
{
  critique: string,          // qué está bien, qué falta, qué es impreciso
  suggested_answer: string,  // respuesta modelo anclada al source_chunk
  quality: "strong" | "adequate" | "partial" | "insufficient"
}
```

**Prompt:**

```
You are a Socratic tutor evaluating a student's synthesis-level response.

CONTEXT:
- Question type: {recall_type}
- Relevant concepts: {concept_definitions}
- Source material: {source_chunk}

STUDENT ANSWER: {student_answer}

OUTPUT two sections:
1. CRITIQUE: acknowledge what's right, identify gaps or inaccuracies, reference specific concepts
2. SUGGESTED ANSWER: a complete model answer grounded in the source material

Then assign QUALITY:
- strong: covers all key points accurately
- adequate: covers core points, minor gaps
- partial: gets something right but misses substantial elements  
- insufficient: fundamentally off or very incomplete

Output JSON: { critique, suggested_answer, quality }
```

**Temperatura:** 0.2 (coherencia sobre creatividad)

---

## 9. Integración downstream

### SM-2

Tras cada respuesta evaluada por el tutor:

```typescript
// Para cada concept_id de la pregunta
ingestSm2FromRecallAnswer({
  conceptId,
  quality: tutorFeedback.quality,  // → mapea a SM-2 quality 0-5
  sourceType: "recall_question",
  sessionId,
})

// Mapping quality → SM-2 score
const QUALITY_TO_SM2 = {
  strong: 5,
  adequate: 4,
  partial: 2,
  insufficient: 1,
}
```

### Assessment signals

```typescript
// Escribe en shared.assessmentSignals
for (const conceptId of question.concept_ids) {
  if (["partial", "insufficient"].includes(feedback.quality)) {
    addAssessmentSignal({ conceptId, type: "recall_weak" })
  } else {
    addAssessmentSignal({ conceptId, type: "recall_strong" })
  }
}
```

### Knowledge Vault

Añadir observation types:
- `recall_strong` → dimensión `declarative` (síntesis/relacional) o `procedural` (applicative)
- `recall_partial`, `recall_insufficient`

---

## 10. Qué retroalimenta al socrático de RSVP

Desarrollar Recall como modo limpio da la oportunidad de mejorar el socrático embebido en RSVP con el mismo patrón. Cambios mínimos que deberían llevarse a RSVP:

| Fix | Dónde | Prioridad |
|---|---|---|
| Enriquecer `deepSeekSocraticTutor` con `explanation` + `concepts[]` del bloque | `api.js` | Alta — deuda técnica clara |
| Fix assessment signals para socrático (evaluación quality del tutor → `socratic_passed/partial`) | `assessment-signals.js` | Alta — hoy siempre `wrong` |
| SM-2 ingest desde socrático de bloque usando quality del tutor | `study.js` | Media |
| Añadir `concept_id` a preguntas de bloque en schema + parser | `api.js` | Media — requiere schema change |

Estos fixes son independientes de Recall pero desbloquean la coherencia del sistema completo.

---

## 11. Dónde encaja en el flujo recomendado

Recall es el eslabón que faltaba entre exposición y retrieval:

```
Slow / RSVP (exposición)
    ↓
Recall (síntesis: "¿qué recuerdas del conjunto?")
    ↓
Cloze (retrieval atómico: "¿recuerdas este concepto específico?")
    ↓
Review (mantenimiento SM-2)
```

El recomendador (`recommender.js`) debería sugerir Recall:
- Después de RSVP si el documento tiene `argumentativeDensity ≥ 3`
- Después de Slow siempre (consolidación natural)
- Antes de Cloze si hay `assessmentSignals` escasos (para sembrarlos)

---

## 12. Qué NO hace Recall

- No tiene bloques ni packing — es el inventario entero o una sección
- No tiene preguntas MCQ — solo desarrollo abierto
- No tiene lectura RSVP previa (eso lo hace el modo RSVP)
- No tiene grafo propio — lee el grafo de `shared` si existe, no genera uno nuevo
- No reemplaza Review — Review repasa fallos específicos; Recall trabaja síntesis

---

## 13. Extensión futura

- **Scope por sección:** como el scope picker de Slow, el usuario puede vaciar solo un capítulo
- **Modo oral:** integración con Web Speech API para responder en voz alta (el tutor transcribe y evalúa)
- **Recall comparativo:** "¿en qué se diferencia este texto del que estudiaste ayer?" — cross-document, requiere multi-doc

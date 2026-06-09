# SPEC: `20260609-flow-recommendation`

**Feature**: Recomendación de flujo pedagógico  
**Estado**: Draft  
**Prioridad**: Media — UX de primer impacto, elimina fricción de decisión  
**Depende de**: `20260609-unified-session` (necesita `session.shared`), `20260609-doc-hierarchy-index` (reutiliza la llamada LLM)  
**No depende de**: ningún modo concreto — es una capa de orientación encima de ellos

---

## El problema

Cuatro modos, ninguna guía. El usuario sube un paper de Nietzsche y tiene que deducir por sí mismo que Slow Mode es lo correcto, que después debería hacer Cloze, y que Questions tiene más sentido al final que al principio. Esto no es obvio. Y cuando el material cambia (unos apuntes de macro vs un paper filosófico), la estrategia óptima cambia completamente.

La fricción de decisión no es trivial: si el usuario elige el modo equivocado, lo nota a los 5 minutos, lo cierra, y no vuelve.

---

## Lo que no es este spec

**No es un wizard bloqueante.** El usuario no tiene que responder preguntas antes de estudiar.  
**No es una restricción.** El usuario puede ignorar la recomendación y abrir cualquier modo directamente.  
**No es una llamada LLM nueva.** Reutiliza los metadatos que ya calcula `doc-hierarchy-index`.

Es un coach que dice "dado este texto, este es el camino más corto hacia aprenderlo bien" — y se aparta si el usuario quiere ir por otro lado.

---

## Arquitectura general

```
rawMarkdown
    │
    ├── analyzer.js (determinístico, sin LLM)
    │       └── TextMetrics { longitud, densidad, estructura... }
    │
    └── hierarchy.js (LLM ya existente, prompt extendido)
            └── PedagogicalMeta { genre, argumentativeDensity... }
                        │
                        ▼
                recommender.js (determinístico, sin LLM)
                        └── ModeRecommendation
                                    │
                                    ▼
                          session.shared.modeRecommendation
                                    │
                                    ▼
                          Panel de recomendación en UI
```

Dos inputs al recommender. Uno determinístico (métricas del texto), uno del LLM (metadatos pedagógicos del prompt de jerarquía). El recommender en sí es siempre determinístico — sin IA, sin ambigüedad, testeable.

---

## Parte 1: Análisis del texto

### `src/js/recommendation/analyzer.js`

Función pura que extrae métricas del markdown normalizado **sin LLM**.

```js
export function analyzeText(markdownText) → TextMetrics
```

#### `TextMetrics`

```js
{
  charCount: number,
  wordCount: number,
  estimatedReadTimeMin: number,        // wordCount / 200 (WPM media de lectura académica)

  structureSignals: {
    hasExplicitHeadings: boolean,      // hay # o ## en el texto
    headingDensity: number,            // headings por 1000 palabras
    avgParagraphLength: number,        // palabras por párrafo (media)
    longParagraphRatio: number,        // % de párrafos > 150 palabras
  },

  contentSignals: {
    hasBibliography: boolean,          // detecta patrones "(Autor, año)" o "[1]"
    hasMathNotation: boolean,          // detecta $, \frac, ∑, etc.
    hasDefinitionPatterns: boolean,    // detecta "X es...", "se denomina", "se define como"
    academicVocabDensity: number,      // ratio palabras de vocabulario académico / total
    firstPersonRatio: number,          // "yo", "nosotros" → apuntes personales
  },

  sizeCategory: 'tiny' | 'short' | 'medium' | 'long' | 'very_long',
  // tiny: <2k, short: 2-8k, medium: 8-30k, long: 30-80k, very_long: >80k
}
```

Las heurísticas no son perfectas. No tienen que serlo. Son señales que, combinadas con los metadatos del LLM, producen una recomendación razonable en el 80% de los casos.

---

### Extensión del prompt de `hierarchy.js`

La llamada LLM que ya se hace para construir el árbol jerárquico se extiende para devolver también `PedagogicalMeta`. **Sin coste adicional de llamadas.**

Se añade al prompt:

```
Además del árbol de secciones, devuelve también un objeto "pedagogical_meta" con:
- genre: uno de ["philosophical", "scientific_theoretical", "scientific_empirical",
                  "essay", "lecture_notes", "textbook_chapter", "unknown"]
- argumentative_density: entero 1-5 (1=exposición de hechos, 5=argumento filosófico puro)
- conceptual_load: entero 1-5 (1=pocos conceptos nuevos, 5=densidad terminológica alta)
- primary_learning_goal: uno de ["understand_argument", "memorize_facts",
                                   "learn_procedure", "survey_field"]
- reasoning: string, máx 20 palabras, explicando el genre detectado

El objeto "pedagogical_meta" va dentro del mismo JSON de respuesta, al mismo nivel que "tree".
```

#### `PedagogicalMeta`

```js
{
  genre: 'philosophical' | 'scientific_theoretical' | 'scientific_empirical'
       | 'essay' | 'lecture_notes' | 'textbook_chapter' | 'unknown',
  argumentativeDensity: 1 | 2 | 3 | 4 | 5,
  conceptualLoad: 1 | 2 | 3 | 4 | 5,
  primaryLearningGoal: 'understand_argument' | 'memorize_facts'
                     | 'learn_procedure' | 'survey_field',
  genreReasoning: string,     // para mostrar en UI ("Texto filosófico argumentativo con alta densidad conceptual")
}
```

Si el documento está en modo determinístico (tiene headings `#`) o modo trivial, `PedagogicalMeta` se calcula también determinísticamente desde `TextMetrics` — sin LLM. Las heurísticas en ese caso son más toscas pero suficientes.

---

## Parte 2: Lógica de recomendación

### `src/js/recommendation/recommender.js`

Función pura, completamente determinística.

```js
export function computeModeRecommendation(textMetrics, pedagogicalMeta) → ModeRecommendation
```

#### Tabla de decisión

| Condición | Flujo principal | Flujo rápido | Razón (UI) |
|-----------|----------------|--------------|------------|
| `argumentativeDensity >= 4` ó `genre == 'philosophical'` | Slow → Cloze → Revisión | RSVP → Questions | Texto argumentativo denso. La lectura profunda antes de practicar evita memorizar sin comprender. |
| `genre == 'scientific_theoretical'` y `conceptualLoad >= 3` | Slow → Cloze → Revisión | RSVP → Cloze | Alta carga conceptual. Necesitas construir el mapa antes de practicar. |
| `genre == 'scientific_empirical'` ó `hasBibliography && !isPhilosophical` | RSVP → Questions → Cloze | RSVP → Questions | Texto empírico estructurado. RSVP es eficiente aquí; Cloze para los conceptos clave. |
| `genre == 'lecture_notes'` ó `firstPersonRatio > 0.03` | RSVP → Questions | Questions | Apuntes propios: ya los procesaste una vez. Evaluación directa. |
| `genre == 'textbook_chapter'` | RSVP → Cloze → Revisión | RSVP → Questions | Manual estructurado. Lectura rápida primero, luego recuperación activa. |
| `sizeCategory == 'tiny'` | Questions | Questions | Texto corto. Evaluación directa sin pipeline completo. |
| `primaryLearningGoal == 'learn_procedure'` | RSVP → Questions | Questions | Material procedimental. Revisión estructurada es más eficiente que lectura profunda. |
| default | RSVP → Questions | Questions | Flujo conservador. |

La tabla tiene prioridad descendente: si se cumplen varias condiciones, gana la primera.

---

#### Schema de `ModeRecommendation`

```js
{
  computedAt: number,
  method: 'llm_meta' | 'deterministic',    // si usó PedagogicalMeta del LLM o solo heurísticas

  analysis: {
    genre: string,
    argumentativeDensity: number,
    conceptualLoad: number,
    estimatedReadTimeMin: number,
    genreLabel: string,         // "Texto filosófico argumentativo" — para mostrar en UI
  },

  primaryFlow: ModeStep[],
  quickFlow: ModeStep[],
  reasoning: string,            // 1-2 frases para el usuario

  // Estado de seguimiento (mutable a lo largo del estudio)
  currentStepIndex: number,     // 0 = primer paso, -1 = flujo ignorado
  completedSteps: string[],     // ids de ModeStep completados
  userOverride: boolean,        // true si el usuario eligió modo distinto al recomendado
}
```

#### Schema de `ModeStep`

```js
{
  id: string,                   // e.g. "step_slow_1"
  mode: 'rsvp' | 'slow' | 'cloze' | 'questions' | 'review',
  label: string,                // "Lectura profunda con anotaciones"
  description: string,          // "Anota lo que no entiendes, marca argumentos clave"
  estimatedTimeMin: number,     // basado en textMetrics + WPM del modo
  optional: boolean,
  completedAt: number | null,
  skippedAt: number | null,
}
```

---

## Estimación de tiempos por modo

```js
// Basado en textMetrics.wordCount y constantes por modo
const TIME_FACTORS = {
  rsvp:      words => Math.ceil(words / 400),   // ~400 WPM en RSVP
  slow:      words => Math.ceil(words / 120),   // ~120 WPM en Slow Mode (anotaciones incluidas)
  cloze:     items => Math.ceil(items * 0.5),   // estimación: ~0.5 min por ítem cloze
  questions: words => Math.ceil(words / 800),   // repaso rápido
  review:    items => Math.ceil(items * 0.3),   // revisión SM-2
}
```

Los tiempos se muestran en el panel de recomendación. Son estimaciones, no compromisos. El objetivo es que el usuario pueda tomar una decisión informada sobre el flujo según su tiempo disponible.

---

## Parte 3: Integración en sesión y UI

### En `session.shared`

```js
// Se añade al schema del spec unified-session:
shared: {
  ...
  modeRecommendation: ModeRecommendation | null,
}
```

Se calcula en el mismo momento que `docHierarchy` (después de normalizar, antes de elegir modo) y se persiste. Si el usuario ya tiene una sesión de este documento, la recomendación ya existe y no se recalcula.

Excepción: si el usuario completó pasos nuevos desde la última vez, `recommender.js` actualiza `currentStepIndex` y `completedSteps`.

---

### Panel de recomendación (contrato UI, no diseño visual)

Aparece **una sola vez** al subir un documento nuevo, o al abrir un documento existente si `currentStepIndex === 0` (no se ha comenzado ningún paso).

El panel expone:

```
[Etiqueta de género]  [Tiempo estimado flujo completo]

[Flujo recomendado visualizado como steps lineales]
  paso 1 → paso 2 → paso 3

[Razón en 1-2 frases]

[Botón primario: "Comenzar [nombre del primer paso]"]
[Botón secundario: "Ir a [modo] directamente" — desplegable con los 4 modos]
[Link texto: "¿Por qué este flujo?" — tooltip con genreReasoning]

Si tiempo limitado:
  "¿Tienes menos de [X min]? → [flujo rápido]"
```

Si el documento ya tiene pasos completados (`completedSteps.length > 0`), el panel muestra el estado del flujo en lugar de la introducción:

```
Progreso: Slow Mode ✓ → Cloze (siguiente) → Revisión

[Botón: "Continuar con Cloze"]
[X ítems SM-2 pendientes de revisión]
```

---

### Tracking de progreso

Cuándo marcar un paso como completado:

| Modo | Condición de completado |
|------|------------------------|
| `slow` | `session.modes.slow.phase === 3` y la Fase 3 fue completada |
| `rsvp` | Todos los bloques han sido leídos y el assessment final fue respondido |
| `cloze` | `session.modes.cloze.studyProgress` ≥ 80% de ítems con respuesta correcta |
| `questions` | Todos los bloques tienen al menos una pregunta respondida |
| `review` | `getSmItemsDueToday(docId).length === 0` al cerrar la sesión |

El tracking no requiere que el usuario siga el flujo recomendado. Si el usuario abrió Cloze directamente sin haber hecho Slow Mode, Cloze se marca como completado igualmente cuando cumple su condición. La recomendación no castiga las desviaciones — solo informa.

---

## Módulos nuevos

### `src/js/recommendation/analyzer.js`
Función pura `analyzeText(markdownText) → TextMetrics`. Sin dependencias externas.

### `src/js/recommendation/recommender.js`
Función pura `computeModeRecommendation(textMetrics, pedagogicalMeta) → ModeRecommendation`. Sin dependencias externas. Sin LLM. Tablas de decisión explícitas y comentadas.

### `src/js/recommendation/tracker.js`
```js
export function updateFlowProgress(recommendation, session) → ModeRecommendation
// Actualiza completedSteps y currentStepIndex según el estado actual de session.modes
// Se llama al cargar una sesión existente y al cambiar de modo

export function markStepCompleted(recommendation, stepId) → ModeRecommendation
// Llama el modo cuando detecta su condición de completado

export function recordUserOverride(recommendation, chosenMode) → ModeRecommendation
// Llama study.js cuando el usuario elige un modo distinto al recomendado
```

---

## Módulos modificados

### `src/js/normalization/hierarchy.js`
Extender el prompt LLM para devolver `pedagogical_meta`. Añadir `pedagogicalMeta` al objeto de retorno de `buildDocumentHierarchy`.

Añadir `buildDeterministicPedagogicalMeta(textMetrics) → PedagogicalMeta` para los casos sin LLM.

### `src/js/study.js`
- Al finalizar la normalización: llamar a `analyzeText` + `computeModeRecommendation`, guardar en `session.shared.modeRecommendation`
- Al montar la pantalla de selección de modo: si `modeRecommendation` existe, mostrar el panel
- Al entrar a un modo: llamar `recordUserOverride` si difiere del paso recomendado
- Al salir de un modo: llamar `updateFlowProgress`

### `src/js/session-store.js` (del spec unified-session)
Añadir `modeRecommendation: null` al schema de `SharedLayer`. Añadir `updateRecommendation(docId, recommendation)` al store.

---

## ROADMAP

### T01 — `analyzer.js`

Implementar `analyzeText`. Cubrir todas las métricas de `TextMetrics`.

Casos de test:
- Paper filosófico sin headings → `argumentativeDensity` detectada correctamente vía heurísticas
- Apuntes con primera persona → `firstPersonRatio` detectado
- Paper con citas "[1]" → `hasBibliography: true`
- Texto corto < 2k chars → `sizeCategory: 'tiny'`

**Criterio de done**: 8 tests pasando con textos de muestra de los 4 tipos principales.

---

### T02 — Extensión del prompt de `hierarchy.js`

Añadir `pedagogical_meta` al prompt. Parsear la respuesta extendida. Implementar `buildDeterministicPedagogicalMeta` como fallback.

**Criterio de done**: dado un paper filosófico, el objeto devuelto por `buildDocumentHierarchy` incluye `pedagogicalMeta.genre === 'philosophical'` y `argumentativeDensity >= 4`.

---

### T03 — `recommender.js`

Implementar la tabla de decisión. Incluir `computeStepTimes` usando `TIME_FACTORS`.

**Criterio de done**:
- Paper filosófico → `primaryFlow[0].mode === 'slow'`
- Apuntes cortos → `primaryFlow[0].mode === 'questions'`
- Texto tiny → flujo de un solo paso
- Todos los flujos producen `ModeRecommendation` válida (schema completo, no null fields)

---

### T04 — `tracker.js`

Implementar `updateFlowProgress`, `markStepCompleted`, `recordUserOverride`.

**Criterio de done**: dado un estado de sesión donde `modes.slow.phase === 3`, `updateFlowProgress` produce `completedSteps: ['step_slow_1']` y `currentStepIndex: 1`.

---

### T05 — Integración en `study.js`

Orquestar el cálculo al subir documento. Guardar en sesión. Llamar `updateFlowProgress` al cambiar de modo.

**Criterio de done**: subir un documento y verificar que `session.shared.modeRecommendation` tiene datos correctos antes de que el usuario elija modo.

---

### T06 — Panel de recomendación en UI

Implementar el panel según el contrato definido arriba.

Dos estados:
- Documento nuevo → introducción con flujo y botones
- Documento con progreso → estado del flujo con siguiente paso

**Criterio de done**: subir un paper filosófico → panel muestra "Slow Mode → Cloze → Revisión" con tiempo estimado y razón. Click en "Ir a RSVP directamente" → abre RSVP, `userOverride: true` en la recomendación.

---

### T07 — Tests de integración

- Flujo completo: subir doc → recomendación calculada → usuario sigue flujo → pasos se marcan como completados en orden
- Override: usuario elige modo distinto → `userOverride: true`, el panel no vuelve a aparecer ese día para ese documento
- Documento ya estudiado (sesión existente): panel muestra progreso, no introducción
- Estimación de tiempo: paper de 10k palabras en Slow Mode → estimación ≈ 83 min (10000/120)
- Fallback: LLM no disponible → recomendación determinística desde heurísticas de `analyzer.js` (no falla, solo es menos precisa)

---

## Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| LLM clasifica género incorrectamente | Media | La tabla de decisión tiene un `default` razonable; el usuario puede ignorar y el panel no interfiere |
| Las heurísticas del `analyzer.js` no detectan bien textos en inglés | Alta | Añadir soporte bilingüe en las listas de vocabulario académico; es configuración, no arquitectura |
| El panel de recomendación resulta molesto en el segundo o tercer uso | Alta | Mostrar solo en pantalla inicial, no al cambiar de modo; colapsar automáticamente si `currentStepIndex > 0` |
| Tiempos estimados muy desviados de la realidad | Media | Los tiempos son orientativos, no promesas; añadir "aprox." en UI; calibrar `TIME_FACTORS` con uso real |

---

## Lo que NO hace este spec

- No personaliza la recomendación según el historial del usuario (cuántas veces ha estudiado filosofía, cuánto tarda de media en Slow Mode). Eso sería una feature futura post-SM-2.
- No modifica los modos internamente según la recomendación.
- No bloquea el acceso a ningún modo.
- No aprende de los overrides del usuario (feature futura: si el usuario siempre ignora Slow Mode, dejar de recomendarlo).

---

## Criterio global de done

1. Subir un paper de Nietzsche (sin headings, ~15k chars) → panel muestra "Texto filosófico argumentativo · ~125 min flujo completo · Slow Mode → Cloze → Revisión diaria" con razón legible
2. Subir apuntes de clase (con primera persona, ~5k chars) → panel muestra "RSVP → Questions · ~20 min"
3. Subir texto de 1500 chars → panel muestra flujo de un paso, sin fanfare
4. Completar Slow Mode en el papel de Nietzsche → panel actualiza a "Slow ✓ → Cloze (siguiente)"
5. LLM no disponible → los 4 casos anteriores funcionan con recomendación menos precisa pero sin errores
# Modo Cloze Deletion — Especificación de diseño

> **Estado:** borrador v0.1  
> **Alcance:** pipeline de generación, taxonomía de ítems, estructuras de datos, principios de calidad  
> **Fuera de alcance:** UI/UX, integración de motor SR, arquitectura de red

---

## 1. Objetivo y motivación

El modo Cloze Deletion implementa **recuperación activa con reconocimiento asistido** sobre el grafo epistémico de un documento. El objetivo no es replicar Gizmo: es superar su limitación estructural más grave, que es la calidad de los huecos y la validez de los distractores.

La hipótesis de diseño central es que un ítem cloze de alta calidad opera en dos niveles simultáneamente:

- **Nivel declarativo:** fuerza la recuperación de un concepto o término concreto.
- **Nivel relacional:** al ser una oración con contexto, también activa la red de relaciones asociada al concepto.

Gizmo solo trabaja el nivel declarativo, y mal (blanquea artículos, preposiciones, verbos auxiliares). Este pipeline trabaja ambos niveles de forma deliberada, a través de dos familias de ítems: ítems de nodo (NODE) e ítems de arista (EDGE).

### Base en evidencia

- **Testing effect:** la recuperación activa produce huellas de memoria más duraderas que la relectura. El efecto es robusto en formato multiple-choice (reconocimiento) además de en free recall, contrariamente a la intuición popular. Meta-análisis de Adesope et al. (2017) con 118 estudios.
- **Cloze deletion:** la técnica fuerza la activación del contexto semántico circundante al hueco, a diferencia del Q&A aislado. Fundamento en Gestalt (principio de closure). Validado como herramienta de evaluación y aprendizaje desde Taylor (1953).
- **Desirable difficulty + Cognitive Load:** el formato multiple-choice con distractores del mismo cluster semántico mantiene la carga extrínseca baja (no hay que generar la forma de la respuesta) sin eliminar la dificultad intrínseca (hay que discriminar entre conceptos relacionados). Este equilibrio facilita el estado de flow y permite sesiones de estudio sostenidas.
- **Flow y calibración de dificultad:** el flow surge cuando la dificultad de la tarea se alinea con el nivel de habilidad (Csikszentmihalyi; confirmado en Springer Applied Cognitive Psychology, 2025). Los distractores con gradiente de plausibilidad controlan esta variable directamente.

---

## 2. Taxonomía de ítems

El modo genera dos familias de ítems: **NODE** (sobre conceptos individuales) y **EDGE** (sobre relaciones entre conceptos).

### 2.1 Familia NODE

Cada nodo del grafo puede generar hasta 4 ítems, uno por perspectiva disponible en el texto. No todos los nodos tienen todas las perspectivas: el pipeline solo genera ítems para las perspectivas representadas explícitamente en el texto fuente.

| Tipo | Descripción | Qué se blanquea | Ejemplo de oración base |
|------|-------------|-----------------|-------------------------|
| `NODE-DEF` | Definición o característica central del concepto | El nombre del concepto | "La _____ mide la sensibilidad de la demanda ante variaciones en el precio." |
| `NODE-APP` | Para qué sirve, qué mide, qué produce, cuál es su efecto | El concepto en posición de agente o instrumento | "Cuando la demanda es inelástica, los productores pueden aumentar el precio sin que la _____ caiga significativamente." |
| `NODE-COND` | Bajo qué condiciones aplica, cuándo no aplica, qué supuestos requiere | El concepto o la condición | "La _____ asume que el bien no tiene sustitutos cercanos disponibles." |
| `NODE-CONTRAST` | Cómo se diferencia de un concepto relacionado | El concepto que se diferencia | "A diferencia de la elasticidad-ingreso, la _____ relaciona precio con cantidad demandada, no renta con cantidad." |

### 2.2 Familia EDGE

Las aristas del grafo representan relaciones entre nodos. Cada arista `A → [tipo_relación] → B` puede generar hasta 3 ítems.

| Tipo | Descripción | Qué se blanquea | Ejemplo |
|------|-------------|-----------------|---------|
| `EDGE-SOURCE` | Blanquear el concepto de origen de la relación | El nodo A | "_____ implica que la curva de demanda tiene pendiente negativa." |
| `EDGE-TARGET` | Blanquear el concepto destino de la relación | El nodo B | "La ley de la demanda implica que _____." |
| `EDGE-RELATION` | Blanquear el tipo de relación entre dos conceptos conocidos | El verbo/conector que expresa la relación | "La utilidad marginal decreciente _____ que el consumidor esté dispuesto a pagar menos por cada unidad adicional." |

**Tipos de arista y su valor como ítem EDGE:**

| Tipo de arista | Valor educativo | Observaciones |
|----------------|-----------------|---------------|
| `implies` | Alto | Fuerza comprensión de consecuencias lógicas |
| `causes` | Alto | Fuerza comprensión de mecanismos causales |
| `supports` | Medio | Útil para argumentación |
| `contradicts` | Alto | Los ítems EDGE-RELATION son especialmente difíciles y valiosos |
| `defines` | Medio | Se solapa con NODE-DEF; usar solo si la definición es bidireccional |
| `exemplifies` | Bajo-medio | Útil para EDGE-SOURCE (¿qué concepto ejemplifica este ejemplo?) |
| `is_a` | Medio | Fuerza taxonomía |
| `part_of` | Medio | Fuerza estructura jerárquica |
| `prerequisite_of` | Alto | Fuerza ordenamiento conceptual |

---

## 3. Estimación de volumen

Para un texto técnico de ~12.000 caracteres (~2.400 palabras, ~8-10 páginas):

| Recurso | Estimación típica | Rango |
|---------|-------------------|-------|
| Nodos identificados | 35-50 | 20-70 |
| Nodos con importance ≥ 3 | 20-35 | 12-50 |
| Ítems NODE brutos | 60-140 | (2-4 por nodo) |
| Aristas identificadas | 20-40 | 10-60 |
| Aristas aptas para EDGE | 15-30 | |
| Ítems EDGE brutos | 30-90 | (1-3 por arista) |
| **Total bruto** | **90-230** | |
| Tasa supervivencia QA | ~55-65% | |
| **Total final estimado** | **60-120 ítems** | |

60-120 ítems a ~0.5s cada uno = 30-60 segundos de sesión de repaso puro. En práctica, los ítems HARD toman 2-4 segundos, por lo que una sesión completa dura entre 2 y 5 minutos. Este volumen es deliberado: suficiente para cubrir el material con profundidad sin generar fatiga.

**Balance de dificultad objetivo (post-QA):**

| Dificultad | % objetivo | Criterio |
|------------|------------|----------|
| EASY | 30% | Contexto ayuda, distractores diferenciados |
| MEDIUM | 50% | Requiere conocimiento real, ≥2 distractores plausibles |
| HARD | 20% | Contexto mínimo, todos los distractores son plausibles |

---

## 4. Pipeline de generación

El pipeline tiene 4-6 llamadas dependiendo de si el grafo ya existe y del tamaño del vault disponible como pool de distractores.

**Sobre chunking:** para textos de ≤15.000 caracteres (~3.750 tokens), no es necesario. El texto completo pasa en cada llamada relevante para garantizar coherencia semántica total. Chunking solo para textos >50.000 caracteres.

---

### Fase 0 — Construcción del grafo epistémico

**Condición:** skip si el grafo del documento ya existe en caché (IndexedDB o equivalente). Este modo reutiliza el grafo generado por otros modos de la aplicación; no lo construye de forma independiente.

**Si el grafo no existe:**

- Input: texto completo
- Output: grafo JSON con nodos y aristas tipadas
- 1 llamada

```json
{
  "nodes": [
    {
      "id": "node_001",
      "text": "elasticidad-precio",
      "type": "CONCEPT",
      "importance": 5,
      "semantic_cluster": "microeconomía_clásica",
      "aliases": ["elasticidad precio", "price elasticity"]
    }
  ],
  "edges": [
    {
      "id": "edge_001",
      "source_id": "node_001",
      "target_id": "node_002",
      "type": "implies",
      "sentence_context": "La elasticidad-precio implica que la demanda decrece cuando el precio sube."
    }
  ]
}
```

**Nodos con `importance < 3` se excluyen de la generación de ítems**, pero permanecen en el grafo para servir como candidatos a distractores.

---

### Fase 1 — Análisis semántico

**Input:** texto completo + grafo  
**Output:** candidatos a ítem rankeados con metadatos completos  
**Llamadas:** 1

El análisis produce dos listas:

**1a. Candidatos NODE:** nodos con `importance ≥ 3`, enriquecidos con las perspectivas disponibles en el texto.

```json
{
  "node_candidates": [
    {
      "node_id": "node_001",
      "text": "elasticidad-precio",
      "importance": 5,
      "semantic_cluster": "microeconomía_clásica",
      "perspectives_available": ["NODE-DEF", "NODE-APP", "NODE-CONTRAST"],
      "occurrences": [
        {
          "sentence": "La elasticidad-precio mide la sensibilidad...",
          "char_start": 3,
          "char_end": 21,
          "best_perspective": "NODE-DEF"
        },
        {
          "sentence": "Cuando la demanda es inelástica, los productores pueden subir precios sin que la elasticidad-precio...",
          "char_start": 82,
          "char_end": 100,
          "best_perspective": "NODE-APP"
        }
      ]
    }
  ]
}
```

**Taxonomía de importancia:**

| Nivel | Criterio de asignación |
|-------|------------------------|
| 5 | Concepto central del texto; aparece en múltiples aristas; no reemplazable por contexto |
| 4 | Término técnico específico del dominio; sin sinónimos en el texto |
| 3 | Concepto relevante; puede tener alternativas contextuales |
| 2 | Secundario; solo usar si el texto es poco denso |
| 1 | Descartar (artículos, preposiciones, verbos auxiliares, adjetivos genéricos) |

**1b. Candidatos EDGE:** aristas cuyo `sentence_context` permite construir ítems de relación coherentes.

```json
{
  "edge_candidates": [
    {
      "edge_id": "edge_001",
      "source_id": "node_001",
      "target_id": "node_002",
      "relation_type": "implies",
      "aptitude_score": 4,
      "items_possible": ["EDGE-SOURCE", "EDGE-TARGET", "EDGE-RELATION"],
      "sentence_context": "La elasticidad-precio implica que la curva de demanda tiene pendiente negativa."
    }
  ]
}
```

**Criterios de aptitud de arista (`aptitude_score` 1-5):**
- Oración contexto tiene 10-40 palabras
- Los dos conceptos no están ambos en la misma cláusula corta (demasiado obvio)
- El tipo de relación es no trivial (no `is_a` simple)
- El tipo de relación es recuperable por alguien con conocimiento del dominio

---

### Fase 2 — Generación de ítems

**Input:** texto + candidatos NODE + candidatos EDGE  
**Output:** ítems base estructurados, sin distractores todavía  
**Llamadas:** 1 (output JSON con dos secciones: `node_items` y `edge_items`)

#### 2a — Ítems NODE

Por cada candidato NODE, se genera 1 ítem por perspectiva disponible. El modelo selecciona la mejor oración del texto para cada perspectiva según estas heurísticas:

**Heurísticas de selección de oración:**

```
ORACIÓN IDEAL:
✓ 10-35 palabras sin el hueco
✓ El hueco no ocupa la primera posición de la oración
✓ La oración proporciona contexto suficiente pero no excesivo
✓ El hueco está en posición de sujeto, objeto directo, o complemento de predicado significativo
✓ Multi-word blanks permitidos si el concepto lo requiere
✓ Si no hay una oración perfecta en el texto, construir una sintéticamente cercana al original

ORACIÓN RECHAZADA:
✗ "[CONCEPTO] es [DEFINICIÓN]" — definición directa, demasiado fácil
✗ La respuesta es recuperable únicamente por tipo gramatical
✗ La oración tiene >40 palabras sin el hueco (sobrecarga cognitiva)
✗ La oración contiene la respuesta implícita en el contexto inmediato
```

**Estructura del ítem NODE:**

```json
{
  "id": "item_node_001_def",
  "item_type": "NODE-DEF",
  "node_id": "node_001",
  "semantic_cluster": "microeconomía_clásica",
  "importance": 5,
  "sentence_original": "La elasticidad-precio mide la sensibilidad de la demanda ante variaciones en el precio.",
  "sentence_with_blank": "La _____ mide la sensibilidad de la demanda ante variaciones en el precio.",
  "blank_text": "elasticidad-precio",
  "blank_char_start": 3,
  "blank_char_end": 21,
  "is_synthetic": false
}
```

#### 2b — Ítems EDGE

Por cada arista candidata, se generan los ítems posibles según los tipos identificados en el Análisis. La oración base es `edge.sentence_context`, posiblemente adaptada.

**Restricción adicional para EDGE-RELATION:** la oración debe contener ambos conceptos por nombre (no por pronombre) para que el ítem sea resoluble sin acceso al texto.

**Estructura del ítem EDGE:**

```json
{
  "id": "item_edge_001_source",
  "item_type": "EDGE-SOURCE",
  "edge_id": "edge_001",
  "source_node_id": "node_001",
  "target_node_id": "node_002",
  "relation_type": "implies",
  "semantic_cluster": "microeconomía_clásica",
  "sentence_original": "La elasticidad-precio implica que la curva de demanda tiene pendiente negativa.",
  "sentence_with_blank": "_____ implica que la curva de demanda tiene pendiente negativa.",
  "blank_text": "La elasticidad-precio",
  "blank_char_start": 0,
  "blank_char_end": 21,
  "is_synthetic": false,
  "both_concepts_visible": false,
  "visible_concept": "node_002"
}
```

---

### Fase 3 — Generación de distractores

**Input:** todos los ítems base (NODE + EDGE) + pool de distractores  
**Output:** ítems completos con 3 distractores cada uno  
**Llamadas:** 1

#### El pool de distractores

El pool tiene tres niveles de zoom, aplicados en cascada:

| Nivel | Fuente | Disponibilidad |
|-------|--------|----------------|
| L1 — Texto actual | Todos los nodos del grafo del documento | Siempre disponible |
| L2 — Grafo del vault | Nodos del vault completo filtrados por cluster semántico + cercanía en el grafo | Si el vault está disponible en sesión |
| L3 — Generación sintética | El modelo genera distractores ad-hoc cuando L1 y L2 no ofrecen suficientes candidatos válidos | Fallback |

**L2 es el nivel óptimo.** Con un vault de ~1.000+ notas, el pool semánticamente próximo es lo suficientemente rico para que los distractores sean genuinamente difíciles de descartar, sin recurrir a generación sintética. Para acceder a L2, el modelo recibe como contexto los N nodos del vault más próximos al cluster semántico del ítem (obtenidos por PageRank filtrado por cluster, o por distancia en el grafo).

#### Reglas de selección de distractores

```
REGLAS (en orden de prioridad):

1. SIEMPRE del mismo tipo semántico que la respuesta correcta
   — Si la respuesta es un CONCEPT, el distractor es un CONCEPT del mismo dominio
   — Si la respuesta es un AUTHOR, el distractor es otro AUTHOR del mismo período/escuela

2. Mismo tipo gramatical que la respuesta (sustantivo → sustantivo, etc.)

3. Longitud aproximada similar (±40% en número de tokens)
   — Previene eliminación por longitud visual

4. Gradiente de plausibilidad obligatorio:
   — Distractor A (alto): confundiría a alguien con conocimiento parcial del dominio
   — Distractor B (medio): requiere conocer la taxonomía del dominio para descartar
   — Distractor C (bajo): identificable como incorrecto con conocimiento básico

5. NUNCA sinónimos o paráfrasis de la respuesta correcta
6. NUNCA distractores de dominio claramente diferente al de la oración
7. NUNCA dos distractores del mismo sub-cluster semántico entre sí
```

**Estructura del output de distractores:**

```json
{
  "item_id": "item_node_001_def",
  "distractors": [
    {
      "text": "elasticidad-ingreso",
      "plausibility": "high",
      "source": "L1",
      "rationale": "Mismo término base, mismo dominio, confunde a quien no distingue los tipos de elasticidad"
    },
    {
      "text": "elasticidad-cruzada",
      "plausibility": "medium",
      "source": "L1",
      "rationale": "Del mismo cluster, requiere conocer la taxonomía completa para descartar"
    },
    {
      "text": "excedente del consumidor",
      "plausibility": "low",
      "source": "L2",
      "rationale": "Mismo dominio microeconómico pero semánticamente distante del concepto de elasticidad"
    }
  ]
}
```

---

### Fase 4 — QA + calibración de dificultad

**Input:** todos los ítems completos (base + distractores)  
**Output:** ítems validados con `qa_status` y `difficulty`  
**Llamadas:** 1

#### Criterios de validación

```
REJECT si cualquiera de:
  - El hueco es recuperable únicamente por tipo gramatical (el único sustantivo del cluster)
  - Hay más de una respuesta semánticamente válida en las opciones
  - Todos los distractores son descartables sin conocimiento del dominio
  - La oración contiene la respuesta implícita (el contexto la revela sin ambigüedad)
  - El ítem es EDGE y no hay suficiente contexto para determinar la dirección de la relación

WEAK si cualquiera de:
  - Un distractor es claramente descartable → sugerir reemplazo específico
  - El hueco es demasiado obvio en contexto dado el nivel MEDIUM/HARD asignado
  - La oración es sintética y su naturaleza se nota (rompe el flow del texto)

VALID si:
  - Todos los distractores son plausibles para alguien con conocimiento parcial
  - Solo una respuesta es inequívocamente correcta
  - La oración tiene contexto suficiente para que el ítem sea resoluble
```

#### Asignación de dificultad

| Nivel | Criterio |
|-------|----------|
| `easy` | El contexto reduce el espacio de respuestas. Al menos 1 distractor muy tentador. El hueco es el concepto más relevante de la oración. |
| `medium` | Requiere conocimiento real del dominio. ≥2 distractores son plausibles superficialmente. El contexto ayuda pero no revela. |
| `hard` | El contexto mínimamente ayuda. Todos los distractores son plausibles para alguien con conocimiento del dominio. Solo el conocimiento preciso permite discriminar. |

---

## 5. Estructura de datos — Ítem final

```typescript
// Tipos auxiliares
type ItemType = 
  | 'NODE-DEF' | 'NODE-APP' | 'NODE-COND' | 'NODE-CONTRAST'
  | 'EDGE-SOURCE' | 'EDGE-TARGET' | 'EDGE-RELATION'

type ConceptType = 'CONCEPT' | 'THESIS' | 'TERM' | 'AUTHOR' | 'CAUSE' | 'EFFECT'

type RelationType = 
  | 'implies' | 'causes' | 'supports' | 'contradicts' 
  | 'defines' | 'exemplifies' | 'is_a' | 'part_of' | 'prerequisite_of'

interface ClozeOption {
  text: string
  is_correct: boolean
  plausibility: 'high' | 'medium' | 'low' | null  // null para la opción correcta
  source: 'L1' | 'L2' | 'L3' | null               // null para la opción correcta
  rationale?: string                                // por qué este distractor es plausible
}

interface ClozeItem {
  // Identificación
  id: string                          // "item_node_001_def"
  document_id: string
  item_type: ItemType
  
  // El ítem
  sentence_original: string           // oración del texto sin modificar
  sentence_with_blank: string         // con _____ en lugar del concepto
  blank_text: string                  // la respuesta correcta
  blank_char_start: number            // offset en sentence_original
  blank_char_end: number
  is_synthetic: boolean               // true si la oración fue adaptada, no extraída literal
  
  // Metadatos del concepto (NODE)
  node_id?: string
  concept_type?: ConceptType
  importance: 1 | 2 | 3 | 4 | 5
  semantic_cluster: string
  
  // Metadatos de la relación (EDGE)
  edge_id?: string
  source_node_id?: string
  target_node_id?: string
  relation_type?: RelationType
  visible_concept?: string            // id del nodo visible cuando blank = source o target
  
  // Las 4 opciones (shuffled al servir)
  options: ClozeOption[]              // siempre 4: 1 correcta + 3 distractores
  
  // Calibración
  difficulty: 'easy' | 'medium' | 'hard'
  
  // Feedback post-respuesta
  explanation?: string                // generado en llamada opcional adicional
  
  // QA
  qa_status: 'valid' | 'weak' | 'rejected'
  qa_notes?: string                   // solo para weak/rejected
  
  // Motor SR (se populan con uso)
  times_shown: number
  times_correct: number
  last_shown?: Date
  next_review?: Date                  // para integración con SR
  sm2_easiness_factor?: number        // EF inicial: 2.5
  sm2_interval?: number               // días hasta próxima revisión
}
```

---

## 6. Resumen del pipeline de llamadas

| Fase | Condición | Llamadas | Input clave | Output |
|------|-----------|----------|-------------|--------|
| 0 — Grafo | Solo si no existe en caché | 0-1 | Texto completo | Grafo JSON |
| 1 — Análisis semántico | Siempre | 1 | Texto + grafo | Candidatos NODE + EDGE rankeados |
| 2 — Generación de ítems | Siempre | 1 | Texto + candidatos | Ítems base NODE + EDGE sin distractores |
| 3 — Distractores | Siempre | 1 | Ítems base + pool | Ítems completos con 3 distractores |
| 4 — QA | Siempre | 1 | Ítems completos | Ítems validados con dificultad |
| **Total** | | **4–5** | | **60-120 ítems** |

**Estimación de tokens por llamada (texto 12k chars, ~3k tokens):**

| Fase | Input est. | Output est. |
|------|-----------|------------|
| 0 (si aplica) | ~4k | ~1.5k |
| 1 | ~5k | ~3k |
| 2 | ~5k | ~6k |
| 3 | ~8k | ~5k |
| 4 | ~8k | ~2k |
| **Total** | **~26-30k** | **~17-18k** |

Con DeepSeek V3 (~$0.27/M tokens input, ~$1.10/M output): coste por documento **< $0.03**. Con Claude Sonnet: **< $0.15**. Coste negligible.

---

## 7. Principios de calidad del ítem — resumen operativo

Un ítem válido satisface **todos** estos criterios:

1. **El hueco tiene valor cognitivo:** su ausencia impide la comprensión del significado de la oración.
2. **Una sola respuesta correcta:** no hay sinónimos ni paráfrasis válidas entre los distractores.
3. **Contexto suficiente pero no excesivo:** la oración permite resolver el ítem con conocimiento, pero no lo revela sin él.
4. **Distractores del mismo universo:** todos los distractores son conceptos reales del dominio, no inventados ni de dominios ajenos.
5. **Gradiente de plausibilidad:** los 3 distractores forman un espectro. El más tentador (plausibility: high) confunde incluso a alguien con conocimiento parcial.
6. **Independencia gramatical:** el ítem no puede resolverse descartando opciones por tipo gramatical, género, número, o longitud visual.

---

## 8. Decisiones de arquitectura y razonamiento

**¿Por qué 4 llamadas separadas en lugar de 1-2?**

Cada fase tiene un objetivo cognitivo diferente que se degrada cuando se combina con otro. La Fase 3 (distractores) necesita ver el pool completo de conceptos y aplicar reglas de selección complejas; si se combina con la Fase 2, el modelo tiende a generar distractores genéricos porque parte de su capacidad de atención está en construir las oraciones base. Las fases separadas permiten prompts con criterios muy específicos y contexto limpio.

**¿Por qué no chunking para 12k chars?**

El contexto semántico cruzado entre partes del texto es esencial para la calidad. Un distractor que aparece en la parte B del texto es ideal para un ítem de la parte A: el modelo necesita ver ambas partes simultáneamente. El chunking fragmentaría este contexto y degradaría la calidad de los distractores.

**¿Por qué ítems EDGE además de ítems NODE?**

Los ítems NODE solos recuperan conceptos aislados. Los ítems EDGE son lo que fuerza la comprensión de la estructura del conocimiento: las relaciones causales, las implicaciones, los contrastes. Un estudiante que sabe todos los nodos pero no las aristas no puede razonar dentro del dominio. Los ítems EDGE son cognitivamente más exigentes y son los que Gizmo no hace en absoluto.

**¿Por qué varias perspectivas por nodo (NODE-DEF, NODE-APP, etc.)?**

Un concepto bien aprendido se activa desde múltiples ángulos: su definición, su aplicación, sus condiciones de uso, su posición en el contraste con otros conceptos. Generar un único ítem por concepto (NODE-DEF) produce conocimiento frágil: el estudiante reconoce la definición pero no puede aplicar el concepto ni diferenciarlo de similares. Las perspectivas múltiples construyen representaciones más robustas.

**¿Por qué L2 (vault global) para los distractores?**

El pool del texto solo (~30-50 nodos) es frecuentemente insuficiente para el distractor de plausibilidad alta. El vault completo, filtrado por cluster semántico y cercanía en el grafo, ofrece conceptos del mismo dominio que no aparecen en el texto actual pero que el estudiante conoce o debería conocer. Estos son los mejores distractores: conceptos reales, del mismo campo, que se confunden genuinamente con el correcto.

**Sobre la integración con el motor SR**

Los campos `next_review`, `sm2_interval` y `sm2_easiness_factor` permiten que los ítems generados entren directamente en el motor de repetición espaciada de la aplicación. El modo Cloze Deletion no es entonces solo un modo de "primera exposición": es un motor de consolidación a largo plazo. La separación entre `times_shown` y `next_review` permite además identificar ítems fallados consistentemente para revisión manual o regeneración.

---

*Fin del documento. Próximos pasos: diseño de prompts exactos por fase, esquemas de validación Zod, integración con la arquitectura actual (grafo IndexedDB, pipeline de análisis existente), diseño UI/UX del modo.*

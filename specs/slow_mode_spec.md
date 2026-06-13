# Slow Mode — Especificación de Diseño
### Pith · Módulo de Lectura Profunda

> *Versión 1.0 — Junio 2025*

---

## Índice

1. [Motivación y contexto](#1-motivación-y-contexto)
2. [Fundamentos científicos](#2-fundamentos-científicos)
3. [Arquitectura general](#3-arquitectura-general)
4. [Fase 0 — Orientación previa](#4-fase-0--orientación-previa)
5. [Fase 1 — Lectura activa](#5-fase-1--lectura-activa)
6. [Fase 2 — Checkpoints de sección](#6-fase-2--checkpoints-de-sección)
7. [Fase 3 — Consolidación post-lectura](#7-fase-3--consolidación-post-lectura)
8. [Sistema de anotaciones](#8-sistema-de-anotaciones)
9. [Lectura crítica y modo debate](#9-lectura-crítica-y-modo-debate)
10. [IA durante la lectura](#10-ia-durante-la-lectura)
11. [Capa de gamificación](#11-capa-de-gamificación)
12. [Diseño de interfaz](#12-diseño-de-interfaz)
13. [Cuándo usar Slow Mode vs RSVP](#13-cuándo-usar-slow-mode-vs-rsvp)
14. [Decisiones de diseño abiertas](#14-decisiones-de-diseño-abiertas)
15. [Glosario de términos técnicos](#15-glosario-de-términos-técnicos)

---

## 1. Motivación y contexto

### El problema con el modo RSVP para ciertos textos

El modo RSVP de Pith está diseñado para maximizar throughput cognitivo: ingesta rápida de contenido ya estructurado, con bloques pre-generados, preguntas post-bloque e iteración por spaced repetition. Para apuntes, resúmenes y material factual, este pipeline es eficiente.

Sin embargo, existe una clase de textos para los que el RSVP no solo es subóptimo sino activamente contraproducente:

- **Fuentes primarias filosóficas** (Kant, Wittgenstein, Rawls, etc.)
- **Textos argumentativos densos** donde la forma retórica es parte del contenido
- **Ensayos con estructura no lineal** que requieren releer secciones anteriores para interpretar las posteriores
- **Textos literarios** donde el ritmo y el lenguaje importan
- **Papers de investigación** con argumentación compleja y alta densidad conceptual

Para estos textos, el RSVP comete tres errores estructurales:

1. **Destruye la estructura retórica.** El pipeline PDF → chunks → bloques pre-generados extrae *qué* se dice y destruye *cómo* se dice. En filosofía, el movimiento argumentativo *es* el contenido. Fragmentar eso en bloques de 150 palabras es como estudiar música leyendo las letras de las canciones.

2. **Convierte al lector en consumidor.** Los bloques pre-generados por IA hacen el trabajo intelectual de estructurar el argumento. El lector recibe una representación ya elaborada en lugar de construirla. La evidencia científica es inequívoca: construir > consumir, siempre, en retención y comprensión profunda.

3. **Elimina el control metacognitivo.** RSVP a velocidad fija impide ralentizar donde el argumento es denso, releer la premisa anterior al encontrar la conclusión, o saltar hacia adelante para ver a dónde va el texto antes de comprometerse con un detalle. Para textos argumentativos, esa flexibilidad es fundamental.

### La observación que motivó este diseño

Al leer fuentes primarias filosóficas de forma tradicional — subrayando, añadiendo comentarios en los márgenes, leyendo a ritmo propio — la comprensión resultó ser superior a la obtenida con el pipeline RSVP estándar. Esto no es un caso aislado ni una anomalía: es completamente consistente con la evidencia científica sobre lectura de textos argumentativos complejos.

El Slow Mode no reemplaza al RSVP. Coexiste con él. El usuario decide qué modo usar según la naturaleza del texto.

---

## 2. Fundamentos científicos

Esta sección documenta la base empírica de cada decisión de diseño. No es decorativa: cada feature del Slow Mode está justificada en investigación con efect sizes conocidos.

### 2.1 El generation effect (Slamecka & Graf, 1978)

**Qué dice:** El material que el lector *produce* — parafrasear, completar, transformar — se recuerda significativamente mejor que el material que simplemente se lee.

**Magnitud:** Meta-análisis de 86 estudios (445 effect sizes) reporta d ≈ 0.40.

**Implicación de diseño:** Cualquier acto de anotación que requiera generar texto propio (paráfrasis, explicación, conexión) activa el generation effect. Los highlights puros no lo activan. El Slow Mode maximiza oportunidades de generación y las estructura por tipo.

### 2.2 El self-explanation effect (Chi et al.)

**Qué dice:** Generar explicaciones para uno mismo sobre qué significa un enunciado, cómo se sigue de lo anterior, y cómo conecta con el conocimiento previo produce comprensión profunda y transferencia.

**Magnitud:** Meta-análisis de Bisra et al. (64 estudios, ~6000 participantes): g ≈ 0.55. Algunos subconjuntos reportan g ≈ 1.08 bajo condiciones óptimas.

**Implicación de diseño:** Las anotaciones de tipo "auto-explicación" son el tipo más valioso del sistema. El depth score las pondera más alto. La IA las solicita explícitamente en checkpoints.

### 2.3 Elaborative interrogation (Pressley et al.)

**Qué dice:** Responder "¿Por qué es verdad esto?" para cada proposición del texto conecta la información nueva con el conocimiento previo y construye vínculos causales y explicativos.

**Magnitud:** d ≈ 0.35–0.45 en syntheses tipo Hattie. Estudios individuales varían ampliamente.

**Caveat importante:** O'Reilly, Symons & MacLatchy-Gaudet muestran que la self-explanation supera a la elaborative interrogation en textos complejos, porque el simple "¿por qué?" es demasiado estrecho cuando la tarea exige integrar significado, estructura y conocimiento previo. La EI es más útil en puntos específicos de inferencia, no como modo por defecto.

**Implicación de diseño:** Las preguntas "¿por qué?" son útiles en *bottlenecks* argumentativos (transiciones no evidentes, premisas implícitas, apelaciones a intuición), no en cada línea.

### 2.4 Limitaciones del RSVP para texto complejo

**Estudios clave:**

- **Boo & Conklin (2015):** Textos IELTS-style (~400-500 palabras). Comprensión en lectura auto-paced: ~76%. RSVP a 500 wpm: ~55%. Diferencia estadísticamente significativa tanto para preguntas de gist como de detalle.
- **Benedetto et al. (2015):** Comparación Spritz vs lectura tradicional (capítulo de Orwell). Comprensión literal: 60% (Spritz) vs 72% (tradicional). Velocidad: sin diferencia. Carga cognitiva: significativamente mayor en Spritz.
- **American Journal of Psychology (2017):** "Modern Speed-Reading Apps Do Not Foster Reading Comprehension." Para textos de nivel 12º grado, RSVP es marcadamente peor, especialmente en preguntas de integración.

**Por qué falla el RSVP en textos complejos:**

1. **Elimina las regresiones.** 10–25% de los movimientos oculares naturales durante la lectura son regresiones — saccadas hacia atrás para reparar comprensión. Son herramientas funcionales, no malos hábitos. Schotter et al. demostraron que cuando se impide hacer regresiones útiles (trailing masking), la comprensión cae significativamente incluso para frases no ambiguas.

2. **Elimina el anclaje espacial.** Los lectores recuerdan *dónde en la página* estaba la información clave. Ese anclaje permite relocalizar una premisa introducida hace tres párrafos cuando la conclusión la invoca. RSVP es espacialmente amnésico.

3. **Impide el control metacognitivo.** Cuando el lector se confunde en el word N, el word N+10 ya ha desaparecido. La capacidad de detectar confusión y desplegar relectura es un proceso metacognitivo central. RSVP rompe el feedback loop.

### 2.5 Efectos de las interrupciones en la comprensión profunda

**Foroughi et al.:** Interrupciones de 15 segundos entre párrafos redujeron significativamente el rendimiento en preguntas de integración (temas, tono, intenciones del autor) pero *no* en reconocimiento de hechos. Añadir un buffer de 15 segundos *antes* de la interrupción eliminó el efecto negativo.

**Implicación de diseño:** Las interrupciones deben ocurrir en límites naturales del texto (fin de sección, fin de argumento), nunca mid-párrafo. El usuario debe poder ignorar cualquier interrupción propuesta.

**Notificaciones:** Recibir una notificación de móvil — aunque no se responda — aumenta errores de comisión y ralentiza la atención en tareas de atención sostenida. El Slow Mode activa focus mode automáticamente.

### 2.6 Advance organizers y estructura previa

**Advance organizers (Ausubel):** Meta-análisis en Visible Learning MetaX (10 meta-análisis, 901 estudios, 2191 efectos): d ≈ 0.42 en aprendizaje y retención.

**Estructura argumental previa:** Conocer la estructura de un texto argumentativo antes de leerlo (claim-reasons-evidence-counterarguments) mejora la capacidad de localizar y organizar argumentos. Estudios con graphic organizers argumentativos como pre-reading tool muestran mejoras en identificación de argumentos y contraargumentos.

**Estudio PNAS Nexus (GPT-4 summaries):** Lectores que recibieron previews generados por IA mostraron mejor comprensión y produjeron resúmenes más detallados y precisos que lectores que recibieron previews escritos por humanos. La comparación era AI vs human, no vs ningún preview.

**Implicación de diseño:** La Fase 0 genera automáticamente una orientación estructural antes de abrir el texto. No es opcional — aparece siempre, aunque se puede colapsar.

### 2.7 Gamificación y lectura

**Qué funciona:**
- Quests narrativas donde avanzar *requiere* comprensión: d ≈ 0.49 (MISSIONS WITH MONTY, n=186).
- Sistemas de anotación gamificada con niveles por calidad: +47% en comprensión (cuatro semanas, high school).
- Recompensas competenciales (desbloqueo de capacidades) > recompensas tangibles.
- Estructuras colaborativas y de discovery.

**Qué falla (overjustification effect):**
- Recompensas tangibles y salientes por volumen de lectura: reducen lectura extrínseca en lectores ya motivados intrínsecamente (Read-A-Million-Minutes study, Iowa).
- Puntos por páginas, minutos o libros leídos sin evaluar comprensión.
- Leaderboards públicos → ansiedad, elección estrecha de textos, pérdida de interés post-programa.

**Implicación de diseño:** El game loop es la comprensión, no el volumen. Los rewards son competenciales e internos (desbloqueo de vistas, feedback de calidad), nunca tangibles ni públicos.

### 2.8 IA durante la lectura

**RCT con tutores IA (n=334, economía universitaria):** Tres condiciones durante 25 minutos de estudio:
1. Solo textbook.
2. Tutor IA disponible después de 10 minutos ("restricted").
3. Tutor IA disponible desde el inicio ("unrestricted").

Resultados en test incentivizado posterior:
- Cualquier acceso a tutor IA: +0.23 SD vs solo textbook.
- Unrestricted vs restricted: +0.21 SD adicional (total: +0.34 SD vs control).

Comportamiento observado: los estudiantes con acceso irrestricto *igualmente* leyeron varios minutos antes de su primera query, luego aumentaron el uso gradualmente con prompts cortos. Los del grupo restricted acumularon confusiones y las descargaron en un spike de queries largas al desbloquearse — consistente con mayor carga de working memory.

**Implicación de diseño:** La IA durante la lectura es beneficiosa si es on-demand, anchored al texto y contextualmente limitada. El modelo Kindle X-Ray + Perlego "Ask the Book" es el referente de UX.

---

## 3. Arquitectura general

El Slow Mode tiene cuatro fases secuenciales. Las Fases 0 y 3 son gestionadas por IA. Las Fases 1 y 2 son del usuario, con IA disponible bajo demanda.

```
┌─────────────────────────────────────────────────────────────┐
│                     SLOW MODE PIPELINE                      │
│                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌──────────┐           │
│  │ FASE 0  │───▶│    FASE 1    │───▶│  FASE 2  │───▶ ···   │
│  │ Orienta-│    │ Lectura      │    │ Checkpoint│           │
│  │ ción IA │    │ activa       │    │ (opcional)│           │
│  │ (2-3min)│    │ (tú lees)    │    │           │           │
│  └─────────┘    └──────────────┘    └──────────┘           │
│                        │                   │                │
│                        └────────┬──────────┘                │
│                                 ▼                           │
│                          ┌──────────┐                       │
│                          │  FASE 3  │                       │
│                          │ Consoli- │                       │
│                          │ dación   │                       │
│                          └──────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

**Principios transversales:**

- **Generación sobre consumo:** Cada feature favorece que el usuario produzca representaciones, no que reciba representaciones ya elaboradas.
- **IA que scaffoldea, no que sustituye:** La IA orienta, estructura y da feedback, pero nunca hace el trabajo cognitivo del lector.
- **Interrupciones en límites naturales:** Ninguna interrupción propuesta ocurre mid-párrafo.
- **Control absoluto del ritmo:** El usuario puede ir hacia adelante y hacia atrás sin restricción.
- **Foco sin distracciones:** Focus mode automático durante Fase 1.

---

## 4. Fase 0 — Orientación previa

### Propósito

Activar el schema relevante y proporcionar un mapa argumental antes de que el usuario toque el texto. Basado en la evidencia de advance organizers (d ≈ 0.42) y en la investigación sobre estructura argumentativa previa.

### Cuándo ocurre

Automáticamente al abrir cualquier texto en Slow Mode, antes de mostrar el documento. No es saltable en la primera lectura; sí es colapsable en lecturas posteriores del mismo texto.

### Qué genera la IA

El output de la Fase 0 tiene cinco bloques estructurados:

---

**BLOQUE 1 — TESIS**

Una sola frase que encapsula qué quiere que el lector acepte al terminar el texto. No es un resumen del contenido: es la *conclusión* que el texto intenta establecer.

```
TESIS
"[El autor] argumenta que [conclusión], 
fundamentándose en [núcleo del argumento]."
```

---

**BLOQUE 2 — MAPA ARGUMENTAL**

Representación esquemática de la estructura lógica del texto. Para textos filosóficos, este mapa es la feature más valiosa de toda la Fase 0.

```
MAPA ARGUMENTAL

P1: [Premisa 1]
    └── Estado: [argumentada / dada por sentada / apoyada en intuición]

P2: [Premisa 2]  
    └── Estado: [argumentada / dada por sentada / apoyada en intuición]

I:  [Inferencia — nexo entre premisas y conclusión]
    └── Nexo causal: [explícito / implícito / asumido]

C:  [Conclusión]

Objeciones anticipadas por el autor: [sí/no — cuáles]
```

---

**BLOQUE 3 — CONCEPTOS A BUSCAR ACTIVAMENTE**

Entre 3 y 5 conceptos clave que el texto usa de forma técnica, redefinida o ambigua. Enlazados al diccionario de conceptos del grafo ya existente cuando aplica.

```
BUSCA ACTIVAMENTE
· [Concepto 1] — cómo lo usa este autor: [definición específica]
· [Concepto 2] — posible tensión con uso estándar
· [Concepto 3] — pivote argumentativo central
```

---

**BLOQUE 4 — PREGUNTA ABIERTA**

Una sola pregunta que el texto intenta responder. Debe ser lo suficientemente amplia para no producir attentional spotlight (tunnel vision hacia un detalle), pero lo suficientemente específica para orientar la lectura.

```
PREGUNTA GUÍA
¿[Pregunta que el texto responde]?
```

---

**BLOQUE 5 — PUNTOS ESTRUCTURALMENTE DÉBILES** *(solo en modo crítico activado)*

Si el usuario tiene activado el Modo Crítico (ver sección 9), la Fase 0 incluye un bloque adicional:

```
PARA EXAMINAR CRÍTICAMENTE
· [Premisa X] no está argumentada en el texto — evalúa si el autor lo justifica
· El nexo entre [P2] y [C] requiere asumir [premisa implícita] — ¿la establece?
· Este tipo de argumento es históricamente atacado en [punto Y]
```

Este bloque no dice "el texto es débil aquí" — dice "aquí es donde tienes que prestar atención crítica". La evaluación es del usuario.

---

### Interacción del usuario con la Fase 0

- El usuario puede añadir sus propias prequestions antes de empezar a leer.
- Puede editar el mapa argumental si ya conoce el texto o tiene contexto previo.
- Puede marcar conceptos adicionales del diccionario que quiere rastrear.
- Al terminar de leer (Fase 3), se puede comparar el mapa de Fase 0 con lo que realmente encontró.

---

## 5. Fase 1 — Lectura activa

### Propósito

El núcleo del Slow Mode. El usuario lee el texto a su propio ritmo, produciendo anotaciones. La IA está disponible bajo demanda pero nunca empuja.

### Layout de la interfaz

```
┌─────────────────────────────────┬──────────────────────┐
│                                 │   SIDEBAR            │
│   TEXTO PRINCIPAL               │   (colapsable)       │
│                                 │                      │
│   · Paginado (no scroll inf.)   │   Mis anotaciones    │
│   · Tipografía ajustable        │   ─────────────────  │
│   · Sin elementos visuales      │   ≈ Paráfrasis (3)   │
│     en la columna de texto      │   ? Preguntas (2)    │
│   · Barra de progreso           │   ⊘ Sin justif. (1)  │
│     discreta en el margen       │                      │
│                                 │   Diccionario        │
│                                 │   ─────────────────  │
│                                 │   [conceptos del     │
│                                 │    grafo]            │
│                                 │                      │
│                                 │   [Preguntar a IA]   │
│                                 │   colapsable         │
└─────────────────────────────────┴──────────────────────┘
```

**Decisiones clave de UX:**

- **Paginado, no scroll infinito.** La investigación de eye-tracking muestra que el scroll continuo introduce regresiones navegacionales (buscar el lugar donde estaba el lector) que no son de comprensión, solo overhead cognitivo. Las páginas fijas dan anclaje espacial y permiten el sistema de memoria "estaba en la mitad izquierda de la página 3" que facilita la relocalización de premisas anteriores.

- **Sidebar colapsable por defecto.** Visible en el 20% derecho de la pantalla con una pestaña discreta. Se expande al tocar. Durante lectura concentrada, el usuario puede colapsarla completamente para tener solo el texto.

- **Focus mode automático.** Al entrar en Fase 1, se silencian notificaciones del sistema operativo y se ocultan todos los elementos de UI no esenciales. La barra de progreso es el único elemento siempre visible, y es discreta (barra fina en el borde del documento).

- **Acceso libre a regresiones.** El usuario puede navegar hacia cualquier página anterior sin restricción. El sistema recuerda la posición y vuelve a ella.

### Interacción con el texto

**Seleccionar un fragmento de texto** despliega un menú micro de una sola línea:

```
[≈ Parafrasear]  [? Pregunta]  [→ Explicar]  [★ Bueno]  [⊘ Sin justif.]  [···]
```

El `···` expande a los tipos secundarios de anotación (ver sección 8 completa).

**Cada tipo de anotación abre un campo de texto mínimo** anclado al fragmento seleccionado. El campo se cierra al confirmar. La anotación queda visible como una pequeña marca tipográfica en el margen (no inline en el texto).

**Gestos adicionales:**
- Long-press en una anotación propia → editarla o cambiar su tipo.
- Long-press en cualquier palabra → acceso al diccionario de conceptos del grafo (sin salir del texto).
- Swipe lateral en la página → avanzar o retroceder de página.

### La IA durante Fase 1

La IA está disponible en todo momento a través de la sección "Preguntar a IA" del sidebar. **Nunca empuja mensajes, nunca interrumpe.**

**Modelo de interacción:** Kindle X-Ray + Perlego "Ask the Book"

- Responde solo sobre texto ya leído (páginas anteriores y la actual).
- No hace spoilers de secciones no alcanzadas aún.
- Las respuestas son breves, en overlay o panel lateral, dismissables con un swipe.
- Tras responder, el texto vuelve al foco automáticamente.
- Las queries del usuario y las respuestas de IA se guardan como anotaciones de tipo especial.

**Cuándo es especialmente útil la IA en Fase 1:**
- Cuando el usuario marca `⚑ No entiendo` — la IA puede ofrecer una explicación contextual inmediata.
- Cuando hay un concepto técnico no en el diccionario del grafo — la IA lo define en contexto.
- Cuando el usuario quiere el steel man de una premisa antes de criticarla.
- Cuando el usuario anota `⇑ Necesito el mejor argumento para esto`.

**Lo que la IA NO hace en Fase 1:**
- No resume secciones que el usuario aún no ha leído.
- No genera el argumento del texto por el usuario.
- No califica anotaciones en tiempo real (eso ocurre en Fase 3).
- No interrumpe con preguntas propias ni checkpoints (eso es Fase 2).

---

## 6. Fase 2 — Checkpoints de sección

### Propósito

Consolidación liviana al final de cada sección o argumento completo, sin interrumpir el flujo de lectura dentro de una sección.

### Cuándo aparece

Al final de cada sección marcada estructuralmente (por la IA en Fase 0 o detectada por cambios de heading), aparece un chip discreto en el margen inferior del texto:

```
[≡ CHECKPOINT · 30 seg]
```

**Es completamente dismissable** con un swipe. El usuario en flow lo ignora; el usuario que quiere estructura lo activa.

### Qué contiene el checkpoint

**Exactamente una** pregunta de integración, generada desde el mapa argumental de Fase 0, no desde detalles factuales:

- ✓ "¿Cómo conecta este argumento con la premisa que el autor estableció en la sección anterior?"
- ✓ "¿Qué asume el autor aquí que no asumía al principio?"
- ✗ "¿Quién es el autor de la cita del párrafo 3?"
- ✗ "¿Cuántos argumentos presenta esta sección?"

El usuario responde en texto libre (mínimo, no hay longitud mínima). La respuesta se guarda como anotación de tipo `→ Auto-explicación` y alimenta las preguntas de Fase 3.

### El buffer de 15 segundos

Basado en Foroughi et al.: al llegar al final de la sección, el checkpoint no aparece inmediatamente. Hay una micro-pausa de ~10 segundos (el usuario sigue viendo la última página de la sección) antes de que el chip aparezca. Esto da tiempo a que los procesos de integración completen sin interrupción abrupta.

---

## 7. Fase 3 — Consolidación post-lectura

### Propósito

Retrieval practice, integración al grafo, y generación de material de revisión desde las propias anotaciones del usuario. La Fase 3 es la más importante para la retención a largo plazo.

### Los tres módulos (elegibles)

---

**MÓDULO A — Revisión argumental**

La IA toma el mapa de Fase 0 y lo superpone con las anotaciones del usuario:

```
MAPA ARGUMENTAL — REVISIÓN

P1: [Premisa 1] ──── ✓ Encontrada (página 3, tu anotación: "≈ ...")
P2: [Premisa 2] ──── ✗ No anotada — estaba en página 7, párrafo 2
I:  [Inferencia] ─── ✓ Marcada con ↯ (cuestionaste el nexo)
C:  [Conclusión] ─── ✓ Anotada con → (explicaste en tus palabras)

Conceptos rastreados: 3/5
  · [Concepto 1] ✓   · [Concepto 2] ✓   · [Concepto 3] ✓
  · [Concepto 4] ✗   · [Concepto 5] ✗

Puntos débiles identificados: 2 de 3 anticipados
  · ⊘ [Premisa sin justificar] ─── ✓ Encontraste esto
  · ↯ [Gap de inferencia]      ─── ✓ Encontraste esto
  · ⚠ [Posible equivocación]   ─── ✗ No anotaste este punto
```

**Importante:** Esto no es una calificación de rendimiento. Es un mapa de correspondencia entre la representación mental del usuario y la estructura real del texto. Los elementos no encontrados son oportunidades de revisión, no puntuaciones negativas.

---

**MÓDULO B — Preguntas desde tus anotaciones**

La IA genera preguntas de retrieval practice específicamente desde las anotaciones del usuario, no desde el texto abstracto. Esto es fundamental: las preguntas ancladas a las propias representaciones mentales del lector son más efectivas que las preguntas genéricas sobre el texto.

**Lógica de generación por tipo de anotación:**

| Tipo de anotación | Tipo de pregunta generada |
|---|---|
| `≈ Paráfrasis` | "Explica [concepto] sin usar las palabras del texto" |
| `? Pregunta propia` | La propia pregunta del usuario, como pregunta de retrieval |
| `→ Auto-explicación` | La explicación del usuario como anverso; el concepto como reverso |
| `⊘ Sin justificar` | "¿Cómo respondería el autor a la objeción de que [X] no está argumentado?" |
| `↯ Gap de inferencia` | "¿Qué premisa implícita necesitaría el argumento para ser válido?" |
| `⚠ Falacia` | "¿Cuál es la forma correcta de hacer este argumento?" |
| `★ Buena jugada` | "¿Por qué este movimiento argumentativo es sólido?" |
| `⇑ Steel man` | "Formula el argumento más fuerte posible para [X]" |

---

**MÓDULO C — Integración al grafo**

Las anotaciones del usuario entran al grafo de conocimiento como nodos de primera clase, diferenciados del contenido del texto:

- Nodos del texto: color primario, etiqueta `[Texto]`
- Nodos del usuario: color secundario, etiqueta `[Pedro:]`
- Las conexiones `⟷` creadas durante la lectura se convierten en edges con tipo de relación

**Consecuencia:** El grafo ahora tiene dos capas:
1. Lo que dice el autor.
2. Lo que el usuario piensa sobre ello.

Las anotaciones críticas (`⊘`, `↯`, `⚠`) crean edges de tipo `"cuestiona"` o `"refuta"` entre el nodo del texto y el nodo de la objeción del usuario. Esto es filosóficamente relevante: el grafo captura no solo contenido sino posiciones críticas.

**Conversión a flashcards:** Las anotaciones de tipo `→` y `≈` pueden convertirse en tarjetas para el sistema de spaced repetition con un tap. Las de tipo `⊘` y `↯` con su especificación completa también, con la pregunta "¿qué faltaría para que este argumento fuera válido?".

---

### El "abogado del diablo" inverso

Para cada anotación crítica `⊘`, `↯` o `⚠` que el usuario dejó, la Fase 3 incluye una pregunta específica:

> *"Marcaste que [premisa X] no está argumentada. ¿Cómo respondería [el autor] a esta objeción? Formula su mejor defensa antes de evaluar si hay respuesta en el texto."*

Esto cierra el loop: el debate real no es solo identificar debilidades sino anticipar réplicas. Si el usuario puede formular la réplica del autor a su propia objeción, ha entendido el texto a un nivel que ningún modo pasivo alcanzará.

---

## 8. Sistema de anotaciones

El sistema de anotaciones es el corazón del Slow Mode. Cada tipo activa mecanismos cognitivos específicos con efect sizes conocidos. La lista completa:

### Tipos primarios

| Símbolo | Nombre | Qué hace el usuario | Mecanismo cognitivo activado |
|---------|--------|---------------------|------------------------------|
| `≈` | Paráfrasis | Reescribe el fragmento en sus propias palabras | Generation effect (d ≈ 0.40) |
| `?` | Pregunta propia | Formula una pregunta sobre el fragmento | Elaborative interrogation |
| `→` | Auto-explicación | Explica cómo se sigue esto de lo anterior, o qué significa en el contexto del argumento | Self-explanation effect (g ≈ 0.55) |
| `⟷` | Conexión | Enlaza el fragmento con otro concepto del grafo o texto anterior | Relational encoding |
| `⚑` | No entiendo | Marca confusión — desencadena oferta de ayuda de IA | Metacognitive monitoring |

### Tipos críticos *(principales en modo debate/filosofía)*

| Símbolo | Nombre | Qué hace el usuario | Descripción |
|---------|--------|---------------------|-------------|
| `⊘` | Premisa sin justificar | Especifica qué tipo de justificación faltaría | "El autor asume X. Para aceptarlo necesitaría [evidencia / argumento deductivo / intuición pump explicitada]" |
| `↯` | Gap de inferencia | Explicita la premisa oculta | "De A no se sigue B sin asumir C, que no está establecida" |
| `⚠` | Falacia estructural | Nombra la falacia y justifica por qué aplica | Pendiente resbaladiza, equivocación, ad hominem, etc. — con el argumento específico de por qué la etiqueta es correcta |
| `★` | Buena jugada | Explica por qué el movimiento es sólido | Fuerza reconocimiento honesto de los puntos fuertes |
| `⇑` | Necesito el steel man | Solicita a IA la versión más fuerte del argumento | Admisión de comprensión insuficiente para criticar bien |

### Tipos secundarios

| Símbolo | Nombre | Uso |
|---------|--------|-----|
| `📌` | Ancla de argumento | Marca el inicio o fin de un argumento completo — útil para el mapa post-lectura |
| `⚡` | Pivote conceptual | El autor cambia el significado de un término aquí |
| `↩` | Revisa esto | Quiero volver aquí en Fase 3 |
| `🔗` | Fuente externa | Conecta con literatura relacionada conocida |

---

### Reglas de calidad de anotación

**Una anotación de alta calidad:**
- Para `⊘`: especifica qué tipo de justificación faltaría, no solo "no está argumentado".
- Para `↯`: hace explícita la premisa oculta, no solo señala que hay un salto.
- Para `⚠`: nombra la falacia correctamente y justifica por qué aplica en este caso concreto.
- Para `★`: explica el mecanismo argumentativo que hace el movimiento sólido.

**Una anotación de baja calidad (no puntúa en depth score):**
- "No estoy de acuerdo" sin especificación.
- "Esto no tiene sentido" sin análisis.
- `⚠ Pendiente resbaladiza` sin identificar los pasos intermedios que el autor omite.
- Crítica a la conclusión sin haber identificado la premisa problemática.

La IA puede dar feedback de calidad en Fase 3, no en tiempo real durante la lectura.

---

## 9. Lectura crítica y modo debate

### Activación

El Modo Crítico es un toggle que el usuario activa al iniciar una sesión de Slow Mode:

```
[○ Lectura profunda]  [● Lectura crítica]
```

La diferencia principal es que en Modo Crítico:
1. La Fase 0 incluye el Bloque 5 (puntos estructuralmente débiles).
2. Los tipos de anotación críticos (`⊘`, `↯`, `⚠`, `★`, `⇑`) están en el menú primario, no en `···`.
3. El depth score pondera las anotaciones críticas más alto.
4. La Fase 3 incluye el módulo "abogado del diablo inverso" por defecto.

### El prerrequisito: steel-manning antes de refutar

Este es el principio más importante del Modo Crítico, y el que más diferencia el análisis filosófico riguroso del debate superficial.

**La regla:** Antes de marcar `⊘`, `↯` o `⚠`, el usuario debe poder formular el mejor argumento que el autor podría dar para esa premisa o inferencia. El tipo de anotación `⇑` ("Necesito el steel man") existe exactamente para los momentos en que el usuario reconoce que no tiene suficiente comprensión para criticar con rigor.

**Por qué:** El cerebro en modo "busco fallos" tiende a fijarse en la versión más débil de una premisa — el strawman. La investigación en argument mapping (van Gelder, Rationale software) muestra que quienes explícitamente mapean el argumento más fuerte del autor *antes* de atacarlo mejoran su pensamiento crítico en magnitudes grandes (d > 0.6). No es paternalismo: es la diferencia entre refutar un argumento y refutar tu representación inicial de él.

**La IA como adversario:** En Modo Crítico, el usuario puede pedir a la IA que le presente el steel man de cualquier premisa antes de criticarla. La IA formula el mejor argumento disponible en la literatura para esa posición. El usuario entonces decide si el texto lo establece o no.

### El orden de operaciones en filosofía

```
1. COMPRENSIÓN  →  ¿Qué está diciendo el autor exactamente?
                   (Capa de paráfrasis y auto-explicación)

2. RECONSTRUCCIÓN → ¿Cuál es el argumento en su forma más fuerte?
                   (Steel man — anotación ⇑ o trabajo propio)

3. ANÁLISIS ESTRUCTURAL → ¿Qué premisas asume? 
                          ¿Está el nexo justificado?
                          (Anotaciones ⊘, ↯)

4. EVALUACIÓN CRÍTICA → ¿La premisa está argumentada?
                        ¿Hay falacias estructurales?
                        (Anotaciones ⚠, ⊘ con especificación)

5. RECONOCIMIENTO HONESTO → ¿Qué movimientos son sólidos?
                            (Anotación ★)

6. ANTICIPACIÓN DE RÉPLICA → ¿Cómo respondería el autor a mis objeciones?
                             (Módulo B de Fase 3)
```

Saltar del paso 1 al 4 produce crítica de strawman, no análisis filosófico.

### Tipos de crítica filosófica y cómo capturarlos

**Premisas no argumentadas (`⊘`):**
El autor asume algo que no justifica. Tipos comunes en filosofía:
- Intuición pumping (apelar a intuición sin establecer por qué debe ser aceptada)
- Premisa empírica asumida sin evidencia
- Definición estipulativa presentada como descriptiva
- Dependencia de un marco teórico no introducido

*Cómo anotar bien:* "Asume X. Para aceptarlo necesitaría [tipo específico de justificación]. El texto no lo provee porque [razón]."

**Gaps de inferencia (`↯`):**
La conclusión no se sigue de las premisas sin una premisa adicional que no está establecida.

*Cómo anotar bien:* "De [P1] y [P2] no se sigue [C] sin asumir [premisa oculta]. El autor la necesita pero no la establece."

**Falacias estructurales (`⚠`):**
Errores en la forma del argumento. Tipos frecuentes en filosofía:
- Equivocación (usar el mismo término con dos significados distintos)
- Pendiente resbaladiza (asumir pasos intermedios sin argumentarlos)
- Falso dilema (presentar como exhaustivas opciones que no lo son)
- Ad hominem (atacar la fuente en lugar del argumento)
- Petición de principio (usar la conclusión como premisa)

*Cómo anotar bien:* "Pendiente resbaladiza: de [A] a [C] asume los pasos intermedios [B1, B2, B3] sin argumentarlos. El argumento requeriría justificar cada paso."

**Equivocaciones de concepto (`⚡`):**
El autor usa el mismo término con significados distintos en diferentes partes del argumento, y la validez del argumento depende de esa ambigüedad.

---

## 10. IA durante la lectura

### Principio rector: scaffold, no substitute

La IA en el Slow Mode sigue el principio de "scaffold, don't substitute": ayuda a mantener el proceso cognitivo del usuario, pero nunca lo reemplaza. Cada decisión de diseño de la IA se evalúa contra este principio.

### Modelo de interacción

**En Fase 1 (durante la lectura):**

La IA opera como una combinación de Kindle X-Ray y Perlego "Ask the Book":

- **On-demand:** Solo responde cuando el usuario la invoca. Nunca empuja mensajes.
- **Anchored:** Respuestas ancladas al texto — aparecen como overlays junto al fragmento relevante.
- **Contextually constrained:** Solo accede a texto ya leído. No spoilers.
- **Lightweight:** Respuestas breves. La IA expande solo si el usuario pide más.
- **Dismissable:** Un swipe devuelve al texto exactamente donde estaba.

**Modos de invocación:**
1. Desde el sidebar (texto libre: "¿qué significa X en este contexto?")
2. Desde una anotación `⚑` (la IA ofrece explicación del fragmento marcado)
3. Desde una anotación `⇑` (la IA formula el steel man del argumento)
4. Long-press en un concepto del diccionario (la IA da definición contextual)

**En Fase 2 (checkpoints):**
La IA genera la pregunta del checkpoint y evalúa la respuesta en términos de profundidad (no corrección — no hay respuesta "correcta" en filosofía).

**En Fase 3 (consolidación):**
La IA tiene acceso completo al texto y a todas las anotaciones del usuario para:
- Generar preguntas de retrieval desde las anotaciones.
- Formular el "abogado del diablo inverso".
- Dar feedback de calidad sobre las anotaciones críticas.
- Construir el mapa comparativo de Fase 0 vs anotaciones reales.

### Lo que la IA nunca hace

- Resumir secciones no leídas.
- Generar el argumento del texto en lugar del usuario.
- Interrumpir mid-párrafo.
- Dar feedback en tiempo real sobre la calidad de las anotaciones.
- Opinar sobre si el argumento del texto es correcto o incorrecto.
- Valorar si la crítica del usuario es acertada (eso es filosofía, no grading).

### Prompt structure para la IA en cada fase

*(Para implementación — ver sección de desarrollo)*

**Fase 0:**
```
Eres un asistente de lectura filosófica. Analiza el siguiente texto 
y genera: (1) tesis en una frase, (2) mapa argumental con estado de 
cada premisa, (3) 3-5 conceptos técnicos a rastrear, (4) una pregunta 
guía. [Si modo crítico: (5) 2-3 puntos estructuralmente débiles para 
examinar]. Responde en formato estructurado. No hagas valoraciones 
sobre si el argumento es correcto.
```

**IA en Fase 1 (query del usuario):**
```
El usuario está leyendo [título]. Ha leído hasta [página X]. 
Su query es: [query]. 
Responde solo con información del texto ya leído. Sé breve (máx. 3 oraciones). 
Si la respuesta requiere información de páginas posteriores, dilo sin revelarla.
```

**Steel man en Fase 1:**
```
El usuario quiere el argumento más fuerte posible para [premisa/posición X], 
tal como la usaría el autor o un defensor sofisticado de su posición. 
Presenta el mejor argumento disponible. No evalúes su validez.
```

**Abogado del diablo en Fase 3:**
```
El usuario marcó [fragmento X] con [tipo de crítica]. Su crítica es: [texto de anotación].
Genera una pregunta que le pida formular la mejor réplica del autor antes de evaluar 
si el texto la provee. La pregunta debe ser socrática, no directiva.
```

---

## 11. Capa de gamificación

### Principio rector

La gamificación del Slow Mode sigue un principio único: **la comprensión es el game loop**. Ninguna mecánica recompensa volumen, velocidad o cantidad de lectura. Todas recompensan calidad de procesamiento.

El overjustification effect es el riesgo principal: recompensas tangibles y salientes para actividades que ya son intrínsecamente motivadoras (leer filosofía por interés genuino) reducen la motivación intrínseca posterior. Todo el sistema de recompensas es competencial e interno.

### Mecánicas activas

**1. Sistema de hallazgos**

Cuando el usuario anota algo que coincide con un concepto que la IA marcó en el Bloque 3 de Fase 0, aparece una confirmación discreta:

```
✦  HALLAZGO · [nombre del concepto]
```

No es un punto. No va a ningún leaderboard. Es el cierre de la "treasure hunt": la satisfacción de haber encontrado lo que se buscaba. Cada hallazgo se registra en el resumen de Fase 3.

**2. Mapa argumental — modo rellenar**

La Fase 0 puede activarse en un modo alternativo donde el mapa argumental se presenta con blancos que el usuario va rellenando durante la lectura. Es una gamificación de la estructura:

```
MAPA ARGUMENTAL — COMPLETA MIENTRAS LEES

P1: _______________  (encontrada en página ___)
P2: _______________  (encontrada en página ___)
I:  _______________  
C:  _______________
```

El usuario no está siendo evaluado — está construyendo su propia representación. Al final, la IA muestra el mapa completo y el usuario compara.

**3. Depth score (privado)**

Un indicador de la calidad del procesamiento durante la sesión. Visible solo para el usuario, no comparado con nadie. Escala basada en tipos de anotación:

| Anotación | Puntos de profundidad |
|-----------|----------------------|
| Highlight solo (sin anotación) | 0 |
| `≈ Paráfrasis` | 3 |
| `? Pregunta propia` | 2 |
| `→ Auto-explicación` | 4 |
| `⟷ Conexión` (enlaza concepto del grafo) | 3 |
| `★ Buena jugada` (con explicación) | 5 |
| `⊘ Sin justificar` + especificación completa | 5 |
| `↯ Gap de inferencia` + premisa oculta explicitada | 6 |
| `⚠ Falacia` + nombre correcto + justificación específica | 6 |
| `⇑ Steel man` (reconocimiento de comprensión insuficiente) | 4 |

**Penalizaciones por calidad baja (en Fase 3, no en tiempo real):**
- `⊘` sin especificación: -1 (la IA señala qué faltaría para que sea accionable)
- `⚠` con falacia mal etiquetada: -1 (con explicación de por qué la etiqueta no aplica)

El depth score no penaliza los highlights puros — solo los registra con valor 0 para que el usuario vea la proporción generativa/pasiva de su sesión.

**4. Desbloqueo de vista de grafo enriquecida**

Al completar el Slow Mode de un texto (Fases 1 y 3 completas), se desbloquea una vista del grafo que muestra el texto con todas las anotaciones del usuario integradas como nodos, diferenciados del contenido original. Esta vista no existía antes de la sesión — es el resultado tangible de haber hecho el trabajo.

**5. Mapa de correspondencia (no puntuación)**

En Fase 3, el mapa que muestra qué porcentaje de los puntos clave de Fase 0 el usuario anotó no es una calificación. Es información sobre la cobertura de su representación mental. Los elementos no cubiertos son oportunidades de segunda pasada, no fallos.

### Lo que explícitamente NO incluir

- Racha de días (streaks) → generan ansiedad en lectores ya motivados.
- Puntos por tiempo de lectura o páginas leídas.
- Comparación con otros usuarios.
- Premios desbloqueables por volumen.
- Notificaciones de "¡llevas 3 días sin leer!".
- Leaderboards de ningún tipo.

---

## 12. Diseño de interfaz

### Principios derivados de la investigación

**1. Estabilidad espacial sobre scroll continuo**

La investigación de eye-tracking muestra que el scroll continuo produce más regresiones navegacionales (buscar el lugar) que el paginado. El texto de una página fija funciona como mapa espacial: el lector recuerda que "la premisa P1 estaba en el tercio superior de la página 3". Esta memoria espacial permite relocalizar partes del argumento sin buscar visualmente. El Slow Mode usa paginado.

**2. Progressive disclosure para features**

Las herramientas avanzadas (tipos de anotación secundarios, IA, diccionario completo) están disponibles pero no visibles por defecto. Solo los cinco tipos primarios de anotación aparecen al seleccionar texto; el resto está en `···`. Solo la barra de progreso y el tap de sidebar son visibles durante lectura limpia.

**3. Clutter mínimo en la columna de texto**

Ningún elemento de UI en la columna de texto principal. Las marcas de anotación son pequeñas (punto de color en el margen o subrayado en color del tipo) y no inline. El texto se lee limpio.

**4. Modo focus completo**

Un toggle que oculta completamente el sidebar y deja solo el texto con la barra de progreso discreta. Para usuarios que quieren flow máximo sin sidebar.

**5. Tipografía ajustable**

Tamaño, interlineado, fuente y contraste ajustables. La investigación de readability muestra que tipografía cómoda reduce carga cognitiva extrínseca y permite enfocar atención en el contenido.

### Referentes de UX

- **LiquidText** para la integración de excerpts en canvas y bi-directional links.
- **Kindle X-Ray** para el modelo de overlay on-demand sin salir del texto.
- **Perlego "Ask the Book"** para el panel lateral de IA colapsable.
- **iAnnotate** para el sidebar de anotaciones con tap-to-source.
- **MarginNote** para el modo-specific toolbars (la sidebar cambia según el modo activo).

### Estados de la interfaz

| Estado | Qué ve el usuario |
|--------|-------------------|
| Lectura limpia | Texto + barra de progreso discreta |
| Sidebar abierto | Texto + sidebar de anotaciones/conceptos/IA |
| Anotación activa | Texto + micro-menú de tipo + campo de texto |
| IA activa | Texto + overlay de respuesta (dismissable) |
| Focus mode | Solo texto + barra de progreso mínima |
| Checkpoint | Texto + chip en margen inferior (dismissable) |

---

## 13. Cuándo usar Slow Mode vs RSVP

El triaging es la decisión más importante. El Slow Mode no escala a 200 páginas de apuntes de econometría — ni debe intentarlo.

### Matriz de decisión

| Tipo de texto | Modo recomendado | Razón |
|---|---|---|
| Fuentes primarias filosóficas | **Slow Mode** | La forma retórica es el contenido |
| Textos argumentativos densos (papers económicos de teoría) | **Slow Mode** | Requieren tracking de premisas y nexos causales |
| Literatura y ensayo | **Slow Mode** | Ritmo, anclaje espacial, inferencias |
| Apuntes propios del curso | **RSVP** | Ya estructura propia, material factual |
| Resúmenes y síntesis | **RSVP** | Material pre-digerido, overview suficiente |
| Bibliografía extensa para panorama general | **RSVP** | Breadth > depth |
| Segunda pasada de un texto ya leído en Slow Mode | **RSVP o libre** | El schema ya está construido |
| Papers de métodos o técnicos con poca argumentación | **RSVP** | Primordialmente factual |

### Heurística rápida

Antes de abrir un texto, una pregunta: **¿necesito entender POR QUÉ el autor cree lo que cree, o solo QUÉ cree?**

- Si necesitas el *por qué* (la cadena argumentativa) → Slow Mode.
- Si necesitas el *qué* (los hechos, definiciones, o el mapa general) → RSVP.

### El flujo recomendado para un tema de filosofía

```
Bibliografía del tema
         │
         ▼
    RSVP (overview)
    ─────────────────
    Apuntes de la asignatura
    Síntesis secundarias
    Contexto histórico
         │
         ▼ (identificar fuentes primarias relevantes)
         │
    SLOW MODE (profundidad)
    ─────────────────────────
    Fuentes primarias del tema
    Textos argumentativamente centrales
    Textos que vas a debatir o criticar
         │
         ▼
    RSVP (revisión)
    ─────────────────
    Segunda pasada de tus propias anotaciones
    Flashcards del grafo
    Preguntas generadas en Fase 3
```

---

## 14. Decisiones de diseño abiertas

Estas son las decisiones que el diseño no fija — el usuario o el equipo las define:

### D1: ¿Gamificación visible durante Fase 1 o solo en Fases 0/3?

**Opción A:** Los hallazgos (`✦`) son visibles en tiempo real durante la lectura.
- Pro: cierre inmediato de la treasure hunt.
- Contra: micro-interrupción durante lectura; riesgo de hunt-for-hallazgos en lugar de comprender.

**Opción B:** Los hallazgos se registran silenciosamente y se revelan en Fase 3.
- Pro: preserva el flujo de Fase 1.
- Contra: pierde la satisfacción inmediata.

*Recomendación basada en la evidencia de flow:* Opción B, con una excepción — si el usuario activa el "modo mapa rellenable" de Fase 0, los hallazgos sí son visibles porque el usuario ya está en modo de búsqueda activa.

---

### D2: ¿Checkpoints de Fase 2 obligatorios para continuar, opcionales, o completamente desactivables?

**Opción A:** Obligatorios (el texto no avanza hasta responder).
- Pro: garantiza al menos un momento de consolidación.
- Contra: rompe el flujo sin posibilidad de recuperarlo; potencialmente irritante.

**Opción B:** Opcionales pero visibles (chip dismissable).
- Pro: el usuario en flow los ignora; el usuario que quiere estructura los usa.
- Contra: la mayoría los ignorará.

**Opción C:** Desactivables en el setup de la sesión.
- Pro: máximo control.
- Contra: los usuarios que más los necesitan los desactivarán primero.

*Recomendación:* Opción B. El buffer de 15 segundos y la naturaleza no-intrusiva del chip minimizan el costo para el usuario en flow.

---

### D3: ¿Cómo de explícito es el feedback de calidad de anotaciones?

**Opción A:** Solo en Fase 3, en forma de sugerencias ("Esta anotación ⊘ podría ser más accionable si especificaras...").

**Opción B:** En tiempo real, con un indicador visual de calidad al confirmar la anotación.

*Recomendación:* Opción A. El feedback en tiempo real durante la lectura es otra interrupción. La Fase 3 es el momento correcto para metacognición sobre el proceso de lectura.

---

### D4: ¿Modo Crítico por defecto o activable?

Si el Slow Mode se usa principalmente para textos filosóficos, el Modo Crítico podría ser el default, no una opción.

*Consideración:* Para usuarios que usan el Slow Mode también para textos no-filosóficos (novelas, ensayos literarios), el Modo Crítico puede ser disruptivo. Mantenerlo como toggle parece la opción más flexible.

---

## 15. Glosario de términos técnicos

| Término | Definición en el contexto de este documento |
|---------|---------------------------------------------|
| **Advance organizer** | Material conceptual o estructural presentado antes del texto principal para activar schema relevante (Ausubel). En el Slow Mode: la Fase 0. |
| **Depth score** | Indicador privado de la calidad del procesamiento cognitivo durante una sesión de Slow Mode. No es una calificación comparativa. |
| **Elaborative interrogation (EI)** | Estrategia de aprendizaje que consiste en responder "¿por qué es verdad esto?" para cada proposición del texto. |
| **Focus mode** | Estado de la interfaz que oculta todos los elementos de UI excepto el texto y la barra de progreso. |
| **Generation effect** | Fenómeno por el cual el material que el learner produce es recordado mejor que el material que simplemente lee (Slamecka & Graf, 1978). |
| **Grafo** | Red de conceptos y relaciones construida por Pith a partir de los textos procesados. En Slow Mode, las anotaciones del usuario se integran como nodos propios. |
| **Overjustification effect** | Reducción de la motivación intrínseca para una actividad cuando se introduce una recompensa externa saliente (Deci et al.). Riesgo central en el diseño de gamificación. |
| **Regresión (lectura)** | Movimiento ocular hacia atrás durante la lectura (saccada regresiva). No es un error — es una herramienta de comprensión usada cuando el procesamiento falla. |
| **RSVP** | Rapid Serial Visual Presentation. El modo de lectura existente en Pith: presenta bloques pre-generados a ritmo controlado. |
| **Schema** | Estructura de conocimiento previo organizada en la memoria. Los advance organizers activan el schema relevante para el nuevo texto. |
| **Self-explanation effect** | Mejora de comprensión y transferencia producida por generar explicaciones propias sobre el significado, la coherencia y las conexiones del texto (Chi et al.). |
| **Slow Mode** | El modo de lectura diseñado en este documento. Lectura auto-paced, paginada, con anotaciones activas, IA bajo demanda, y consolidación post-lectura. |
| **Spaced repetition** | Sistema de revisión que presenta material en intervalos crecientes basados en la probabilidad modelada de olvido. En Slow Mode: las anotaciones pueden convertirse en tarjetas. |
| **Steel man** | La versión más fuerte posible del argumento de un interlocutor. Opuesto al straw man. Prerequisito de la crítica filosófica rigurosa. |
| **Trailing masking** | Técnica experimental (Schotter et al.) donde las palabras ya leídas se reemplazan por caracteres, simulando la pérdida de acceso a texto anterior del RSVP. |

---

*Documento generado como especificación de diseño para Pith — Slow Mode v1.0*  
*Basado en investigación de: Slamecka & Graf (1978), Bisra et al. (2018), Chi et al., Boo & Conklin (2015), Benedetto et al. (2015), Foroughi et al., Ausubel, van Gelder, Schotter & Rayner, Csikszentmihalyi, y meta-análisis de Hattie / Visible Learning MetaX.*

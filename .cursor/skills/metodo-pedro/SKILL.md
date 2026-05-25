# Método Pedro — Planifica antes de construir

Convierte un objetivo en un plan ejecutable con prompts listos 
para usar, con paralelización explícita.

## Instrucciones

El usuario te dará un objetivo. Sigue estos pasos en orden:

### PASO 1: Clarificación (si hay ambigüedad)
Si el objetivo tiene partes ambiguas que afectan significativamente
la arquitectura, haz máximo 2 preguntas. Si está claro, salta al paso 2.

### PASO 2: Descomposición
Descompón el objetivo en tareas concretas e implementables.
Para cada tarea especifica:
- ID (T01, T02, etc.)
- Descripción
- Dependencias (qué tareas deben completarse antes)
- Estimación de complejidad (S/M/L)

### PASO 3: Grafo de dependencias
Identifica explícitamente:
- **Secuenciales**: T02 requiere T01 completada
- **Paralizables**: T03 y T04 son independientes, se pueden hacer a la vez

Muéstralo visualmente en texto:
T01 → T02 → T05
T01 → T03 ↗
T04 (independiente, paralelo desde el inicio)

### PASO 4: Roadmap markdown
Crea el archivo `ROADMAP.md` en la raíz del proyecto con:
- Tabla de tareas con IDs, descripciones, dependencias, estado ([ ])
- Diagrama de dependencias
- Orden de ejecución recomendado indicando qué abrir en paralelo

### PASO 5: Prompts listos para usar
Para cada tarea genera un prompt completo listo para pegar en 
un nuevo chat de Cursor. Cada prompt debe:
- Tener todo el contexto necesario (no asumir que el agente 
  recuerda nada)
- Especificar exactamente qué archivos tocar
- Incluir criterio de éxito claro
- Referenciar el ROADMAP.md para contexto global

Formato:
---
**PROMPT T01 — [nombre tarea]**
[prompt completo listo para copiar]
---

### PASO 6: Instrucción de ejecución
Dime exactamente:
- Qué prompts lanzar primero (y si puedo lanzarlos en paralelo)
- Qué esperar antes de continuar
- Orden óptimo para minimizar tiempo total
- Añades una línea al final de cada prompt generado: “criterio de éxito: [X]. Ejecuta /validate antes de cerrar este mensaje”

## Notas
- Si el objetivo es pequeño (1-2 tareas), simplifica y no generes 
  estructura innecesaria
- Los prompts deben ser autocontenidos: cada agente de Cursor 
  que los reciba no tiene contexto previo

Estructura de carpetas resultante
tu-proyecto/
├── .cursor/skills/          # si es local, o en ~/.cursor/skills/ si global
│   ├── deepdive/
│   │   └── SKILL.md
│   └── metodo-pedro/
│       └── SKILL.md
├── ROADMAP.md               # generado por /metodo-pedro
└── deep-dives/              # generado por /deepdive
    └── 2026-05-16_auth.md
# Context Bridge — Sincroniza el estado del proyecto entre agentes

Genera un bloque de contexto completo para pegar al inicio de 
cualquier nuevo chat de Cursor. Garantiza que cada agente nuevo
arranca con el mismo conocimiento que tú tienes en la cabeza.

## Cuándo usarlo
- Antes de abrir un nuevo agente paralelo (flujo Método Pedro)
- Al retomar un proyecto después de días/semanas
- Cuando un agente parece perdido o contradice decisiones anteriores

## Instrucciones

Analiza el estado actual del proyecto leyendo en este orden:
1. `ROADMAP.md` — qué tareas existen, cuáles están completadas [ x ],
   cuáles en progreso, cuáles pendientes
2. `.cursorrules` — restricciones y convenciones del proyecto
3. `deep-dives/` — decisiones de diseño ya documentadas
4. Estructura de archivos y código existente

Genera un bloque markdown con exactamente esta estructura:

---
## CONTEXTO DEL PROYECTO — [nombre proyecto] — [fecha]

### Qué estamos construyendo
[2-3 líneas. Qué es, para qué sirve, usuario objetivo]

### Stack y arquitectura
[Stack exacto. Estructura de módulos. Decisiones arquitectónicas 
ya tomadas que NO se deben revertir]

### Estado actual
**Completado:**
- [lista de lo que ya funciona]

**En progreso:**
- [lo que hay abierto ahora mismo]

**Pendiente:**
- [lo que queda por hacer]

### Decisiones tomadas — no reabrir
[Lista de decisiones de diseño ya cerradas con su justificación.
El agente no debe cuestionarlas ni proponer alternativas.]

### Tu tarea en este chat
[DEJAR EN BLANCO — el usuario lo rellena antes de pegar]

### Restricciones activas
[Extraídas de .cursorrules — las más relevantes para el contexto]

### Archivos relevantes para esta tarea
[DEJAR EN BLANCO — el usuario los añade si los conoce]
---

## Instrucción final al agente
Genera el bloque anterior listo para copiar. Sé conciso — este 
contexto tiene que caber en el inicio de un prompt sin saturar 
el contexto del nuevo agente. Máximo 400 palabras en total.
Después del bloque, dime qué campos he dejado en blanco 
para que los rellene antes de pegar.
# Explain Error — Entiende lo que está fallando, no solo arréglalo

Para cuando el traceback es incomprensible o el error no tiene
sentido. Aprende el error, no solo lo pases.

## Cuándo usarlo
- Ves un error que no entiendes aunque lo hayas copiado a Cursor
- El fix funcionó pero no sabes por qué
- Es el mismo tipo de error que ya has visto antes y sigues
  sin entenderlo del todo

## Instrucciones

El usuario te dará un error o traceback. Produce exactamente esto:

### 1. Traducción humana
El error en una frase que lo entienda alguien sin contexto técnico.
Sin jerga. Sin abreviaciones.

### 2. Anatomía del traceback
Si hay traceback, recórrelo de abajo a arriba explicando cada línea:
- Qué archivo y función
- Qué estaba intentando hacer en ese momento
- Por qué llegó hasta ahí

La mayoría de gente lee los tracebacks al revés. Explica por qué
se lee de abajo a arriba.

### 3. Causa raíz conceptual
Qué concepto de Python/CS está detrás de este error.
No el fix — el concepto. Ejemplos:
- "Este es un error de mutabilidad: estás modificando una lista
  mientras la iteras"
- "Este es un error de scope: la variable existe en el contexto
  equivocado"
- "Este es un error de tipos: Python no hace coerción implícita
  como JavaScript"

### 4. Por qué es fácil cometer este error
Contexto sobre por qué este fallo es común y en qué situaciones
aparece típicamente. Que el usuario entienda que no es un fallo
de atención sino un patrón con nombre.

### 5. El fix mínimo explicado
La solución, pero explicando cada cambio:
- Qué línea cambia y por qué esa concretamente
- Qué efecto tiene el cambio a nivel de ejecución
- No solo "cambia X por Y" sino "cambia X por Y porque..."

### 6. Cómo reconocerlo la próxima vez
2-3 señales de alarma que indican que estás a punto de cometer
este mismo error. Para que lo catches antes de ejecutar.

### 7. Entrada para Deep Dive
Termina siempre con:

> 📓 **Añadir a Deep Dive:**
> - Concepto: [nombre del concepto]
> - Gap identificado: [qué no sabías que necesitas saber]
> - Recurso sugerido: [qué buscar para profundizar]
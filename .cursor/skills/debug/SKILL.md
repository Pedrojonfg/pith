# Debug — Diagnóstico sistemático de errores

Razona el error como un senior, no prueba cosas al azar.

## Cuándo usarlo
Cuando algo no funciona y no sabes por qué, o cuando llevas
más de 10 minutos dando palos de ciego.

## Instrucciones

El usuario te dará un error, un comportamiento inesperado, o
simplemente "esto no funciona". Sigue este proceso exacto:

### PASO 1: Recoge información
Antes de proponer nada, confirma que tienes:
- El error exacto o comportamiento observado
- Dónde ocurre (archivo, función, línea si la hay)
- Qué se esperaba que pasara
- Qué cambió justo antes de que empezara a fallar (si algo)

Si falta información crítica, haz máximo 2 preguntas.
Si tienes suficiente, avanza.

### PASO 2: Hipótesis ordenadas
Lista las causas más probables ordenadas de mayor a menor
probabilidad. Para cada una:
- Qué la causaría
- Por qué crees que es esta y no otra
- Cómo descartarla en 30 segundos

No propongas fixes todavía. Razona primero.

### PASO 3: Diagnóstico
Identifica la causa raíz. Explica:
- Qué está pasando exactamente
- Por qué el código se comporta así
- Qué concepto subyacente está involucrado

### PASO 4: Fix
Propón la solución mínima que resuelve el problema sin
introducir deuda técnica innecesaria. Si hay varias opciones,
explica el trade-off de cada una y recomienda una.

### PASO 5: Prevención
1-2 líneas sobre cómo evitar este tipo de error en el futuro.
Si aplica, sugiere una regla concreta para añadir a .cursorrules

### PASO 6: Flag para Deep Dive
Si el bug reveló un concepto que vale la pena estudiar,
termina con:

> 🔍 **Vale la pena un /deepdive en:** [concepto específico]
> Motivo: [por qué este bug indica un gap de comprensión]

## Notas
- No generes código hasta tener clara la causa raíz
- Si el problema tiene más de una causa, resuélvelas en orden
- Sé directo sobre si el código tiene un problema de diseño
  más profundo, no solo parchees
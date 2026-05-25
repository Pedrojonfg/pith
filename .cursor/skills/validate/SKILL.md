# Validate — Verifica que lo que construiste hace lo que dijiste

Genera una batería de tests de validación en cursor-tests/ 
y los ejecuta antes de cerrar la tarea.

## Cuándo usarlo
Al terminar cualquier tarea del ROADMAP antes de marcarla [ x ].
Nunca saltes este paso si la tarea toca lógica de negocio.

## Instrucciones

### PASO 1: Extrae las aserciones implícitas
Del prompt original de esta tarea, extrae todas las afirmaciones
implícitas sobre el comportamiento esperado. Ejemplos:
- "procesa pagos" → el pago se registra, el saldo cambia, 
  falla con tarjeta inválida
- "filtra por fecha" → devuelve resultados correctos, maneja 
  fechas límite, no explota con formato incorrecto

### PASO 2: Genera los tests
Crea el archivo `cursor-tests/[fecha]_[nombre-tarea].py`
(o .js/.ts según el stack del proyecto)

Para cada aserción:
- Happy path — funciona cuando debería funcionar
- Edge case obvio — el caso límite más probable
- Failure case — falla correctamente cuando debería fallar

No generes tests que siempre pasan. Si no puedes escribir
un test que podría fallar, es que no estás testeando nada.

### PASO 3: Ejecuta
Corre los tests. Si alguno falla:
- Para
- Diagnostica (no parchees a ciegas)
- Corrige la implementación
- Vuelve a correr

No marques la tarea como completada hasta que todos pasen.

### PASO 4: Resumen
Cuando todos pasen, reporta:
- Cuántos tests generados
- Qué casos cubre
- Qué casos NO cubre conscientemente y por qué
- Si encontró algún bug durante el proceso

### PASO 5: Flag para Deep Dive
Si los tests revelaron un comportamiento inesperado, termina con:

> 🧪 **Añadir a Deep Dive:** los tests de [tarea] revelaron 
> [comportamiento inesperado] — vale la pena entender por qué

## Notas
- cursor-tests/ está en .gitignore — son tests de proceso
- No son sustituto de tests oficiales en /tests
- Si el proyecto no tiene /tests, sugiere cuáles deberían 
  existir ahí basándote en lo que has validado aquí
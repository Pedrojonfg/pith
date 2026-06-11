# Validate — Verifica que lo que construiste hace lo que dijiste

Genera una batería de tests de validación en cursor-tests/
y los ejecuta antes de cerrar la tarea.

## Cuándo usarlo
Al terminar cualquier tarea del ROADMAP antes de marcarla [ x ].
Nunca saltes este paso si la tarea toca lógica de negocio.

---

## Instrucciones

### PASO 1: Extrae las aserciones desde la spec

**Fuente principal:** la spec vinculada a esta tarea en ROADMAP.md
(p.ej. `specs/slow_mode_spec.md`, `specs/20260609-unified-session.md`).
Si no hay spec vinculada, usa el prompt de la tarea como fallback —
y anótalo en el resumen final como deuda técnica.

Para cada requisito de la spec, extrae la aserción observable:
- ¿Qué estado produce?
- ¿Qué devuelve?
- ¿Qué efecto secundario tiene?
- ¿Qué debería rechazar?

Ejemplos:
- "procesa pagos" → pago registrado, saldo actualizado,
  falla limpiamente con tarjeta inválida
- "filtra por fecha" → resultados correctos, maneja límites,
  no explota con formato incorrecto

### PASO 2: Genera los tests

Crea el archivo `cursor-tests/[fecha]_[nombre-tarea].py`
(o .js/.ts según el stack del proyecto).

Para cada aserción, escribe **tres tipos** de test:

| Tipo | Descripción |
|---|---|
| Happy path | Funciona cuando debería funcionar |
| Edge case | El caso límite más probable |
| Failure case | Falla correctamente cuando debería fallar |

**Tests de contrato (obligatorios si la tarea modifica interfaces):**
Identifica qué módulos consumen lo que acabas de cambiar.
Para cada consumidor, escribe un test que verifique que el contrato
(firma, shape de datos, errores esperados) no se ha roto.

No generes tests que siempre pasan. Si no puedes escribir
un test que podría fallar, no estás testeando nada.

### PASO 3: Ejecuta — incluyendo regression

**3a. Tests nuevos:**
Corre los tests de esta tarea. Si alguno falla:
- Para
- Diagnostica (no parchees a ciegas)
- Corrige la implementación
- Vuelve a correr

**3b. Anti-regression:**
Corre también los tests de cualquier tarea anterior del mismo módulo
que exista en `cursor-tests/`. Un test previo que falla ahora es
un bug introducido por esta tarea, no un problema de la tarea anterior.
Trátalo como un fallo crítico: no cierres la tarea hasta resolverlo.

No marques la tarea como completada hasta que **todos** pasen.

### PASO 4: Evalúa la profundidad de los tests

Si se cumple cualquiera de estas condiciones:
- Tests generados ≤ 3
- Algún módulo tiene solo happy paths
- La tarea toca lógica de negocio no trivial (transformaciones,
  algoritmos, pipelines de datos)

→ Invoca `/mutation-check` sobre los archivos modificados
  en esta tarea antes de continuar.

Si no se cumple ninguna, salta al Paso 5.

### PASO 5: Resumen

Cuando todos los tests pasen, reporta:

```
Tests generados:     N
Casos cubiertos:     [lista]
Casos NO cubiertos:  [lista + razón consciente de por qué]
Contratos validados: [módulos consumidores testeados]
Regression run:      sí / no (razón si no)
Mutation check:      ejecutado / omitido (razón)
Bugs encontrados:    [descripción o "ninguno"]
Fuente de aserciones: spec / prompt-fallback
```

### PASO 6: Flag para Deep Dive

Si los tests revelaron un comportamiento inesperado, termina con:

> 🧪 **Añadir a Deep Dive:** los tests de [tarea] revelaron
> [comportamiento inesperado] — vale la pena entender por qué

---

## Notas

- `cursor-tests/` está en .gitignore — son tests de proceso
- No son sustituto de tests oficiales en `/tests`
- Si el proyecto no tiene `/tests`, sugiere cuáles deberían
  existir ahí basándote en lo que has validado aquí
- Si la fuente fue el prompt en lugar de la spec, añade a ROADMAP.md:
  `[ ] Escribir spec retroactiva para [módulo]`

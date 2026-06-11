# Mutation Check — Mide si tus tests realmente detectan errores

Evalúa la thoroughness de la suite de tests mediante mutation testing
sobre los archivos modificados en la tarea actual.

## Cuándo usarlo
- Invocado automáticamente desde `/validate` cuando los tests son escasos
- Invocación manual cuando sospechas que los tests son superficiales
- Antes de marcar como estable cualquier módulo de lógica crítica

No corras esto en cada tarea por defecto. Es una herramienta de auditoría,
no de flujo normal. El coste de tiempo es variable y puede ser alto.

---

## Instrucciones

### PASO 1: Detecta el stack y la herramienta

| Stack | Herramienta | Instalación |
|---|---|---|
| Python | `mutmut` | `pip install mutmut` |
| JavaScript / TypeScript | `stryker` | `npx stryker init` |
| Otro | Busca equivalente o usa `/deepdive` para investigar |

Comprueba si ya está instalado antes de instalar.

### PASO 2: Delimita el scope

No corras mutation testing sobre todo el proyecto.
Identifica los archivos **directamente modificados** en esta tarea
(no sus dependencias, no sus consumidores).

```bash
# Para obtener los archivos modificados desde el último commit:
git diff --name-only HEAD
# O desde un commit específico:
git diff --name-only <commit-hash> HEAD
```

Pasa solo esos archivos como scope al runner de mutations.

### PASO 3: Ejecuta

**Python (mutmut):**
```bash
mutmut run --paths-to-mutate src/[modulo]/[archivo].py \
           --tests-dir cursor-tests/
mutmut results
```

**JavaScript / TypeScript (Stryker):**
```json
// stryker.config.json (genera con `npx stryker init` si no existe)
{
  "mutate": ["src/[modulo]/[archivo].ts"],
  "testRunner": "jest",
  "reporters": ["clear-text", "json"]
}
```
```bash
npx stryker run
```

Umbral mínimo aceptable: **70% de mutantes eliminados (killed)**.

### PASO 4: Analiza los supervivientes

Para cada mutante que sobrevivió (survived), el runner te da:
- Qué línea muó
- Qué cambio hizo (p.ej. `>` → `>=`, `+` → `-`, `return True` → `return False`)

Por cada superviviente:

1. **¿Es un mutante equivalente?**
   (el cambio produce un programa semánticamente idéntico — estos son
   falsos positivos inherentes al método, ignóralos)

2. **Si no es equivalente → genera el test stub que lo mataría:**

```python
def test_[descripcion_del_mutante]():
    # Mutante: línea N, cambió [X] → [Y]
    # Este test falla con el mutante y pasa con la implementación real
    result = funcion_bajo_prueba([input_que_expone_la_diferencia])
    assert result == [valor_correcto]  # falla si X fue reemplazado por Y
```

Añade estos stubs a `cursor-tests/[fecha]_[nombre-tarea].py`
y corre el test para verificar que efectivamente mata al mutante.

### PASO 5: Resumen

```
Archivos bajo test:      [lista]
Mutantes generados:      N
Mutantes eliminados:     M  (score: M/N * 100%)
Mutantes equivalentes:   K  (ignorados, razón)
Mutantes supervivientes: S  (tests nuevos generados para cubrirlos)
Umbral alcanzado:        sí (≥70%) / no (<70%)
```

Si el score es < 70% tras añadir los tests stubs:

> ⚠️ **Mutation score insuficiente en [módulo].**
> El módulo tiene lógica no testeable con la estructura actual.
> Considera: (a) refactorizar para hacer la lógica más observable,
> o (b) aceptar el riesgo conscientemente y documentarlo en ROADMAP.md.

### PASO 6: Flag para Deep Dive

Si encontraste mutantes equivalentes en alta proporción (>20%):

> 🧪 **Añadir a Deep Dive:** [módulo] tiene un ratio alto de mutantes
> equivalentes — puede indicar lógica con efectos secundarios implícitos
> o acoplamiento que impide la observabilidad directa.

---

## Notas

- Los mutantes equivalentes son normales. No los cuentes como fallos.
- Un mutation score del 100% no es el objetivo — es una señal de
  over-testing si el módulo es simple.
- Si el runner tarda >5 minutos, reduce el scope a las funciones
  específicas modificadas, no el archivo completo.
- Los tests generados aquí van a `cursor-tests/` (proceso), no a `/tests`.
  Si un test stub revela un bug real, promociónalo a `/tests` con contexto.

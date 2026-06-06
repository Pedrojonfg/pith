# Validate — Verifica que lo que construiste hace lo que dijiste

Genera una batería de tests de validación en cursor-tests/
y los ejecuta antes de cerrar la tarea.

## Cuándo usarlo
Al terminar cualquier tarea del ROADMAP antes de marcarla [ x ].
Nunca saltes este paso si la tarea toca lógica de negocio, endpoints,
componentes de UI, o cualquier cosa que interactúe con el mundo exterior.

---

## PASO 0: Clasifica el código implementado

Antes de generar un solo test, determina a qué categoría pertenece
lo que acabas de implementar. Puede ser más de una.

| Categoría | Señales | Framework de test |
|---|---|---|
| **Lógica pura** | Función que toma input, devuelve output, sin efectos | pytest / jest (sin setup extra) |
| **Lógica con efectos externos** | Llama a DB, API externa, filesystem, fecha/hora | pytest + `unittest.mock` / jest + `jest.fn()` |
| **Endpoint HTTP** | FastAPI, Flask, Express, cualquier route handler | FastAPI→ `TestClient`; Flask→ `app.test_client()`; Express→ `supertest` |
| **Componente React / JS DOM** | Componente que renderiza HTML, maneja eventos | `vitest` + `@testing-library/react` (instalar si no existe) |
| **Widget Flutter** | Widget que pinta pantalla, responde a tap | `flutter_test` (incluido en el SDK, sin instalar nada) |
| **Módulo Dart puro** | Clase o función Dart sin widgets | `flutter_test` en modo unit (también incluido) |

> ⚠️ Regla absoluta: **nunca digas que algo no se puede testear**.
> Si necesitas una librería, instálala. Si necesitas un mock, créalo.
> La única excepción válida es hardware físico real.

---

## PASO 1: Extrae las aserciones implícitas

Del prompt original de esta tarea, extrae todas las afirmaciones
implícitas sobre el comportamiento esperado. Sé específico:

- "procesa pagos" → el pago se registra, el saldo cambia,
  falla con tarjeta inválida, falla con importe negativo
- "filtra por fecha" → devuelve resultados correctos, maneja
  fechas límite, no explota con formato incorrecto, resultado
  vacío si no hay coincidencias
- "botón de guardar" → el estado cambia al hacer click,
  el botón se deshabilita durante el guardado, muestra
  error si falla

---

## PASO 2: Genera los tests

Crea el archivo `cursor-tests/[YYYYMMDD]_[nombre-tarea].[ext]`
según la categoría del Paso 0.

Para cada aserción, cubre **los tres casos**:
- **Happy path** — funciona cuando debería funcionar
- **Edge case obvio** — el caso límite más probable
- **Failure case** — falla correctamente cuando debería fallar

No generes tests que siempre pasan. Si no puedes escribir
un test que podría fallar, no estás testeando nada.

### Patrones por categoría

**Lógica pura (Python)**
```python
def test_nombre_happy_path():
    resultado = mi_funcion(input_valido)
    assert resultado == valor_esperado

def test_nombre_edge_case():
    resultado = mi_funcion(input_limite)
    assert resultado == valor_limite_esperado

def test_nombre_falla_correctamente():
    with pytest.raises(TipoDeError):
        mi_funcion(input_invalido)
```

**Efectos externos — mockear siempre la dependencia**
```python
from unittest.mock import patch, MagicMock

def test_con_db_mockeada():
    with patch('modulo.funcion_db') as mock_db:
        mock_db.return_value = dato_esperado
        resultado = mi_funcion_que_usa_db()
        assert resultado == lo_que_espero
        mock_db.assert_called_once_with(args_esperados)
```

**Endpoint HTTP (FastAPI)**
```python
from fastapi.testclient import TestClient
from main import app  # ajusta el import

client = TestClient(app)

def test_endpoint_happy_path():
    response = client.post("/ruta", json={"campo": "valor"})
    assert response.status_code == 200
    assert response.json()["campo_respuesta"] == valor_esperado

def test_endpoint_validacion():
    response = client.post("/ruta", json={})  # payload incompleto
    assert response.status_code == 422

def test_endpoint_no_encontrado():
    response = client.get("/ruta/id-inexistente")
    assert response.status_code == 404
```

**Endpoint HTTP (Express/Node)**
```javascript
const request = require('supertest');
const app = require('../app');

test('happy path', async () => {
  const res = await request(app).post('/ruta').send({ campo: 'valor' });
  expect(res.statusCode).toBe(200);
  expect(res.body.campo_respuesta).toBe(valorEsperado);
});
```

**Componente React (Vitest + Testing Library)**
```jsx
import { render, screen, fireEvent } from '@testing-library/react';
import MiComponente from '../MiComponente';

test('renderiza correctamente', () => {
  render(<MiComponente prop="valor" />);
  expect(screen.getByText('Texto esperado')).toBeInTheDocument();
});

test('responde al click', () => {
  const mockFn = vi.fn();
  render(<MiComponente onGuardar={mockFn} />);
  fireEvent.click(screen.getByRole('button', { name: /guardar/i }));
  expect(mockFn).toHaveBeenCalledTimes(1);
});
```

**Widget Flutter**
```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:mi_app/mi_widget.dart';

void main() {
  testWidgets('renderiza el título', (WidgetTester tester) async {
    await tester.pumpWidget(MaterialApp(home: MiWidget(titulo: 'Hola')));
    expect(find.text('Hola'), findsOneWidget);
  });

  testWidgets('responde al tap', (WidgetTester tester) async {
    bool tapped = false;
    await tester.pumpWidget(MaterialApp(
      home: MiWidget(onTap: () => tapped = true),
    ));
    await tester.tap(find.byType(ElevatedButton));
    await tester.pump();
    expect(tapped, isTrue);
  });
}
```

---

## PASO 3: Setup del entorno (si es necesario)

Si el proyecto no tiene el framework de test configurado para la
categoría detectada, configúralo antes de escribir los tests.
No es opcional.

| Caso | Comando |
|---|---|
| React sin vitest | `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom` + config en `vite.config.ts` |
| Node sin supertest | `npm install -D supertest` |
| Python sin pytest | `pip install pytest` |
| FastAPI TestClient | `pip install httpx` (dependencia de TestClient) |

---

## PASO 4: Ejecuta

Corre los tests con el comando correcto para el stack:

| Stack | Comando |
|---|---|
| Python | `cd cursor-tests && python -m pytest [archivo] -v` |
| Node/JS | `npx jest [archivo] --no-coverage` |
| Vitest | `npx vitest run [archivo]` |
| Flutter | `flutter test [archivo]` |

Si alguno falla:
1. Para
2. Lee el error completo (no el resumen)
3. Diagnostica — ¿falla la implementación o el test?
4. Corrige lo que falla (implementación si el comportamiento es incorrecto;
   test si la aserción estaba mal planteada)
5. Vuelve a correr

No marques la tarea como completada hasta que todos pasen.

---

## PASO 5: Resumen

Cuando todos pasen, reporta:

```
Tests generados: N
Stack de test usado: [pytest / vitest / flutter_test / ...]
Categorías cubiertas: [lógica pura / endpoint / widget / ...]

Casos cubiertos:
  ✓ [descripción breve de cada test]

Casos NO cubiertos (conscientemente):
  - [caso] → requeriría [X] que está fuera del scope de cursor-tests
  - [caso UI complejo] → candidato para test E2E con Playwright

Tests que deberían existir en /tests (si el proyecto los tiene):
  - [sugerencia concreta]
```

---

## PASO 6: Flag para Deep Dive

Si los tests revelaron un comportamiento inesperado, termina con:

> 🧪 **Añadir a Deep Dive:** los tests de [tarea] revelaron
> [comportamiento inesperado] — vale la pena entender por qué

---

## Notas

- `cursor-tests/` está en `.gitignore` — son tests de proceso, no de producción
- No son sustituto de tests oficiales en `/tests`
- Si el proyecto no tiene `/tests`, al final de la tarea sugiere cuáles
  deberían existir basándote en lo que has validado aquí
- Los mocks no son trampa — son la herramienta correcta para aislar
  lo que quieres testear de lo que no quieres testear
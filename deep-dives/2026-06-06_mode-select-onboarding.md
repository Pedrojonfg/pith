### 1. Qué construimos
Separamos el onboarding en dos pantallas: primero eliges el modo de estudio (RSVP o Slow Mode), luego configuras la sesión (archivos, parámetros, reanudar).  
Esto prepara la app para añadir más modos sin saturar el formulario de subida.  
Corregimos una pantalla vacía al arrancar: `showScreen("modeSelect")` podía dejar todas las `.screen` ocultas, y una dependencia circular `ui.js ↔ main.js` podía abortar el bootstrap.

### 2. Decisiones de diseño
- **Pantalla dedicada `screenModeSelect` + pantalla `screenPlaceholder` de configuración**  
  Elegimos dividir selector y formulario en dos vistas con navegación explícita («← All modes»).  
  Alternativa: mantener todo en un solo card con acordeón; se descartó por no escalar cuando haya 4–6 modos.  
  Trade-off: un clic extra por sesión, pero UX más clara y extensible.

- **Navegación inmediata al elegir modo (radio `change` → `enterCreateScreenForMode`)**  
  Elegimos avanzar al configurar en cuanto se selecciona un modo.  
  Alternativa: botón «Continuar» en la pantalla de modos; se descartó por fricción innecesaria con solo dos modos.  
  Trade-off: menos control explícito; si hay muchos modos en el futuro, conviene reevaluar.

- **Extraer `isOfflineMode` a `offline.js`**  
  Elegimos romper el ciclo `ui.js → main.js → study.js` moviendo el helper a un módulo neutro.  
  Alternativa: lazy import dinámico o diferir `bootstrap()`; se descartó por ser más frágil que eliminar el ciclo.  
  Trade-off: un archivo más, pero el grafo de imports queda acíclico en la capa de arranque.

- **`showScreen` defensivo con `resolveModeSelectScreenEl` y fallback**  
  Elegimos resolver `#screenModeSelect` en runtime y, si falta, mostrar configuración o setup.  
  Alternativa: confiar solo en cache bust; se descartó porque la PWA puede servir HTML/JS desincronizados temporalmente.  
  Trade-off: lógica extra en `ui.js`, pero la app nunca queda con cero pantallas visibles.

- **Cache bust (`main.js?v=20260606_1`) + SW `mylearning-v11`**  
  Elegimos invalidar caché de assets críticos tras el cambio de routing.  
  Alternativa: solo hard refresh manual; se descartó por mala UX en PWA instalada.  
  Trade-off: los usuarios pueden necesitar una recarga tras el deploy, pero el SW nuevo lo facilita.

### 3. Conceptos aplicados
- **Enrutamiento por estado de UI (`showScreen`)**: `src/js/ui.js` alterna `aria-hidden` en secciones `.screen`; CSS `display: none/block` según ese atributo.
- **Grafo de módulos ES y dependencias circulares**: `ui.js` importaba `main.js` que ejecuta `bootstrap()` al evaluarse; el ciclo podía acceder a `els` antes de su inicialización (TDZ).
- **Módulo neutro / barrel pattern ligero**: `src/js/offline.js` concentra `isOfflineMode` para que UI y dominio no importen el entrypoint.
- **Progressive enhancement / degradación controlada**: fallback de `modeSelect` → `create` → `setup` si el DOM o la caché no coinciden con el JS.
- **Service Worker versioning**: `CACHE_NAME` en `sw.js` para invalidar bundles estáticos tras cambios de estructura HTML.
- **Validación por contratos**: tests en `cursor-tests/` que simulan DOM con JSDOM y verifican invariantes de navegación sin browser E2E.

### 4. Deuda técnica y mejoras
- Está bien hecho: la separación de pantallas es simple, el back button es claro, y el fallback evita el «pantallazo negro».
- Chapuza funcional: los modos siguen siendo radios en HTML estático; al llegar a 5+ modos hará falta un registry (`STUDY_MODES[]`) que genere tarjetas y labels.
- No escalaría: `getStudyModeLabel` hardcodea RSVP/Slow; cada modo nuevo exige tocar varias funciones.
- Riesgo residual: el fallback a `create` sin `#screenModeSelect` muestra el formulario sin haber elegido modo — funciona como parche de caché, no como flujo ideal.
- Mejora clara: mover `enterModeSelectScreen` / `enterCreateScreenForMode` a un `navigation.js` sin dependencias de `study.js` para reducir acoplamiento del entrypoint.
- Los tests `_boot-real.mjs` importan `main.js` en Node con JSDOM; útil como smoke test, pero no sustituye Playwright con SW real.

### 5. Preguntas de consolidación
1. ¿Por qué `showScreen("modeSelect")` con `#screenModeSelect` ausente deja la app completamente en blanco, y qué invariante garantiza el fallback añadido?
2. ¿Qué cadena de imports provocaba `Cannot access 'els' before initialization` y por qué mover `isOfflineMode` a `offline.js` la elimina?
3. Si mañana añades un tercer modo «Flashcards», ¿qué tres archivos tocarías como mínimo y qué refactor harías para no repetir el patrón?

### 6. Actualización sugerida para .cursorrules
1. Los módulos de UI (`ui.js`, componentes) nunca deben importar el entrypoint (`main.js`); los helpers compartidos van en módulos neutros (`offline.js`, `config.js`).
2. Toda nueva pantalla en `showScreen(which)` debe tener test que verifique que al menos una `.screen` queda con `aria-hidden="false"`.
3. Cambios que muevan markup entre pantallas HTML deben incluir bump de `?v=` en `index.html` y de `CACHE_NAME` en `sw.js`.

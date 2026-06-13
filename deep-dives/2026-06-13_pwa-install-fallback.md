### 1. Qué construimos
Arreglamos el botón "Install app" para que nunca quede mudo en el navegador.  
Capturamos `beforeinstallprompt` lo antes posible (inline en `index.html`) y lo consumimos desde `main.js`.  
Si el prompt nativo no está disponible o ya se usó, mostramos un toast con instrucciones manuales según plataforma (Chrome, Edge, iOS, Firefox).  
El flujo respeta que `prompt()` es de un solo uso y limpia el estado tras aceptar, descartar o fallar.

### 2. Decisiones de diseño
- **Captura inline en `index.html` antes del `import()` de módulos**  
  Elegimos un `<script>` síncrono en el `<head>` que hace `preventDefault()` y guarda el evento en `window.__pithDeferredInstallPrompt`.  
  Alternativa: solo escuchar en `main.js`; se descartó porque el `import()` dinámico puede perder el evento si el navegador lo dispara pronto.  
  Trade-off: duplicación mínima del listener (inline + `main.js` como backup), a cambio de no perder el prompt.

- **Módulo `pwa-install.js` separado de `main.js`**  
  Elegimos extraer `getInstallHelpMessage`, `showInstallHelpToast` y `readStashedInstallPrompt` para testearlos sin bootear la app.  
  Alternativa: dejar todo inline en `main.js`; se descartó por dificultar validación y reuso del patrón de toast (ya usado en `sw-update.js`).  
  Trade-off: un archivo más en el cache del SW, pero contratos claros y tests unitarios posibles.

- **Toast visible en lugar de `console.info`**  
  Elegimos reutilizar el estilo del toast de actualización SW (fixed bottom, z-index 4000, auto-dismiss 12s).  
  Alternativa: modal bloqueante o abrir documentación externa; se descartó por fricción y porque el usuario ya está en contexto de instalar.  
  Trade-off: estilos inline en JS (deuda visual), pero feedback inmediato sin dependencias.

- **Estado `installPromptUsed` + limpieza tras `userChoice`**  
  Elegimos marcar el prompt como consumido y anular `installPromptEvent` tras `prompt()`.  
  Alternativa: reintentar `prompt()` en cada click; se descartó porque la spec lo prohíbe y produce errores silenciosos.  
  Trade-off: tras descartar, el usuario debe usar el menú del navegador (mostramos ayuda), pero no hay clicks muertos.

### 3. Conceptos aplicados
- **Evento `beforeinstallprompt` (PWA installability)**: el navegador lo dispara cuando la app cumple criterios (HTTPS, manifest, SW); solo se puede llamar `prompt()` una vez por evento. Aparece en `index.html` y `main.js`.
- **Deferred event stash (race-condition mitigation)**: patrón de guardar un evento temprano en `window` para consumirlo cuando el bundle esté listo. `readStashedInstallPrompt` en `pwa-install.js`.
- **User-agent sniffing para copy de fallback**: detección de iOS, Edge y Firefox en `getInstallHelpMessage` para instrucciones específicas.
- **One-shot state machine**: `installPromptEvent` + `installPromptUsed` en el click handler de `main.js`.
- **Contract / regression probes**: tests en `cursor-tests/20260613_pwa-install.mjs` que verifican wiring HTML → JS y ausencia de fallback silencioso.

### 4. Deuda técnica y mejoras
- Está bien hecho: el usuario siempre recibe feedback; el stash temprano evita un bug clásico de PWAs; reglas en `.cursorrules` evitan regresiones.
- Chapuza funcional: estilos del toast duplicados respecto a `sw-update.js`; no hay componente compartido de toast.
- No escalaría: `getInstallHelpMessage` con UA sniffing se rompe con nuevos browsers; mejor `navigator.userAgentData` + feature detection donde exista.
- Sin cobertura E2E real: no probamos el diálogo nativo de Chrome en CI; solo lógica pura y contratos de archivo.
- Mejora clara: detectar `display-mode: standalone` y ocultar el botón ya funciona; podría añadirse `getInstalledRelatedApps()` para estados intermedios.

### 5. Preguntas de consolidación
1. ¿Por qué `beforeinstallprompt` puede no dispararse aunque la PWA sea instalable, y qué debe hacer la UI en ese caso?
2. ¿Qué ocurre si llamas `prompt()` dos veces sobre el mismo `BeforeInstallPromptEvent`?
3. ¿Por qué el listener de captura debe ir en un script síncrono antes del `import()` de `main.js`?

### 6. Actualización sugerida para .cursorrules
Ya añadidas en esta sesión:
- Captura temprana de `beforeinstallprompt` en `index.html`.
- Prohibición de fallback silencioso (`console.info` only) en botones de instalación.
- Regla de one-shot para `prompt()` con limpieza de estado.
- Test obligatorio `cursor-tests/20260613_pwa-install.mjs` tras cambios en el flujo.

Regla adicional opcional:
- Extraer toasts PWA (`sw-update`, `pwa-install`) a un helper compartido `toast.js` si se añade un tercer toast similar.

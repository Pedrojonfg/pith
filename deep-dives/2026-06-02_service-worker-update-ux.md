### 1. Qué construimos
Implementamos un flujo de actualización de la app que elimina la necesidad de abrir DevTools y borrar datos manualmente.  
El `service worker` ahora puede activarse al instante cuando la UI detecta una nueva versión.  
Añadimos una notificación visible con botón “Actualizar ahora” para usuarios no técnicos.  
Al activarse el nuevo worker, la app recarga automáticamente para servir assets frescos.

### 2. Decisiones de diseño
- **Activación inmediata con mensaje (`SKIP_WAITING`)**  
  Elegimos enviar un mensaje desde la UI al worker en espera para llamar `skipWaiting()`.  
  Alternativa: esperar a que todas las pestañas se cierren; se descartó por UX lenta e incierta.  
  Trade-off: más lógica de coordinación en cliente, pero actualizaciones mucho más predecibles.

- **`updateViaCache: "none"` + `reg.update()` al cargar**  
  Elegimos forzar comprobación de actualización del SW para evitar que `sw.js` quede obsoleto por caché intermedia.  
  Alternativa: depender del ciclo natural de actualización del navegador; se descartó por inconsistencias entre usuarios.  
  Trade-off: una petición extra en carga, a cambio de detección más rápida de deploys.

- **Recarga al `controllerchange` con guardia `__swRefreshing`**  
  Elegimos recargar cuando el nuevo worker toma control para garantizar coherencia de assets.  
  Alternativa: no recargar y dejar mezclar assets viejos/nuevos hasta próxima navegación; se descartó por riesgo de estado inconsistente.  
  Trade-off: una recarga visible, pero evita bugs sutiles por versiones mezcladas.

- **No tocar almacenamiento de claves en el flujo de update**  
  Elegimos no limpiar `localStorage` ni borrar `ds_api_key` en ningún paso de actualización.  
  Alternativa: “hard reset” de storage para asegurar limpieza total; se descartó por romper onboarding y fricción.  
  Trade-off: posible persistencia de datos no críticos antiguos, pero se preserva continuidad del usuario.

### 3. Conceptos aplicados
- **Ciclo de vida de Service Worker (`install`/`activate`/`waiting`)**: aparece en `sw.js` y en la lógica de registro de `index.html`.
- **Comunicación por mensajes entre ventana y SW**: `postMessage({ type: "SKIP_WAITING" })` en `index.html` y handler `message` en `sw.js`.
- **Estrategias de caché híbridas**: `networkFirst` para HTML/JS críticos y cache-first para estáticos definidos en `sw.js`.
- **Programación defensiva ante eventos repetidos**: guardia `window.__swRefreshing` para evitar bucles de recarga en `controllerchange`.
- **Validación por contratos de texto (regression probes)**: test en `cursor-tests/20260602_validate-sw-update-flow.mjs` que verifica invariantes del flujo.

### 4. Deuda técnica y mejoras
- Está bien hecho: el usuario final ya no depende de pasos técnicos y la actualización tiene camino principal + fallback.
- Chapuza funcional aceptable: el “toast” de actualización está estilado inline en JS; funciona, pero no escala para mantenimiento visual.
- Riesgo no cubierto aún: no hay test E2E real de navegador (solo validación estructural del código).
- No escalaría bien: lógica de actualización incrustada en `index.html`; conviene moverla a `src/js` y compartir utilidades con otros flujos PWA.
- Mejora clara: añadir botón “Más tarde” y auto-dismiss para no interrumpir en mitad de una tarea sensible del usuario.

### 5. Preguntas de consolidación
1. ¿Qué problema exacto evita `controllerchange + reload` frente a mantener la app abierta sin recargar?
2. ¿En qué casos `skipWaiting()` puede introducir riesgo de estado de UI y cómo lo mitigarías?
3. ¿Qué diferencias prácticas hay entre `updateViaCache: "none"` y un simple versionado de URL del SW?

### 6. Actualización sugerida para .cursorrules
1. Toda actualización de PWA debe incluir UX explícita de “nueva versión disponible” para usuarios no técnicos.
2. Ningún flujo de actualización puede borrar claves/API keys por defecto; solo con acción explícita del usuario.
3. Cualquier cambio en `sw.js` debe venir acompañado de un test de regresión en `cursor-tests/` que valide activación y no pérdida de datos.

# ROADMAP — Slow Mode Reader Desktop UX

**Feature**: `20260533-slow-reader-desktop` | **Spec**: `specs/20260533-slow-reader-desktop/spec.md` | **Plan**: `specs/20260533-slow-reader-desktop/plan.md`

## Tabla de tareas

| ID | Descripción | Deps | Complejidad | Estado |
|----|-------------|------|-------------|--------|
| T01 | Full-bleed: sacar reader del `.container` + `body.slow-reader-active` | — | M | [x] |
| T02 | Grid desktop 3 columnas (texto \| margen \| sidebar) + CSS responsive | T01 | M | [x] |
| T03 | Ocultar chrome global (guide, +, API key) en modo lector | T01 | S | [x] |
| T04 | Toolbar: indicador N/total, interlineado, teclado ←/→ | T01 | M | [x] |
| T05 | Render markdown en página + mapeo selección → offsets plain | T01 | L | [x] |
| T06 | Sidebar desktop: default cerrada, tipografía, textarea IA | T02 | M | [x] |
| T07 | Overlays IA responsivos (modal desktop / sheet móvil) | — | S | [x] |
| T08 | Focus mode automático al entrar en Fase 1 | T03, T04 | S | [x] |
| T09 | cursor-tests + QA quickstart | T02–T08 | M | [x] |

## Diagrama de dependencias

```text
T01 → T02 → T06 → T09
T01 → T03 → T08 → T09
T01 → T04 → T08 ↗
T01 → T05 → T09
T07 (independiente, paralelo desde inicio) → T09
```

**Paralelizables tras T01**: T02, T03, T04, T05, T07 (hasta 5 agentes)

**Secuenciales**: T01 primero; T06 tras T02; T08 tras T03+T04; T09 al final

## Orden de ejecución recomendado

### Ola 1 (1 agente — bloqueante)
- **T01** layout shell full-bleed

### Ola 2 (paralelo — hasta 5 agentes)
- **T02** grid desktop + margen
- **T03** chrome hide
- **T04** toolbar + keyboard
- **T05** markdown render + offsets
- **T07** overlays responsivos

### Ola 3 (paralelo — 2 agentes)
- **T06** sidebar desktop (necesita T02)
- **T08** focus auto (necesita T03, T04)

### Ola 4 (cierre)
- **T09** tests + quickstart QA

---

## PROMPT T01 — Full-bleed layout shell

Implementa **T01** del ROADMAP Slow Reader Desktop.

**Contexto**: El lector `#screenSlowReader` está dentro de `main > .container` (max 840px). Debe ser full-bleed en desktop. Ver diagnóstico en conversación previa y `specs/20260533-slow-reader-desktop/contracts/reader-layout-desktop.md`.

**Archivos**:
- `index.html` — mover `<section id="screenSlowReader">…</section>` fuera de `.container` (hijo directo de `main`, después del `.container` o antes)
- `src/js/ui.js` — en `showScreen()`, toggle `document.body.classList.toggle('slow-reader-active', showSlowReader)`
- `src/css/main.css` — reglas `body.slow-reader-active main { padding: 0; place-items: stretch; }` y `.container` no afecta al reader
- `src/css/slow-mode.css` — `#screenSlowReader { width: 100%; max-width: none; }`, quitar restricciones `max-width: 760px` en desktop vía media query base prep

**Contratos**: `reader-layout-desktop.md` (DOM structure, chrome section)

**Criterio de éxito**: En viewport 1920px el lector ocupa ancho útil de ventana (no card 840px centrada). `body.slow-reader-active` solo con `slowReader` visible. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T02 — Grid desktop y columna de margen

Implementa **T02** tras **T01**.

**Archivos**:
- `src/css/slow-mode.css` — `@media (min-width: 1024px)`:
  - Grid: `minmax(0, 1fr) 32px` cerrado; con sidebar `minmax(0, 1fr) 32px minmax(300px, 360px)`
  - Eliminar `grid-template-columns: minmax(0, 1fr) minmax(200px, 20vw)`
  - `.slow-reader-main`: en desktop `max-width: min(75ch, 100%)`, centrado en columna texto
  - `.slow-reader-margin`: quitar `right: -36px`; integrar en columna grid 2
  - `.slow-reader-page-wrap`: layout para 3 columnas internas si hace falta

**Archivos JS** (solo si necesario para grid column placement):
- `src/js/slow/reader.js` — ajustar `renderMarginMarks` si cambia estructura DOM del wrap

**Contratos**: `reader-layout-desktop.md`

**Criterio de éxito**: SC-001 — columna lectura ≥60ch sidebar cerrada en 1920px; marcas de margen visibles sin clip. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T03 — Ocultar chrome global

Implementa **T03** tras **T01** (paralelo con T02/T04/T05).

**Archivos**:
- `src/css/main.css` — `body.slow-reader-active .corner-plus, body.slow-reader-active #changeKeyLink, body.slow-reader-active .sidebar-toggle { display: none !important; }`
- Verificar `src/js/ui.js` ya oculta `#studyProgress` en slow reader

**Contratos**: `reader-layout-desktop.md` (Chrome visibility table)

**Criterio de éxito**: SC-005 — durante lectura no se ven +, Change API key, ni hamburger guide. Al cambiar pantalla vuelven. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T04 — Toolbar, página N/M y teclado

Implementa **T04** tras **T01** (paralelo).

**Archivos**:
- `index.html` — añadir `<span id="slowReaderPageIndicator" class="slow-reader-page-indicator" aria-live="polite"></span>` en toolbar; botones `#slowLineSmallerBtn` / `#slowLineLargerBtn`
- `src/js/slow/reader.js` — `renderProgress()` actualiza indicador; handlers line height; en `onSlowReaderKeydown` añadir ArrowLeft/ArrowRight → `goToReaderPage` cuando no hay overlay/input activo
- `src/css/slow-mode.css` — estilos toolbar desktop (no wrap feo en ≥1024px)

**Contratos**: `reader-toolbar-keyboard.md`, `data-model.md` (typography)

**Criterio de éxito**: SC-004 — navegar 10 páginas solo con teclado; indicador muestra `N / total`; lineHeight persiste en sesión. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T05 — Markdown render y offsets de selección

Implementa **T05** tras **T01** (paralelo; el más complejo).

**Archivos**:
- `src/js/slow/reader.js`:
  - Import `markdownToHtml` from `markdown.js`
  - `renderSlowReaderPage`: si `normalizedFormat === 'markdown'`, `innerHTML` + clase `md-content`; si no, `textContent`
  - Nueva función `selectionToScopeOffsetsFromRendered(pageEl, scopePlain, slice)` o equivalente
  - Actualizar `selectionToScopeOffsets`, `measureMarkY`, `highlightRange` para DOM HTML
- `src/css/slow-mode.css` — estilos `.slow-reader-page.md-content` (reutilizar `.md-content` de main.css si existe)

**Contratos**: `reader-markdown-render.md`, `specs/20260528-slow-mode/contracts/annotation-char-offsets.md`

**Criterio de éxito**: SC-002 y SC-003 — headings visibles; anotación tras selección en texto con negrita conserva offset correcto (probar quickstart §5). Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T06 — Sidebar desktop

Implementa **T06** tras **T02**.

**Archivos**:
- `src/js/slow/sidebar.js` — `resolveSidebarOpen()`: si `undefined` y `matchMedia('(min-width: 1024px)')` → `false`
- `index.html` — cambiar `#slowSidebarIAInput` a `<textarea rows="3">` o duplicar con progressive enhancement
- `src/css/slow-mode.css` — tipografía sidebar desktop; tab ☰ solo cuando cerrada

**Contratos**: `reader-layout-desktop.md`, `reader-responsive-overlays.md`

**Criterio de éxito**: Primera visita desktop: sidebar cerrada; textarea IA usable; fuentes ≥14px en ítems. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T07 — Overlays IA responsivos

Implementa **T07** (paralelo desde inicio, independiente de T02).

**Archivos**:
- `src/css/slow-mode.css` — `@media (min-width: 1024px)` para `.slow-ia-overlay` centrado y panel `max-width: 560px`; móvil sin cambios
- `src/js/slow/reader.js` — verificar focus trap y Escape sin regresión

**Contratos**: `reader-responsive-overlays.md`

**Criterio de éxito**: En desktop IA aparece modal centrado; en 375px sigue bottom sheet con swipe. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T08 — Focus mode automático

Implementa **T08** tras **T03** y **T04**.

**Archivos**:
- `src/js/slow/reader.js` — en `initSlowReader`, activar `focus-mode` y `aria-pressed="true"` salvo `session.slow.focusModeOptOut`
- Opcional: al desactivar focus, set `focusModeOptOut = true` + `storeActiveSession`

**Contratos**: `reader-toolbar-keyboard.md` (Focus mode auto)

**Criterio de éxito**: Al entrar lectura Fase 1, focus activo sin click manual; usuario puede desactivar. Ejecuta `/validate` antes de cerrar este mensaje.

---

## PROMPT T09 — Tests y QA

Implementa **T09** tras T02–T08.

**Archivos**:
- `cursor-tests/20260533_t01-reader-layout.mjs` — assert CSS/DOM: screenSlowReader not inside .container
- `cursor-tests/20260533_t02-selection-offsets.mjs` — fixture plain+html selection mapping
- `cursor-tests/20260533_t03-sidebar-default.mjs` — resolveSidebarOpen logic con mock matchMedia
- Ejecutar regresión pagination slow si existe
- Completar checklist `specs/20260533-slow-reader-desktop/quickstart.md`

**Criterio de éxito**: Todos los cursor-tests nuevos pasan; quickstart marcado; ROADMAP tareas T01–T08 en [x]. Ejecuta `/validate` antes de cerrar este mensaje.

---

## Instrucción de ejecución

1. **Lanza primero** (1 chat): **PROMPT T01**
2. **Cuando T01 termine**, lanza en **paralelo** (hasta 5 chats): **T02, T03, T04, T05, T07**
3. **Cuando T02 termine**: **T06**
4. **Cuando T03 y T04 terminen**: **T08**
5. **Cuando todo lo anterior esté [x]**: **T09**

**Tiempo mínimo estimado**: 3 olas (T01 → paralelo → cierre).

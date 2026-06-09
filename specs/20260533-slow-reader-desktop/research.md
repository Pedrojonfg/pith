# Research: Slow Mode Reader Desktop UX

**Feature**: `20260533-slow-reader-desktop` | **Date**: 2026-06-09

## R1 — Root cause: container bottleneck

**Decision**: Breakout `#screenSlowReader` del `.container` (mover en DOM) + `body.slow-reader-active` con `main { padding: 0; max-width: none }`.

**Rationale**: Diagnóstico confirmó triple restricción: `--content-max: 840px`, `.slow-reader-main max-width: 760px`, `68ch` + sidebar `20vw`. En 1920px el texto útil cae a ~450px con sidebar abierta.

**Alternatives considered**:
- Solo CSS `width: 100vw; margin-left: calc(-50vw + 50%)` — frágil con scrollbars y padding de `main`.
- Aumentar `--content-max` globalmente — rompe otras pantallas card-centric.

**Code references**: `src/css/main.css` (`--content-max: 840px`, `main { place-items: center }`), `index.html` (reader inside `.container`), `slow-mode.css` L97–125.

---

## R2 — Responsive layout strategy

**Decision**: Mobile-first existente + `@media (min-width: 1024px)` para grid de tres columnas: `minmax(480px, 1fr) 32px minmax(300px, 360px)` (texto, margen, sidebar).

**Rationale**: Spec original pide 80/20 lectura/sidebar sobre **viewport**, no sobre card. Columna de margen dedicada evita clipping (`right: -36px` + `body overflow-x: hidden`).

**Alternatives considered**:
- Resizable split pane — más UX, más JS; backlog v2.
- Sidebar siempre visible en desktop — diagnóstico indica molesto; default cerrada en wide.

---

## R3 — Markdown rendering vs annotation offsets

**Decision**: Mantener **scope string plano** como fuente de verdad para paginación y offsets; renderizar slice con `markdownToHtml` + `md-content`; implementar `selectionToScopeOffsetsFromRendered(pageEl, scopePlain, slice)` mapeando DOM → índice en plain text.

**Rationale**: `reader.js` L746 usa `textContent`; anotaciones y `pagination.js` miden sobre string plano. Cambiar fuente de offsets rompería sesiones existentes.

**Alternatives considered**:
- Anotar sobre DOM paths — migración costosa, incompatible con export.
- Seguir en plain text sin markdown — rechazado por SC-002.

**Implementation note**: Usar el mismo slice `scopeText.slice(charStart, charEnd)` para HTML; para selección, construir mapa carácter-a-carácter con `TreeWalker` o precomputar offsets al renderizar (data attributes por bloque).

---

## R4 — Desktop toolbar & keyboard

**Decision**: Añadir `#slowReaderPageIndicator`, handlers `ArrowLeft`/`ArrowRight` en `onSlowReaderKeydown` (cuando no hay menú/overlay/input activo), botones interlineado `line−`/`line+` (paso 0.1, rango 1.3–2.2).

**Rationale**: Hoy solo botones ←/→ y swipe táctil (`reader.js` L1127–1153). Contrato `phase1-reader-ia.md` ya pide font size **y** line height.

**Alternatives considered**:
- Page Up/Down — opcional v2; flechas suficientes para MVP.

---

## R5 — Focus mode & chrome hiding

**Decision**: `showScreen('slowReader')` → `document.body.classList.add('slow-reader-active')`; `initSlowReader` activa focus mode si no desactivado explícitamente; CSS oculta `.corner-plus`, `#changeKeyLink`, `.sidebar-toggle`.

**Rationale**: Spec §5 dice focus automático al entrar Fase 1; diagnóstico: chrome global compite con lectura.

**Alternatives considered**:
- Fullscreen API — intrusivo, permisos; no v1.

---

## R6 — IA overlay responsive

**Decision**: `@media (min-width: 1024px) .slow-ia-overlay { align-items: center }` + panel `max-width: 560px`; móvil mantiene `align-items: flex-end` y swipe dismiss.

**Rationale**: Bottom sheet es patrón iOS; en desktop modal centrado es estándar.

---

## R7 — Sidebar default state

**Decision**: En `resolveSidebarOpen`, si `sidebarOpen === undefined` y `matchMedia('(min-width: 1024px)')`, return `false`; else `true` (móvil mantiene abierto o tab según diseño actual — tab cuando cerrado).

**Rationale**: Desktop pierde ancho con sidebar abierta por defecto.

---

## R8 — Testing approach

**Decision**: `cursor-tests/20260533_t*.mjs` para: `resolveSidebarOpenDefault`, `selectionToScopeOffsets` con HTML fixture, layout class toggling; `quickstart.md` para validación visual manual en 1920px y 375px.

**Rationale**: Alineado con convención repo (`20260528_t*.mjs` pagination).

---

## R9 — Dependency on markdown-canonical

**Decision**: No hard-depend; reader comprueba `normalizedFormat` y renderiza markdown si aplica; si `html_min` legacy, usar `migrate-html-min` hook existente o fallback plain.

**Rationale**: Features pueden ejecutarse en paralelo; reader debe ser robusto.

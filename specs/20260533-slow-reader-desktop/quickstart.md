# Quickstart: Slow Mode Reader Desktop UX

**Feature**: `20260533-slow-reader-desktop`

## Prerequisites

- Dev server: `npx serve .` or project default
- API key configured
- Material markdown con headings (`#`, `##`) y listas

## Manual QA — Desktop (1920×1080)

1. **Full-bleed layout**
   - [ ] Crear sesión Slow Mode → Phase 0 → Start reading
   - [ ] El lector NO aparece como card centrada estrecha; usa ancho de ventana
   - [ ] Con sidebar cerrada, columna texto ≥ 60ch (DevTools → measure `#slowReaderPage`)

2. **Chrome oculto**
   - [ ] No visible: botón `+`, "Change API key", hamburger Study Guide
   - [ ] Al salir del lector (Complete o back), chrome reaparece

3. **Sidebar desktop**
   - [ ] Primera visita: sidebar cerrada, tab ☰ visible
   - [ ] Abrir sidebar: ancho ~320px, texto legible
   - [ ] Cerrar con ›: tab vuelve

4. **Markdown render**
   - [ ] Headings se ven como títulos, no `# literal`
   - [ ] Listas con viñetas/números

5. **Anotaciones**
   - [ ] Seleccionar frase en párrafo con negrita → menú anotación
   - [ ] Crear `?` → aparece en sidebar → tap → salta a página con highlight
   - [ ] Recargar sesión: anotación misma posición

6. **Toolbar & teclado**
   - [ ] Indicador `N / total` visible
   - [ ] ArrowRight × 3 avanza 3 páginas sin ratón
   - [ ] Line height +/- cambia espaciado y recalcula páginas

7. **Focus mode**
   - [ ] Al entrar lectura, focus activo (toolbar mínima)
   - [ ] Click Focus restaura toolbar completa

8. **IA overlay desktop**
   - [ ] Preguntar en sidebar → respuesta en modal centrado (no bottom sheet)

## Manual QA — Mobile (375×667)

- [ ] Swipe cambia página
- [ ] IA overlay desde abajo, swipe down cierra
- [ ] Layout no regresión crítica

## Automated

```bash
node --import ./cursor-tests/register.mjs cursor-tests/20260533_t01-reader-layout.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260533_t02-selection-offsets.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260533_t03-sidebar-default.mjs
node --import ./cursor-tests/register.mjs cursor-tests/20260528_t05-pagination.mjs
```

- [x] `20260533_t01-reader-layout.mjs` — reader outside `.container`, CSS hooks
- [x] `20260533_t02-selection-offsets.mjs` — bold selection → plain offsets
- [x] `20260533_t03-sidebar-default.mjs` — desktop default closed
- [x] `20260528_t05-pagination.mjs` — regression green

## Regression

- [x] `cursor-tests/20260528_t05-pagination.mjs` still passes
- [ ] Tap-to-source sidebar → reader jump still works (manual)

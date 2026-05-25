# Quickstart: RSVP Reading UX

**Feature**: `20260526-rsvp-reading-ux`  
**Prereq**: App served locally (`python3 -m http.server` or Live Server), API key optional (solo estudio con sesión ya generada).

## 1. Constant font size (SC-001)

1. Abrir sesión con bloque de explicación larga en español.
2. Entrar RSVP: WPM 500, **WPF = 4**.
3. Abrir DevTools → Elements → `#rsvp-word-display`.
4. Avanzar 15 flashes (play o esperar).
5. **Pass**: `style.font-size` idéntico en cada flash (copiar valor tras flash 1 y comparar en 5, 10, 15).
6. **Fail**: valor sube en flashes cortos ("de", "la") y baja en largos.

## 2. ORP centered (SC-002)

1. Mismo setup WPF=4.
2. Esperar chunk tipo: `"era jerárquico: defendía una"` o similar 4 palabras.
3. **Pass**: letra roja visualmente en el **centro horizontal del recuadro** gris, no agrupada a la izquierda.
4. Medición opcional: en consola, tras flash:
   ```js
   const c = document.querySelector('.rsvp-container').getBoundingClientRect();
   const o = document.querySelector('.rsvp-orp').getBoundingClientRect();
   const err = Math.abs((c.left+c.width/2) - (o.left+o.width/2));
   console.log('center error px', err);
   ```
   **Pass**: `err <= 4`.

## 3. WPF=1 regression

1. WPF=1, palabra larga ("internacionalización").
2. **Pass**: una sola letra roja, centrada en recuadro.

## 4. Resize recalc only once

1. Durante RSVP, arrastrar esquina del cuadro más grande.
2. Anotar `font-size` post-resize.
3. Avanzar 5 flashes sin tocar tamaño.
4. **Pass**: `font-size` estable tras el resize.

## 5. Math chunk

1. Bloque con fórmula inline `$E=mc^2$` o display.
2. **Pass**: sin `.rsvp-orp`; tamaño estable vs flashes de texto previos del mismo bloque (ratio ~0.85).

## 6. Controls unchanged

1. Pause / Play, Skip, cambio WPM en vuelo.
2. **Pass**: sin errores consola; timer coherente.

## Subjective check (SC-003)

Tras implementar, leer 2 min a **1000 WPM / WPF 4** y anotar si el seguimiento es más fácil que antes (menos "saltos" de tamaño).

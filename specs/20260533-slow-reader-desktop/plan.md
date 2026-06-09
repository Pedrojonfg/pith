# Implementation Plan: Slow Mode Reader Desktop UX

**Branch**: `20260533-slow-reader-desktop` | **Date**: 2026-06-09 | **Spec**: [spec.md](./spec.md)

**Input**: Diagnóstico UX lector Slow Mode — layout móvil en contenedor 840px, texto plano, toolbar incompleta, chrome global visible.

## Summary

Rediseñar `screenSlowReader` para **escritorio primero sin romper móvil**: layout full-bleed, grid texto+margen+sidebar, render markdown con offsets preservados, toolbar con página N/M y teclado, focus mode automático, overlays responsivos.

## Technical Context

**Language/Version**: JavaScript (ES modules), CSS3, HTML5  
**Primary Dependencies**: `markdown.js` (marked), DOM APIs (`matchMedia`, `Range`, `TreeWalker`), módulos existentes `reader.js`, `sidebar.js`, `pagination.js`  
**Storage**: `session.slow` en localStorage vía `session.js` — sin nuevos campos obligatorios  
**Testing**: `cursor-tests/20260533_t*.mjs` + [quickstart.md](./quickstart.md) manual  
**Target Platform**: Desktop ≥1024px (foco); móvil &lt;768px sin regresión  
**Project Type**: SPA vanilla (`index.html`, `src/js/slow/*`, `src/css/slow-mode.css`)  
**Performance Goals**: Recalc paginación &lt;200ms en resize; render página &lt;16ms  
**Constraints**: No frameworks; preservar contratos anotaciones/IA anti-spoiler; cambios quirúrgicos en slow modules  
**Scale/Scope**: ~400–600 LOC netas en CSS + reader/sidebar/ui.js

## Constitution Check

*GATE: `.specify/memory/constitution.md` is template-only; project uses `.cursorrules` + existing slow-mode contracts.*

| Principle | Status | Notes |
|-----------|--------|-------|
| No new frameworks | PASS | CSS grid + DOM |
| Preserve session JSON contracts | PASS | Offsets plain text unchanged |
| Surgical changes | PASS | Scoped to reader screen + ui.showScreen |
| Mobile-aware | PASS | `@media` dual layout |
| Test coverage | PASS | cursor-tests + quickstart |

**Post-design re-check**: PASS

## Project Structure

### Documentation (this feature)

```text
specs/20260533-slow-reader-desktop/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── reader-layout-desktop.md
│   ├── reader-markdown-render.md
│   ├── reader-toolbar-keyboard.md
│   └── reader-responsive-overlays.md
└── tasks.md             # /speckit-tasks (next step)
```

### Source Code (repository root)

```text
index.html                    # Move #screenSlowReader outside .container
src/css/slow-mode.css         # Desktop grid, margin col, responsive overlays
src/css/main.css              # body.slow-reader-active chrome hide
src/js/ui.js                  # showScreen: toggle slow-reader-active
src/js/slow/reader.js         # Markdown render, keyboard, focus auto, margin
src/js/slow/sidebar.js        # resolveSidebarOpen viewport default
cursor-tests/20260533_t*.mjs  # Layout, offsets, sidebar default
```

**Structure Decision**: Sin nuevos módulos; opcional extraer `selection-map.js` solo si `reader.js` supera claridad — prefer inline v1.

## Phase 0: Research

Complete — [research.md](./research.md). Root causes: container 840px, textContent render, touch-first UX, sidebar 20vw.

## Phase 1: Design & Contracts

Complete:

- [data-model.md](./data-model.md)
- [contracts/reader-layout-desktop.md](./contracts/reader-layout-desktop.md)
- [contracts/reader-markdown-render.md](./contracts/reader-markdown-render.md)
- [contracts/reader-toolbar-keyboard.md](./contracts/reader-toolbar-keyboard.md)
- [contracts/reader-responsive-overlays.md](./contracts/reader-responsive-overlays.md)
- [quickstart.md](./quickstart.md)

**Agent context**: `.cursor/rules/specify-rules.mdc` → this plan.

## Phase 2: Implementation Outline (for /speckit-tasks and ROADMAP)

| ID | Work package | Acceptance |
|----|--------------|------------|
| T01 | Full-bleed DOM + `body.slow-reader-active` | Reader outside `.container`; main padding 0 |
| T02 | Desktop CSS grid + margin column | SC-001; no clipped margin marks |
| T03 | Hide global chrome in reader | SC-005 |
| T04 | Toolbar: page indicator, line height, keyboard | SC-004 |
| T05 | Markdown render + selection offset map | SC-002, SC-003 |
| T06 | Sidebar desktop: default closed, typography, textarea IA | User Story 5 |
| T07 | Responsive IA overlay | Desktop modal / mobile sheet |
| T08 | Focus mode auto on init | User Story 4 |
| T09 | cursor-tests + quickstart QA | All automated green |

**Execution order**: T01 → (T02 ‖ T03 ‖ T04) → (T05 ‖ T06 ‖ T07) → T08 → T09

**Risk**: T05 offset mapping — mitigar con tests fixture + manual quickstart §5.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| DOM move for reader section | Break 840px cap | CSS-only breakout fragile with main grid |
| HTML render + plain offsets | Academic readability | Plain text fails SC-002 |

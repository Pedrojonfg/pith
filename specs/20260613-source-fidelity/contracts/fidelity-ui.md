# Contract: Fidelity UI Indicators

**Modules**: `src/js/study.js`, `index.html`, `src/css/main.css`

## Banner element

```html
<div id="blockFidelityBanner" class="block-fidelity-banner hidden" role="status"></div>
```

Placed near block title / RSVP reader chrome (same region as block progress).

## Show conditions

Display when active block has ANY of:

- `block.anchor_quality === "weak"` → message: "Anclaje débil al documento — contrasta con tu PDF."
- `block.anchor_quality === "proportional_fallback"` → "Este bloque usa un trozo aproximado del archivo; revisa la fuente."
- `block.fidelity_status === "warn"` → "Fidelidad reducida: parte del contenido podría no reflejar la fuente."

Hidden when `anchor_quality === "strong"` and `fidelity_status !== "warn"`.

## Wiring

- `renderActiveBlock` / `ensureBlockGenerated` calls `syncBlockFidelityBanner(block, blockIndexEntry)`
- Read `anchor_quality` from `getBlockIndexEntry(blockIndex)` merged with generated block fields

## CSS

`.block-fidelity-banner` — amber/warning tone, compact, dismissible optional (v1: non-dismissible OK)

## Tests

- Smoke: `syncBlockFidelityBanner` sets text for weak anchor fixture (unit in cursor-tests or dom-less state test)

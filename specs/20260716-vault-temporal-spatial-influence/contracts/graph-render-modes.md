# Contract: Graph render modes

## Screen

`#screenSlowGraph` — single screen; additive chrome only.

## Mode control

Values: `node` | `timeline` | `map` | `influence_tree`  
Default: `node` (existing material/vault graph behavior unchanged).

## Project filter

- Checkbox list from `project-store` (all projects + misc as needed).
- Default: all checked.
- Include entry if any membership project is checked (see data-model).
- State: ephemeral; reset on each `openVaultGraphScreen` / equivalent open.

## Timeline

- Input: filtered entries with non-null `temporalRange`.
- Render: SVG bars/markers; viewBox zoom/pan; no new charting library.
- Exclude undated.

## Map

- Input: filtered entries with `geoLocation.geocodeStatus === "resolved"`.
- Leaflet CDN + OSM tiles; marker → detail panel (existing `#vaultGraphDetailPanel` pattern).
- Exclude pending/failed.

## Influence tree

- Input: filtered entries + registry connections where `type === "INFLUENCED"` (both ends in filtered set).
- Roots: no incoming INFLUENCED in filtered subgraph.
- Layout: hierarchical DAG (new pure helper); SVG drawing consistent with canvas conventions.
- Empty state if no edges/nodes.

## Node mode

- Existing `buildVaultGraph` / `mountMaterialGraphScreen` path; apply same project filter when source is vault.

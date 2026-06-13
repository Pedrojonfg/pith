# Contract: vault-graph-ui

**Modules**: `src/js/vault/vault-graph.js`, `src/js/graph/view.js`, `study.js`  
**FR**: FR-601–FR-602

## Adapter

```javascript
buildVaultGraph(vault) → { nodes, edges }
```

**Node**: `{ id, label: canonicalTitle, type: 'vault_concept', mastery: getCurrentMastery(e), topic }`  
**Edge**: `{ from, to, type: 'prerequisite' | 'co_prerequisite' }`

## Navigation

Settings → Knowledge Vault → **View graph** (enabled when `entries.length >= 10`)

## Rendering

- Reuse `graph/view.js` init with vault adapter
- Node color: mastery gradient (red → yellow → green)
- Edge: solid prerequisite, dashed co-prerequisite

## Interaction

- Click node → side panel: detail from debug-ui
- Pan/zoom via existing canvas controls

## Performance

- If nodes > 150, show topic filter before render
- Target: interactive at 100 nodes (SC-006)

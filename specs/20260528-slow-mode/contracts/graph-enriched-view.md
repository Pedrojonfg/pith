# Contract: Enriched Graph View

**Feature**: `20260528-slow-mode` Wave 2 | **Spec**: §7 Módulo C, §11.4

## Unlock

`graphEnrichedUnlocked === true` tras completar Fase 3 → botón "Ver grafo enriquecido".

## Data

```js
buildEnrichedGraph(session) → {
  nodes: [{ id, label, layer: 'text'|'user', sourceAnnotationId? }],
  edges: [{ from, to, type: 'relates'|'cuestiona'|'refuta' }]
}
```

- `[Texto]`: nodos desde `session_concepts` / bloques RSVP del material si existen.
- `[Pedro:]`: una nodo por anotación con `userText` no vacío.
- `⟷` / `🔗` → edge `relates`; `⊘`/`↯`/`⚠` → `cuestiona` o `refuta` según tipo.

## UI v2 (sin canvas LiquidText)

- Pantalla `screenSlowGraph`: lista nodos por capa + edges como pares clicables.
- Tap nodo usuario → jumpToAnnotation si tiene `sourceAnnotationId`.
- Export subgraph en `.md` append.

## Integration

- Escribir nodos usuario en `session_concepts` con tag `layer: 'user'` o store paralelo `slow_graph_nodes` en sesión.

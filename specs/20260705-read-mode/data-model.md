# Data Model: Read Mode

## Mode key

`read` in `MODE_KEYS` and `modes.read`.

## Slice: `modes.read`

Same shape as `modes.questions` / RSVP: `studyMode`, `n_blocks`, `blocks`, `_responses`, `_meta`, `language`, `llmModel`, `materialMeta`, optional `blocksRef`.

## Block extensions (optional, backward compatible)

```typescript
visualNeed?: {
  type: "diagram" | "image" | null;
  reason: string;
  insertionAnchor: string;
}

resolvedVisual?: {
  type: "diagram" | "image";
  status: "pending" | "ready" | "failed";
  mermaidSource?: string;
  imageId?: string;
  generatedAt?: number;
}
```

## Taxonomy

`read`: exposure, document scope (sibling of RSVP).

# Contract: mode-taxonomy

**Module**: `src/js/mode-taxonomy.js` (NEW)  
**FR**: FR-001, FR-002

## Exports

```javascript
/** @typedef {'exposure'|'retrieval'} ModeRole */
/** @typedef {'document'|'vault'} ModeScope */

export const MODE_TAXONOMY = {
  rsvp:      { role: 'exposure',  scope: 'document', label: 'RSVP', ... },
  slow:      { role: 'exposure',  scope: 'document', label: 'Slow Mode', ... },
  questions: { role: 'retrieval', scope: 'document', label: 'Questions', ... },
  cloze:     { role: 'retrieval', scope: 'document', label: 'Cloze Detection', ... },
  recall:    { role: 'retrieval', scope: 'document', label: 'Recall', ... },
  review:    { role: 'retrieval', scope: 'vault',      label: 'Review', ... },
};

export function getModesByRole(role) → ModeKey[]
export function getDocumentRetrievalModes() → Array<{ key, label, hint }>
export function isExposureMode(key) → boolean
export function isVaultMode(key) → boolean
```

## Rules

- `getDocumentRetrievalModes()` returns stable order: `questions`, `cloze`, `recall` (explicit sort, not object key order).
- `review` excluded from document hub list.
- Pure module — no DOM, no session I/O.

## Tests

- Unit: filter returns exactly 3 keys for hub.
- `review.scope === 'vault'` and not included in hub list.

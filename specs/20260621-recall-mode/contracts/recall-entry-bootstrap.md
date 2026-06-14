# Contract: recall-entry-bootstrap

**Modules**: `src/js/mode-bootstrap.js`, `src/js/study.js`, `src/js/session.js`  
**FR**: FR-006–FR-008, FR-014

## resolveModeEntryState(doc, 'recall')

Returns `{ kind, reason, bootstrapPayload? }`:

| kind | When |
|------|------|
| `resume` | `modes.recall.status === 'in_progress'` |
| `bootstrap` | `shared.conceptInventory?.length > 0` |
| `generate_fresh` | rawMarkdown without inventory |
| `upload_required` | no rawMarkdown |

## enterModeWithContinuity(docId, 'recall')

1. Resolve entry state.
2. `upload_required` → navigate create/upload with mode hint.
3. `generate_fresh` → normalize if needed → `runConceptInventory` → save shared → generate questions.
4. `bootstrap` → skip inventory if hash valid and questions ready; else `generateRecallQuestions`.
5. `resume` → `screenRecall` at `currentIndex`.
6. Set `modes.recall.status` appropriately (`generating` → `ready` → `in_progress`).

## Session helpers (`session.js`)

```javascript
normalizeRecallSlice(raw) → RecallModeSlice
createEmptyRecallSlice(config?) → RecallModeSlice
computeInventoryHash(inventory, pedagogicalMeta) → string
```

## UI contract (`screenRecall`)

- Elements: question text, recall type badge (optional), textarea `#recallAnswer`, submit, feedback panel (critique, suggested, quality), next button, progress `#recallProgress`, optional concept peek toggle.
- No timer element.
- Regenerate button on ready screen if inventory unchanged (optional P2).
